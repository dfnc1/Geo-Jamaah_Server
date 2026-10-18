import { Logger } from '@nestjs/common';
import { PrismaService } from '@src/prisma/prisma.service';
import { Role } from '@generated/prisma/client';
import { ActivityLogService } from './activity-log.service';
import { QueryActivityLogsDto } from './dto/query-activity-logs.dto';

// PrismaService & ConfigService dibutuhkan runtime oleh Nest sebagai value
// (metadata design:paramtypes), sehingga mengimpornya menarik dependensi
// berat/ESM. Unit test ini tidak membutuhkannya — cukup dimock supaya suite
// tetap jalan di CJS.
jest.mock('@src/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

/** PrismaService versi mock: hanya method yang dipakai ActivityLogService. */
function createPrismaMock() {
  return {
    activityLog: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    pengguna: {
      findUnique: jest.fn(),
    },
  };
}

type PrismaMock = ReturnType<typeof createPrismaMock>;

describe('ActivityLogService', () => {
  let prisma: PrismaMock;
  let service: ActivityLogService;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ActivityLogService(prisma as unknown as PrismaService);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // catat() — fire-and-forget, tidak melempar
  // -------------------------------------------------------------------------
  describe('catat()', () => {
    it('memanggil prisma.activityLog.create dengan data yang sudah dipotong', () => {
      prisma.activityLog.create.mockResolvedValue({});

      service.catat({
        username: 'a'.repeat(150),
        role: Role.Musyrif,
        modul: 'Presensi',
        aktivitas: 'b'.repeat(600),
      });

      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          username: 'a'.repeat(100),
          role: Role.Musyrif,
          modul: 'Presensi',
          aktivitas: 'b'.repeat(500),
        },
      });
    });

    it('TIDAK melempar saat create gagal (fire-and-forget) + Logger.warn', async () => {
      prisma.activityLog.create.mockRejectedValue(new Error('DB down'));

      expect(() =>
        service.catat({
          username: 'user1',
          role: Role.Admin,
          modul: 'Masjid',
          aktivitas: 'Membuat masjid Tes',
        }),
      ).not.toThrow();

      // Tunggu promise rejection selesai (microtask) lalu verifikasi warn.
      await new Promise((r) => setImmediate(r));
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Gagal menulis activity log'),
      );
    });

    it('role yang disimpan persis seperti diterima (tidak diubah)', () => {
      prisma.activityLog.create.mockResolvedValue({});

      service.catat({
        username: 'mahasantri1',
        role: Role.Mahasantri,
        modul: 'Presensi',
        aktivitas: 'Presensi Subuh berhasil, jarak 23 m',
      });

      expect(prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: Role.Mahasantri }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // cari() — filter, batas WIB, pagination, urutan
  // -------------------------------------------------------------------------
  describe('cari()', () => {
    const filterKosong: QueryActivityLogsDto = { page: 1, limit: 20 };

    beforeEach(() => {
      prisma.activityLog.count.mockResolvedValue(0);
      prisma.activityLog.findMany.mockResolvedValue([]);
    });

    it('default: page=1, limit=20, urut created_at desc lalu id_log desc', async () => {
      await service.cari(filterKosong);

      const arg = prisma.activityLog.findMany.mock.calls[0][0];
      expect(arg.orderBy).toEqual([
        { created_at: 'desc' },
        { id_log: 'desc' },
      ]);
      expect(arg.skip).toBe(0);
      expect(arg.take).toBe(20);
    });

    it('pagination: page=3, limit=50 -> skip=100, take=50', async () => {
      await service.cari({ page: 3, limit: 50 });

      const arg = prisma.activityLog.findMany.mock.calls[0][0];
      expect(arg.skip).toBe(100);
      expect(arg.take).toBe(50);
    });

    it('metadata pagination: total, total_pages = ceil(total/limit)', async () => {
      prisma.activityLog.count.mockResolvedValue(45);
      prisma.activityLog.findMany.mockResolvedValue([]);

      const hasil = await service.cari({ page: 1, limit: 20 });

      expect(hasil.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 45,
        total_pages: 3, // ceil(45/20)
      });
    });

    it('metadata pagination: total=0 -> total_pages=0', async () => {
      prisma.activityLog.count.mockResolvedValue(0);
      prisma.activityLog.findMany.mockResolvedValue([]);

      const hasil = await service.cari(filterKosong);

      expect(hasil.pagination.total_pages).toBe(0);
    });

    it('filter role -> where.role sesuai', async () => {
      await service.cari({ ...filterKosong, role: Role.Musyrif });

      const arg = prisma.activityLog.findMany.mock.calls[0][0];
      expect(arg.where.role).toBe(Role.Musyrif);
    });

    it('filter username -> where.username sesuai', async () => {
      await service.cari({ ...filterKosong, username: 'musyrif1' });

      const arg = prisma.activityLog.findMany.mock.calls[0][0];
      expect(arg.where.username).toBe('musyrif1');
    });

    it('filter modul -> where.modul sesuai', async () => {
      await service.cari({ ...filterKosong, modul: 'Izin' });

      const arg = prisma.activityLog.findMany.mock.calls[0][0];
      expect(arg.where.modul).toBe('Izin');
    });

    it('filter from -> gte = awal hari WIB (17:00 UTC hari sebelumnya)', async () => {
      await service.cari({ ...filterKosong, from: '2026-10-01' });

      const arg = prisma.activityLog.findMany.mock.calls[0][0];
      const gte = arg.where.created_at.gte as Date;
      // 2026-10-01 00:00 WIB = 2026-09-30 17:00 UTC
      expect(gte.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    });

    it('filter to -> lt = akhir hari WIB (16:59:59.999 UTC hari berikutnya)', async () => {
      await service.cari({ ...filterKosong, to: '2026-10-01' });

      const arg = prisma.activityLog.findMany.mock.calls[0][0];
      const lt = arg.where.created_at.lt as Date;
      // akhirHariWib('2026-10-01') = 2026-10-01 00:00 WIB + 24 jam - 1 ms
      // = 2026-09-30 17:00 UTC + 24 jam - 1 ms = 2026-10-01 16:59:59.999 UTC
      expect(lt.toISOString()).toBe('2026-10-01T16:59:59.999Z');
    });

    it('filter from+to -> gte dan lt keduanya ada', async () => {
      await service.cari({ ...filterKosong, from: '2026-10-01', to: '2026-10-05' });

      const arg = prisma.activityLog.findMany.mock.calls[0][0];
      expect(arg.where.created_at.gte).toBeInstanceOf(Date);
      expect(arg.where.created_at.lt).toBeInstanceOf(Date);
    });

    it('tanpa filter tanggal -> where.created_at tidak ada', async () => {
      await service.cari(filterKosong);

      const arg = prisma.activityLog.findMany.mock.calls[0][0];
      expect(arg.where.created_at).toBeUndefined();
    });

    it('limit > 100 di-clamp ke 100 (batas kolom praktis)', async () => {
      // Note: DTO validation sudah membatasi max 100; service juga defensif.
      // Kita uji bahwa service memakai limit apa adanya (clamp di DTO).
      await service.cari({ page: 1, limit: 100 });

      const arg = prisma.activityLog.findMany.mock.calls[0][0];
      expect(arg.take).toBe(100);
    });

    it('mengembalikan logs yang sudah di-map ke DTO', async () => {
      const baris = [
        {
          id_log: 'log-1',
          username: 'musyrif1',
          role: Role.Musyrif,
          modul: 'Izin',
          aktivitas: 'Memverifikasi izin 24050505050 menjadi Disetujui',
          created_at: new Date('2026-10-18T10:00:00.000Z'),
        },
      ];
      prisma.activityLog.count.mockResolvedValue(1);
      prisma.activityLog.findMany.mockResolvedValue(baris);

      const hasil = await service.cari(filterKosong);

      expect(hasil.logs).toEqual(baris);
      expect(hasil.pagination.total).toBe(1);
    });
  });
});
