import 'reflect-metadata';
import { HttpException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { take } from 'rxjs/operators';
import { PrismaService } from '@src/prisma/prisma.service';
import { Role } from '@generated/prisma/client';
import {
  ActivityLogInterceptor,
  Audit,
} from './activity-log.interceptor';
import { ActivityLogService } from './activity-log.service';
import { QueryActivityLogsDto } from './activity-log.controller';

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

// ---------------------------------------------------------------------------
// Handler contoh bermetadata @Audit (decorator asli, sama seperti yang
// dipakai controller). Teks tiap endpoint asli diverifikasi lewat tes manual
// curl; yang diuji di sini mekanikennya: teks dari field respons terpilih,
// tanpa pernah menyentuh password/device_id.
// ---------------------------------------------------------------------------

class HandlerLogin {
  @Audit('Auth', () => 'Login berhasil', {
    catatGagal: true,
    teksGagal: ({ kodeError, usernameTerdaftar }) =>
      !usernameTerdaftar
        ? 'Login gagal: username tidak terdaftar'
        : `Login gagal (${kodeError})`,
  })
  login(): void {}
}

class HandlerPresensi {
  @Audit(
    'Presensi',
    (data) =>
      `Presensi ${(data as { nama_sholat: string }).nama_sholat} berhasil, jarak ${Math.round(
        (data as { jarak_meter: number }).jarak_meter,
      )} m`,
  )
  presensi(): void {}
}

class HandlerMasjid {
  @Audit('Masjid', (data) => `Membuat masjid ${(data as { nama_masjid: string }).nama_masjid}`)
  create(): void {}

  /** Contoh endpoint tanpa @Audit (semua GET di aplikasi nyata). */
  daftar(): void {}
}

class HandlerJobs {
  @Audit(
    'Jobs',
    (data) =>
      `Pemicu manual job tandai-tidak-hadir ${(data as { tanggal: string }).tanggal}`,
  )
  pemicu(): void {}
}

/** PrismaService versi mock: hanya method yang dipakai ActivityLogService + interceptor. */
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

const reflector = new Reflector();

/** ExecutionContext mock untuk konteks HTTP (atau type lain). */
function context(
  request: Record<string, unknown>,
  handler: (...args: never[]) => unknown,
  kelas: unknown,
  type = 'http',
) {
  return {
    getType: () => type,
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => kelas,
  } as never;
}

/** CallHandler mock: observable dari data (atau error). */
function handler(result: unknown, isError = false) {
  return {
    handle: jest.fn().mockReturnValue(
      isError ? throwError(() => result) : of(result),
    ),
  } as never;
}

/** Kunci yang TIDAK PERNAH boleh muncul pada baris log tersimpan. */
const TERLARANG = ['password', 'device_id', 'access_token', 'token'];
function expectTanpaSensitif(data: unknown): void {
  const teks = JSON.stringify(data).toLowerCase();
  for (const kunci of TERLARANG) {
    expect(teks).not.toContain(kunci);
  }
}

/** Bentuk satu baris log tersimpan. */
type BarisLog = {
  username: string;
  role: Role;
  modul: string;
  aktivitas: string;
};

/** Bentuk bungkus TransformInterceptor. */
function bungkus(data: unknown) {
  return { success: true, statusCode: 200, message: 'Operasi berhasil', data };
}

describe('activity-log (BR-11)', () => {
  let prisma: PrismaMock;
  let service: ActivityLogService;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.activityLog.create.mockResolvedValue({});
    service = new ActivityLogService(prisma as unknown as PrismaService);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  function buatInterceptor(): ActivityLogInterceptor {
    return new ActivityLogInterceptor(reflector, service);
  }

  /** Baris log yang tersimpan (argumen prisma.activityLog.create -> data). */
  function tercatat(): BarisLog[] {
    return prisma.activityLog.create.mock.calls.map(
      (call) => ((call as unknown[])[0] as { data: BarisLog }).data,
    );
  }

  // =========================================================================
  // 1. password dan device_id tidak pernah masuk log
  // =========================================================================
  describe('password dan device_id tidak pernah masuk log', () => {
    it('teks dibentuk dari field respons terpilih; body login berisi password/device_id tidak ikut tercatat', async () => {
      const interceptor = buatInterceptor();
      // Body login memuat kredensial — interceptor tidak pernah membacanya
      // selain `username`.
      const request = {
        body: {
          username: 'mahasantri1',
          password: 'rahasia-tersembunyi',
          device_id: 'dev-XYZ-SENSITIF',
        },
      };
      const ctx = context(
        request,
        HandlerLogin.prototype.login,
        HandlerLogin,
      );
      const respons = bungkus({
        access_token: 'TOKEN-RAHASIA-YANG-TIDAK-BOLEH-TERCATAT',
        user: { username: 'mahasantri1', role: Role.Mahasantri },
      });

      await interceptor
        .intercept(ctx, handler(respons))
        .pipe(take(1))
        .toPromise();

      const baris = tercatat();
      expect(baris).toHaveLength(1);
      expect(baris[0]).toEqual({
        username: 'mahasantri1',
        role: Role.Mahasantri,
        modul: 'Auth',
        aktivitas: 'Login berhasil',
      });
      const mentah = JSON.stringify(baris);
      expect(mentah).not.toContain('rahasia-tersembunyi');
      expect(mentah).not.toContain('dev-XYZ-SENSITIF');
      expect(mentah).not.toContain('TOKEN-RAHASIA');
      expectTanpaSensitif(baris);
    });

    it('login gagal: teks dari whitelist kode error + username dari body, tanpa kata "password"/"device_id"', async () => {
      const interceptor = buatInterceptor();
      prisma.pengguna.findUnique.mockResolvedValue({ role: Role.Musyrif });

      const usernamePanjang = 'u'.repeat(150);
      const request = {
        body: {
          username: usernamePanjang,
          password: 'salah-satu-kali',
          device_id: 'dev-ABC',
        },
      };
      const ctx = context(
        request,
        HandlerLogin.prototype.login,
        HandlerLogin,
      );
      const error = new HttpException(
        { message: 'Username atau password salah', error: 'ERR_INVALID_CREDENTIALS' },
        401,
      );

      await expect(
        interceptor
          .intercept(ctx, handler(error, true))
          .pipe(take(1))
          .toPromise(),
      ).rejects.toBe(error);

      const baris = tercatat();
      expect(baris).toHaveLength(1);
      expect(baris[0]).toEqual({
        username: 'u'.repeat(100), // dipotong sesuai batas kolom
        role: Role.Musyrif, // role asli hasil lookup 1 query
        modul: 'Auth',
        aktivitas: 'Login gagal (ERR_INVALID_CREDENTIALS)',
      });
      expectTanpaSensitif(baris);
    });

    it('login gagal + username tidak terdaftar: teks khusus + placeholder Mahasantri', async () => {
      const interceptor = buatInterceptor();
      prisma.pengguna.findUnique.mockResolvedValue(null);

      const request = { body: { username: 'tidak-ada', password: 'x' } };
      const ctx = context(
        request,
        HandlerLogin.prototype.login,
        HandlerLogin,
      );
      const error = new HttpException(
        { message: 'Username atau password salah', error: 'ERR_INVALID_CREDENTIALS' },
        401,
      );

      await expect(
        interceptor
          .intercept(ctx, handler(error, true))
          .pipe(take(1))
          .toPromise(),
      ).rejects.toThrow();

      expect(tercatat()[0]).toEqual({
        username: 'tidak-ada',
        role: Role.Mahasantri, // placeholder — bukan role asli
        modul: 'Auth',
        aktivitas: 'Login gagal: username tidak terdaftar',
      });
    });

    it('respons terbungkus {success,...,data} dibuka dulu sebelum teks dibentuk', async () => {
      const interceptor = buatInterceptor();
      const request = {
        user: { sub: 'u1', username: 'mahasantri1', role: Role.Mahasantri },
      };
      const ctx = context(
        request,
        HandlerPresensi.prototype.presensi,
        HandlerPresensi,
      );
      const respons = bungkus({
        status_presensi: 'Hadir',
        nama_sholat: 'Subuh',
        jarak_meter: 23.4,
      });

      await interceptor
        .intercept(ctx, handler(respons))
        .pipe(take(1))
        .toPromise();

      expect(tercatat()).toEqual([
        {
          username: 'mahasantri1',
          role: Role.Mahasantri,
          modul: 'Presensi',
          aktivitas: 'Presensi Subuh berhasil, jarak 23 m',
        },
      ]);
      expectTanpaSensitif(tercatat());
    });

    it('tanpa @Audit (mis. semua GET) tidak menulis log apa pun', async () => {
      const interceptor = buatInterceptor();
      const request = { user: { sub: 'u1', username: 'admin', role: Role.Admin } };
      const ctx = context(
        request,
        HandlerMasjid.prototype.daftar,
        HandlerMasjid,
      );

      const hasil = await interceptor
        .intercept(ctx, handler(bungkus([])))
        .pipe(take(1))
        .toPromise();

      expect(hasil).toEqual(bungkus([]));
      expect(prisma.activityLog.create).not.toHaveBeenCalled();
    });

    it('konteks non-HTTP (mis. cron) lewat tanpa mencatat', async () => {
      const interceptor = buatInterceptor();
      const ctx = context(
        {},
        HandlerJobs.prototype.pemicu,
        HandlerJobs,
        'rpc',
      );

      await interceptor
        .intercept(ctx, handler({ ok: true }))
        .pipe(take(1))
        .toPromise();

      expect(prisma.activityLog.create).not.toHaveBeenCalled();
    });

    it('teks aktivitas dipotong maksimal 500 karakter saat disimpan', () => {
      service.catat({
        username: 'admin',
        role: Role.Admin,
        modul: 'Masjid',
        aktivitas: 'x'.repeat(600),
      });

      expect(prisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          username: 'admin',
          role: Role.Admin,
          modul: 'Masjid',
          aktivitas: 'x'.repeat(500),
        },
      });
    });
  });

  // =========================================================================
  // 2. gagal menulis log tidak menggagalkan request
  // =========================================================================
  describe('gagal menulis log tidak menggagalkan request', () => {
    it('prisma create gagal (DB down) -> catat() tidak melempar + Logger.warn', async () => {
      prisma.activityLog.create.mockRejectedValue(new Error('DB down'));

      expect(() =>
        service.catat({
          username: 'user1',
          role: Role.Admin,
          modul: 'Masjid',
          aktivitas: 'Membuat masjid Tes',
        }),
      ).not.toThrow();

      await new Promise((r) => setImmediate(r));
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Gagal menulis activity log'),
      );
    });

    it('catat() melempar error internal -> hasil request sukses TIDAK berubah', async () => {
      const interceptor = buatInterceptor();
      jest.spyOn(service, 'catat').mockImplementation(() => {
        throw new Error('simulasi gagal internal');
      });

      const request = { user: { sub: 'u1', username: 'admin', role: Role.Admin } };
      const ctx = context(
        request,
        HandlerMasjid.prototype.create,
        HandlerMasjid,
      );

      const hasil = await interceptor
        .intercept(ctx, handler({ nama_masjid: 'Masjid Tes' }))
        .pipe(take(1))
        .toPromise();

      expect(hasil).toEqual({ nama_masjid: 'Masjid Tes' });
      // Tidak ada exception yang muncul ke stream.
    });

    it('pembentuk teks melempar (data tak terduga) -> hasil request sukses TIDAK berubah', async () => {
      const interceptor = buatInterceptor();
      const request = {
        user: { sub: 'u1', username: 'mahasantri1', role: Role.Mahasantri },
      };
      const ctx = context(
        request,
        HandlerPresensi.prototype.presensi,
        HandlerPresensi,
      );
      // data undefined -> membaca properti melempar TypeError di dalam tap.
      const respons = { success: true, data: undefined };

      const hasil = await interceptor
        .intercept(ctx, handler(respons))
        .pipe(take(1))
        .toPromise();

      expect(hasil).toEqual(respons);
      expect(prisma.activityLog.create).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Gagal mencatat aktivitas'),
      );
    });

    it('login gagal: error asli request tetap dilempar utuh sambil log ditulis', async () => {
      const interceptor = buatInterceptor();
      prisma.pengguna.findUnique.mockResolvedValue({ role: Role.Mahasantri });

      const asliError = new HttpException(
        { message: 'Username atau password salah', error: 'ERR_INVALID_CREDENTIALS' },
        401,
      );
      const request = { body: { username: 'mahasantri1', password: 'y' } };
      const ctx = context(
        request,
        HandlerLogin.prototype.login,
        HandlerLogin,
      );

      await expect(
        interceptor
          .intercept(ctx, handler(asliError, true))
          .pipe(take(1))
          .toPromise(),
      ).rejects.toBe(asliError);

      expect(tercatat()).toHaveLength(1);
    });

    it('lookup role saat login gagal gagal (DB) -> request tetap utuh, log tetap tercatat (placeholder)', async () => {
      const interceptor = buatInterceptor();
      prisma.pengguna.findUnique.mockRejectedValue(new Error('DB down'));

      const asliError = new HttpException(
        { message: 'Username atau password salah', error: 'ERR_INVALID_CREDENTIALS' },
        401,
      );
      const request = { body: { username: 'mahasantri1', password: 'y' } };
      const ctx = context(
        request,
        HandlerLogin.prototype.login,
        HandlerLogin,
      );

      await expect(
        interceptor
          .intercept(ctx, handler(asliError, true))
          .pipe(take(1))
          .toPromise(),
      ).rejects.toBe(asliError);

      const baris = tercatat();
      expect(baris).toHaveLength(1);
      expect(baris[0].role).toBe(Role.Mahasantri); // placeholder dari catch
    });
  });

  // =========================================================================
  // 3. filter dan pagination
  // =========================================================================
  describe('filter dan pagination', () => {
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

    it('metadata pagination: total=45 -> total_pages=3; total=0 -> total_pages=0', async () => {
      prisma.activityLog.count.mockResolvedValue(45);
      let hasil = await service.cari({ page: 1, limit: 20 });
      expect(hasil.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 45,
        total_pages: 3, // ceil(45/20)
      });

      prisma.activityLog.count.mockResolvedValue(0);
      hasil = await service.cari(filterKosong);
      expect(hasil.pagination.total_pages).toBe(0);
    });

    it('filter role, username, dan modul (exact match) masuk ke where', async () => {
      await service.cari({
        ...filterKosong,
        role: Role.Musyrif,
        username: 'musyrif1',
        modul: 'Izin',
      });

      const arg = prisma.activityLog.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({
        role: Role.Musyrif,
        username: 'musyrif1',
        modul: 'Izin',
      });
    });

    it('filter from/to ditafsirkan hari WIB penuh (17:00 UTC hari s/d 16:59:59.999 UTC berikutnya)', async () => {
      await service.cari({ ...filterKosong, from: '2026-10-01', to: '2026-10-05' });

      const arg = prisma.activityLog.findMany.mock.calls[0][0];
      // 2026-10-01 00:00 WIB = 2026-09-30 17:00 UTC
      expect((arg.where.created_at.gte as Date).toISOString()).toBe(
        '2026-09-30T17:00:00.000Z',
      );
      // akhir hari 2026-10-05 WIB = 2026-10-05 16:59:59.999 UTC
      expect((arg.where.created_at.lt as Date).toISOString()).toBe(
        '2026-10-05T16:59:59.999Z',
      );
    });

    it('tanpa filter tanggal -> where.created_at tidak ada', async () => {
      await service.cari(filterKosong);

      const arg = prisma.activityLog.findMany.mock.calls[0][0];
      expect(arg.where.created_at).toBeUndefined();
    });

    it('limit maksimum (100) dipakai apa adanya', async () => {
      await service.cari({ page: 1, limit: 100 });

      const arg = prisma.activityLog.findMany.mock.calls[0][0];
      expect(arg.take).toBe(100);
    });

    it('mengembalikan logs yang sudah di-map ke DTO + total yang cocok', async () => {
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
