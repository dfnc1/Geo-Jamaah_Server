import { PrismaService } from '@src/prisma/prisma.service';
import { MusyrifPresensiService } from './musyrif-presensi.service';
import { toWibDate } from './wib-time';

// PrismaService dibutuhkan runtime oleh Nest sebagai value (metadata
// design:paramtypes), sehingga mengimpornya menarik dependensi berat/ESM.
// Unit test ini tidak membutuhkannya — cukup dimock supaya suite tetap
// jalan di CJS.
jest.mock('@src/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

/** PrismaService versi mock: hanya method yang dipakai MusyrifPresensiService. */
function createPrismaMock() {
  return {
    musyrif: { findUnique: jest.fn() },
    mahasantri: { findMany: jest.fn() },
    jadwalSholat: { findMany: jest.fn() },
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

const MUSYRIF = { id_musyrif: 'musyrif-1' };

const JADWAL_QUERY = [
  {
    id_jadwal: 'jadwal-subuh',
    nama_sholat: 'Subuh',
    waktu_azan: '04:30',
    waktu_mulai_presensi: '04:15',
    waktu_akhir_presensi: '05:10',
    presensi: [
      { nim: '24050505050', id_jadwal: 'jadwal-subuh', status_presensi: 'Hadir' },
    ],
  },
  {
    id_jadwal: 'jadwal-dzuhur',
    nama_sholat: 'Dzuhur',
    waktu_azan: '11:45',
    waktu_mulai_presensi: '11:30',
    waktu_akhir_presensi: '12:30',
    presensi: [],
  },
];

describe('MusyrifPresensiService', () => {
  let prisma: PrismaMock;
  let service: MusyrifPresensiService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new MusyrifPresensiService(
      prisma as unknown as PrismaService,
    );
    prisma.musyrif.findUnique.mockResolvedValue(MUSYRIF);
    prisma.mahasantri.findMany.mockResolvedValue([
      { nim: '24050505050', nama: 'santri_satu', kamar: 'A-12' },
    ]);
    prisma.jadwalSholat.findMany.mockResolvedValue(JADWAL_QUERY);
  });

  it('tepat 3 query Prisma (profil, santri binaan, jadwal+presensi nested) — tanpa N+1', async () => {
    await service.monitoring('pengguna-1', {});

    expect(prisma.musyrif.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.mahasantri.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.jadwalSholat.findMany).toHaveBeenCalledTimes(1);
  });

  it('404 ERR_MUSYRIF_NOT_FOUND bila token musyrif tanpa profil (query lain tidak jalan)', async () => {
    prisma.musyrif.findUnique.mockResolvedValue(null);

    await expect(service.monitoring('pengguna-x', {})).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'ERR_MUSYRIF_NOT_FOUND' }),
    });
    expect(prisma.mahasantri.findMany).not.toHaveBeenCalled();
    expect(prisma.jadwalSholat.findMany).not.toHaveBeenCalled();
  });

  it('hanya mengambil santri binaan yang status_aktif = true, urut nim menaik', async () => {
    await service.monitoring('pengguna-1', {});

    expect(prisma.mahasantri.findMany).toHaveBeenCalledWith({
      where: { id_musyrif: 'musyrif-1', status_aktif: true },
      select: { nim: true, nama: true, kamar: true },
      orderBy: { nim: 'asc' },
    });
  });

  it('default tanggal = hari ini WIB (bukan tanggal proses UTC); presensi difilter tanggal + nim binaan', async () => {
    await service.monitoring('pengguna-1', {});

    const hariIniWib = toWibDate(new Date());
    expect(prisma.jadwalSholat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          presensi: {
            where: {
              tanggal: hariIniWib,
              nim: { in: ['24050505050'] },
            },
            select: { nim: true, id_jadwal: true, status_presensi: true },
          },
        }),
        orderBy: { waktu_azan: 'asc' },
      }),
    );
  });

  it('tanggal eksplisit dipakai apa adanya (boleh lampau untuk riwayat)', async () => {
    await service.monitoring('pengguna-1', { tanggal: '2026-10-01' });

    const where = prisma.jadwalSholat.findMany.mock.calls[0][0].select.presensi
      .where;
    expect(where.tanggal.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('400 ERR_VALIDATION untuk tanggal masa depan, sebelum ada query', async () => {
    // Tanggal UTC proses + 2 hari dijamin melebihi hari ini WIB berapapun
    // TZ environment (WIB = UTC+7, selisih tanggal maksimal 1 hari) — tidak
    // flaky saat pergantian hari.
    const besokTeks = new Date(Date.now() + 2 * 24 * 3_600_000)
      .toISOString()
      .slice(0, 10);

    await expect(
      service.monitoring('pengguna-1', { tanggal: besokTeks }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'ERR_VALIDATION' }),
    });
    expect(prisma.musyrif.findUnique).not.toHaveBeenCalled();
    expect(prisma.mahasantri.findMany).not.toHaveBeenCalled();
    expect(prisma.jadwalSholat.findMany).not.toHaveBeenCalled();
  });

  it('menyusun matriks "Belum" untuk jadwal tanpa baris + ringkasan sel', async () => {
    const hasil = await service.monitoring('pengguna-1', { tanggal: '2026-10-18' });

    expect(hasil.tanggal).toBe('2026-10-18');
    expect(hasil.jadwal.map((j) => j.nama_sholat)).toEqual(['Subuh', 'Dzuhur']);
    expect(hasil.jadwal[0]).not.toHaveProperty('presensi');
    expect(hasil.santri).toEqual([
      {
        nim: '24050505050',
        nama: 'santri_satu',
        kamar: 'A-12',
        status: [
          {
            id_jadwal: 'jadwal-subuh',
            nama_sholat: 'Subuh',
            status: 'Hadir',
          },
          {
            id_jadwal: 'jadwal-dzuhur',
            nama_sholat: 'Dzuhur',
            status: 'Belum',
          },
        ],
      },
    ]);
    expect(hasil.ringkasan).toEqual({
      Hadir: 1,
      Tidak_Hadir: 0,
      Izin: 0,
      Manual: 0,
      Belum: 1,
    });
  });

  it('tanpa santri binaan: jadwal tetap tampil, santri [], in[] kosong', async () => {
    prisma.mahasantri.findMany.mockResolvedValue([]);

    const hasil = await service.monitoring('pengguna-1', { tanggal: '2026-10-18' });

    const where = prisma.jadwalSholat.findMany.mock.calls[0][0].select.presensi
      .where;
    expect(where.nim).toEqual({ in: [] });
    expect(hasil.santri).toEqual([]);
    expect(hasil.jadwal).toHaveLength(2);
    expect(hasil.ringkasan.Belum).toBe(0);
  });
});
