import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@src/prisma/prisma.service';
import { DssService } from './dss.service';
import { ATURAN_REKOMENDASI } from './ews';

// PrismaService dibutuhkan runtime oleh Nest sebagai value (metadata
// design:paramtypes), sehingga mengimpornya menarik dependensi berat/ESM.
// ConfigService dari @nestjs/config juga ESM-only di setup ini. Unit test
// ini tidak membutuhkannya — cukup dimock supaya suite tetap jalan di CJS.
jest.mock('@src/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

/** PrismaService versi mock: hanya method yang dipakai DssService. */
function createPrismaMock() {
  return {
    musyrif: { findUnique: jest.fn() },
    mahasantri: { findMany: jest.fn() },
    presensi: { findMany: jest.fn() },
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

const MUSYRIF = { id_musyrif: 'musyrif-1' };
const SANTRI_A = { nim: '24050505050', nama: 'santri_satu' };
const SANTRI_C = { nim: '24060505092', nama: 'santri_tiga' };

/** Baris presensi dalam bentuk hasil query Prisma (dengan relasi jadwal). */
function rowPrisma(nim: string, tanggal: string, status: string, idx = 0) {
  const jam = ['05:10', '12:30', '15:45', '18:10', '19:30'][idx];
  return {
    nim,
    tanggal: new Date(`${tanggal}T00:00:00.000Z`),
    status_presensi: status,
    id_jadwal: `jadwal-${idx}`,
    jadwal: { waktu_mulai_presensi: jam },
  };
}

describe('DssService', () => {
  let prisma: PrismaMock;
  let config: { get: jest.Mock };
  let service: DssService;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = createPrismaMock();
    config = { get: jest.fn().mockReturnValue(undefined) };
    service = new DssService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
    );
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    prisma.musyrif.findUnique.mockResolvedValue(MUSYRIF);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('404 ERR_MUSYRIF_NOT_FOUND bila token musyrif tanpa profil', async () => {
    prisma.musyrif.findUnique.mockResolvedValue(null);

    await expect(service.findSantriKritis('pengguna-x')).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'ERR_MUSYRIF_NOT_FOUND' }),
    });
    expect(prisma.mahasantri.findMany).not.toHaveBeenCalled();
    expect(prisma.presensi.findMany).not.toHaveBeenCalled();
  });

  it('hanya mengambil santri binaan yang status_aktif = true', async () => {
    prisma.mahasantri.findMany.mockResolvedValue([]);

    await service.findSantriKritis('pengguna-1');

    expect(prisma.mahasantri.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_musyrif: MUSYRIF.id_musyrif, status_aktif: true },
      }),
    );
  });

  it('tanpa santri binaan aktif -> [] tanpa query presensi', async () => {
    prisma.mahasantri.findMany.mockResolvedValue([]);

    const hasil = await service.findSantriKritis('pengguna-1');

    expect(hasil).toEqual([]);
    expect(prisma.presensi.findMany).not.toHaveBeenCalled();
  });

  it('query presensi sekali untuk semua nim dengan rentang periode N hari', async () => {
    prisma.mahasantri.findMany.mockResolvedValue([SANTRI_A, SANTRI_C]);
    prisma.presensi.findMany.mockResolvedValue([]);
    config.get.mockReturnValue('7'); // periode 7 hari

    const hasil = await service.findSantriKritis('pengguna-1');

    const arg = prisma.presensi.findMany.mock.calls[0][0];
    expect(arg.where.nim).toEqual({ in: [SANTRI_A.nim, SANTRI_C.nim] });
    // 7 hari = selisih 6 hari antara batas bawah dan atas.
    const hari =
      (arg.where.tanggal.lte.getTime() - arg.where.tanggal.gte.getTime()) /
      86_400_000;
    expect(hari).toBe(6);
    // Hanya kolom yang dibutuhkan EWS (tidak ada koordinat/id_masjid).
    expect(arg.select).toEqual({
      nim: true,
      tanggal: true,
      status_presensi: true,
      id_jadwal: true,
      jadwal: { select: { waktu_mulai_presensi: true } },
    });
    expect(hasil).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('env DSS_PERIODE_HARI tidak valid -> default 30 + Logger.warn', async () => {
    prisma.mahasantri.findMany.mockResolvedValue([SANTRI_A]);
    prisma.presensi.findMany.mockResolvedValue([]);
    config.get.mockReturnValue('abc');

    await service.findSantriKritis('pengguna-1');

    const arg = prisma.presensi.findMany.mock.calls[0][0];
    const hari =
      (arg.where.tanggal.lte.getTime() - arg.where.tanggal.gte.getTime()) /
      86_400_000;
    expect(hari).toBe(29); // 30 hari
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('map hasil: hanya KRITIS, field + alasan + rekomendasi, urut rasio lalu streak lalu nim', async () => {
    prisma.mahasantri.findMany.mockResolvedValue([
      { nim: '24050505099', nama: 'santri_aman' },
      SANTRI_C,
      SANTRI_A,
    ]);
    config.get.mockReturnValue(undefined);

    // A: rasio 33,3% (1 hadir / 3 terhitung), streak 0 -> KRITIS [rasio].
    // C: 3 alpha terbaru, rasio 50% (3/6) -> KRITIS [rasio, streak].
    // aman: 2 hadir -> AMAN (tidak muncul).
    prisma.presensi.findMany.mockResolvedValue([
      rowPrisma(SANTRI_A.nim, '2026-10-15', 'Tidak_Hadir', 0),
      rowPrisma(SANTRI_A.nim, '2026-10-15', 'Tidak_Hadir', 1),
      rowPrisma(SANTRI_A.nim, '2026-10-16', 'Hadir', 0),
      rowPrisma(SANTRI_A.nim, '2026-10-16', 'Izin', 4),
      ...[0, 1, 2].map((i) => rowPrisma(SANTRI_C.nim, '2026-10-14', 'Hadir', i)),
      rowPrisma(SANTRI_C.nim, '2026-10-15', 'Tidak_Hadir', 0),
      rowPrisma(SANTRI_C.nim, '2026-10-16', 'Tidak_Hadir', 1),
      rowPrisma(SANTRI_C.nim, '2026-10-17', 'Tidak_Hadir', 2),
      ...[0, 1].map((i) => rowPrisma('24050505099', '2026-10-16', 'Hadir', i)),
    ]);

    const hasil = await service.findSantriKritis('pengguna-1');

    // Urutan: A (33,3) sebelum C (50).
    expect(hasil.map((h) => h.nim)).toEqual([SANTRI_A.nim, SANTRI_C.nim]);

    expect(hasil[0]).toEqual({
      nim: SANTRI_A.nim,
      nama: SANTRI_A.nama,
      kategori_risiko: 'KRITIS',
      rasio_kehadiran: 33.3,
      streak_alpha: 0,
      jumlah: { hadir: 1, tidak_hadir: 2, izin: 1 },
      alasan: ['rasio'],
      rekomendasi_tindakan: ATURAN_REKOMENDASI.rasio,
    });
    expect(hasil[1]).toMatchObject({
      nim: SANTRI_C.nim,
      rasio_kehadiran: 50,
      streak_alpha: 3,
      jumlah: { hadir: 3, tidak_hadir: 3, izin: 0 },
      alasan: ['rasio', 'streak'],
      rekomendasi_tindakan: ATURAN_REKOMENDASI.rasio_dan_streak,
    });
  });

  it('urutan stabil: rasio sama -> streak menurun dulu, lalu nim menaik', async () => {
    prisma.mahasantri.findMany.mockResolvedValue([
      { nim: '24050505098', nama: 's98' },
      { nim: '24050505097', nama: 's97' },
    ]);
    // Keduanya rasio 50% (1 hadir / 2 terhitung); s98 streak 0, s97 streak 0,
    // sama-sama rasio -> nim menaik.
    prisma.presensi.findMany.mockResolvedValue([
      rowPrisma('24050505098', '2026-10-15', 'Hadir', 0),
      rowPrisma('24050505098', '2026-10-15', 'Tidak_Hadir', 1),
      rowPrisma('24050505097', '2026-10-15', 'Hadir', 0),
      rowPrisma('24050505097', '2026-10-15', 'Tidak_Hadir', 1),
    ]);

    const hasil = await service.findSantriKritis('pengguna-1');

    expect(hasil.map((h) => h.nim)).toEqual([
      '24050505097',
      '24050505098',
    ]);
  });
});
