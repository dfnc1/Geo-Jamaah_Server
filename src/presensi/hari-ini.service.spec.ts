import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { HariIniService } from './hari-ini.service';

jest.mock('@src/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

function createPrismaMock() {
  return {
    mahasantri: { findUnique: jest.fn() },
    masjid: { findFirst: jest.fn() },
    jadwalSholat: { findMany: jest.fn() },
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

describe('HariIniService', () => {
  let prisma: PrismaMock;
  let service: HariIniService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new HariIniService(prisma as unknown as PrismaService);
  });

  it('melempar 404 ERR_MAHASANTRI_NOT_FOUND jika santri tidak ditemukan', async () => {
    prisma.mahasantri.findUnique.mockResolvedValue(null);

    await expect(service.ringkasan('user-123')).rejects.toThrow(NotFoundException);
    await expect(service.ringkasan('user-123')).rejects.toMatchObject({
      response: {
        message: 'Data mahasantri tidak ditemukan',
        error: 'ERR_MAHASANTRI_NOT_FOUND',
      },
    });
  });

  it('mengembalikan tanggal, masjid null jika belum ada masjid, dan jadwal', async () => {
    prisma.mahasantri.findUnique.mockResolvedValue({ nim: '240001' });
    prisma.masjid.findFirst.mockResolvedValue(null);
    prisma.jadwalSholat.findMany.mockResolvedValue([
      {
        id_jadwal: 'j-subuh',
        nama_sholat: 'Subuh',
        waktu_azan: '04:30',
        waktu_iqamah: '04:35',
        waktu_mulai_presensi: '04:20',
        waktu_akhir_presensi: '05:00',
        presensi: [],
      },
    ]);

    const res = await service.ringkasan('user-123');

    expect(res.masjid).toBeNull();
    expect(res.jadwal).toHaveLength(1);
    expect(res.jadwal[0].id_jadwal).toBe('j-subuh');
    expect(res.jadwal[0].status).toBe('Belum');
    expect(res.tanggal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(prisma.mahasantri.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.masjid.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.jadwalSholat.findMany).toHaveBeenCalledTimes(1);
  });

  it('mengembalikan data masjid utama dan status presensi yang cocok', async () => {
    prisma.mahasantri.findUnique.mockResolvedValue({ nim: '240001' });
    prisma.masjid.findFirst.mockResolvedValue({
      id_masjid: 'm-1',
      nama_masjid: 'Masjid Raya',
      latitude: -6.2,
      longitude: 106.8,
      radius_toleransi: 100,
    });
    prisma.jadwalSholat.findMany.mockResolvedValue([
      {
        id_jadwal: 'j-subuh',
        nama_sholat: 'Subuh',
        waktu_azan: '04:30',
        waktu_iqamah: '04:35',
        waktu_mulai_presensi: '04:20',
        waktu_akhir_presensi: '05:00',
        presensi: [
          { id_jadwal: 'j-subuh', status_presensi: 'Hadir' },
        ],
      },
    ]);

    const res = await service.ringkasan('user-123');

    expect(res.masjid).toEqual({
      id_masjid: 'm-1',
      nama_masjid: 'Masjid Raya',
      latitude: -6.2,
      longitude: 106.8,
      radius_toleransi: 100,
    });
    expect(res.jadwal[0].status).toBe('Hadir');
  });
});
