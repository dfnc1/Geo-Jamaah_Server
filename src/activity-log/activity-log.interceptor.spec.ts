import { Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { take } from 'rxjs/operators';
import { Role } from '@generated/prisma/client';
import { ActivityLogInterceptor } from './activity-log.interceptor';
import { ActivityLogService } from './activity-log.service';
import { AuditMetadata } from './audit.decorator';
import { HttpException } from '@nestjs/common';

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

/** ActivityLogService versi mock: hanya method yang dipakai interceptor. */
function createServiceMock() {
  return {
    catat: jest.fn(),
  };
}

type ServiceMock = ReturnType<typeof createServiceMock>;

/** Reflector versi mock: kembalikan metadata tetap untuk semua handler. */
function createReflectorMock(metadata: AuditMetadata | undefined) {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(metadata),
  } as unknown as Reflector;
}

/** ExecutionContext versi mock untuk konteks HTTP. */
function createExecutionContext(options: {
  request: Record<string, unknown>;
  type?: string;
}) {
  return {
    getType: jest.fn().mockReturnValue(options.type ?? 'http'),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(options.request),
    }),
    getHandler: jest.fn().mockReturnValue(() => {}),
    getClass: jest.fn().mockReturnValue(class {}),
  } as never;
}

/** CallHandler versi mock: kembalikan observable dari data / error. */
function createCallHandler(result: unknown, isError = false) {
  return {
    handle: jest.fn().mockReturnValue(
      isError ? throwError(() => result) : of(result),
    ),
  } as never;
}

describe('ActivityLogInterceptor', () => {
  let service: ServiceMock;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    service = createServiceMock();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Tanpa metadata -> lewat tanpa mencatat
  // -------------------------------------------------------------------------
  it('tanpa metadata @Audit -> tidak menulis log apa pun', async () => {
    const reflector = createReflectorMock(undefined);
    const interceptor = new ActivityLogInterceptor(
      reflector,
      service as unknown as ActivityLogService,
    );

    const ctx = createExecutionContext({ request: { user: { username: 'x', role: Role.Admin } } });
    const handler = createCallHandler({ ok: true });

    const hasil = await interceptor.intercept(ctx, handler).pipe(take(1)).toPromise();

    expect(hasil).toEqual({ ok: true });
    expect(service.catat).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Sukses dengan metadata -> menulis sekali
  // -------------------------------------------------------------------------
  it('metadata @Audit + handler sukses -> menulis log tepat 1 kali', async () => {
    const metadata: AuditMetadata = {
      modul: 'Masjid',
      teks: 'membuat-masjid',
      catatGagal: false,
    };
    const reflector = createReflectorMock(metadata);
    const interceptor = new ActivityLogInterceptor(
      reflector,
      service as unknown as ActivityLogService,
    );

    const request = {
      user: { sub: 'pengguna-1', username: 'admin', role: Role.Admin },
    };
    const ctx = createExecutionContext({ request });
    const handler = createCallHandler({ nama_masjid: 'Masjid Al-Ikhlas' });

    await interceptor.intercept(ctx, handler).pipe(take(1)).toPromise();

    expect(service.catat).toHaveBeenCalledTimes(1);
    expect(service.catat).toHaveBeenCalledWith({
      username: 'admin',
      role: Role.Admin,
      modul: 'Masjid',
      aktivitas: 'Membuat masjid Masjid Al-Ikhlas',
    });
  });

  // -------------------------------------------------------------------------
  // Login gagal: role asli (username terdaftar)
  // -------------------------------------------------------------------------
  it('login gagal + username terdaftar -> role asli dari query, bukan placeholder', async () => {
    const metadata: AuditMetadata = {
      modul: 'Auth',
      teks: 'login-berhasil',
      catatGagal: true,
    };
    const reflector = createReflectorMock(metadata);
    const interceptor = new ActivityLogInterceptor(
      reflector,
      service as unknown as ActivityLogService,
    );

    // Mock cariRolePengguna via prisma (activityLogService.prismaService).
    (service as unknown as Record<string, unknown>).prismaService = {
      pengguna: {
        findUnique: jest.fn().mockResolvedValue({ role: Role.Musyrif }),
      },
    };

    const request = { body: { username: 'musyrif1', password: 'salah' } };
    const ctx = createExecutionContext({ request });
    const error = new HttpException(
      { message: 'Username atau password salah', error: 'ERR_INVALID_CREDENTIALS' },
      401,
    );
    const handler = createCallHandler(error, true);

    await expect(
      interceptor.intercept(ctx, handler).pipe(take(1)).toPromise(),
    ).rejects.toThrow();

    expect(service.catat).toHaveBeenCalledTimes(1);
    expect(service.catat).toHaveBeenCalledWith({
      username: 'musyrif1',
      role: Role.Musyrif,
      modul: 'Auth',
      aktivitas: 'Login gagal: username atau kata sandi salah',
    });
  });

  // -------------------------------------------------------------------------
  // Login gagal: role placeholder untuk username tidak terdaftar
  // -------------------------------------------------------------------------
  it('login gagal + username tidak terdaftar -> placeholder Mahasantri + teks khusus', async () => {
    const metadata: AuditMetadata = {
      modul: 'Auth',
      teks: 'login-berhasil',
      catatGagal: true,
    };
    const reflector = createReflectorMock(metadata);
    const interceptor = new ActivityLogInterceptor(
      reflector,
      service as unknown as ActivityLogService,
    );

    (service as unknown as Record<string, unknown>).prismaService = {
      pengguna: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const request = { body: { username: 'tidak-ada', password: 'salah' } };
    const ctx = createExecutionContext({ request });
    const error = new HttpException(
      { message: 'Username atau password salah', error: 'ERR_INVALID_CREDENTIALS' },
      401,
    );
    const handler = createCallHandler(error, true);

    await expect(
      interceptor.intercept(ctx, handler).pipe(take(1)).toPromise(),
    ).rejects.toThrow();

    expect(service.catat).toHaveBeenCalledWith({
      username: 'tidak-ada',
      role: Role.Mahasantri, // placeholder — bukan role asli
      modul: 'Auth',
      aktivitas: 'Login gagal: username tidak terdaftar',
    });
  });

  // -------------------------------------------------------------------------
  // Error asli request tetap dilempar utuh
  // -------------------------------------------------------------------------
  it('error asli request tetap dilempar utuh (tidak diganti)', async () => {
    const metadata: AuditMetadata = {
      modul: 'Auth',
      teks: 'login-berhasil',
      catatGagal: true,
    };
    const reflector = createReflectorMock(metadata);
    const interceptor = new ActivityLogInterceptor(
      reflector,
      service as unknown as ActivityLogService,
    );

    (service as unknown as Record<string, unknown>).prismaService = {
      pengguna: { findUnique: jest.fn().mockResolvedValue(null) },
    };

    const asliError = new HttpException(
      { message: 'Username atau password salah', error: 'ERR_INVALID_CREDENTIALS' },
      401,
    );
    const request = { body: { username: 'x', password: 'y' } };
    const ctx = createExecutionContext({ request });
    const handler = createCallHandler(asliError, true);

    await expect(
      interceptor.intercept(ctx, handler).pipe(take(1)).toPromise(),
    ).rejects.toBe(asliError);
  });

  // -------------------------------------------------------------------------
  // Gagal menulis log tidak mengubah hasil request
  // -------------------------------------------------------------------------
  it('catat() gagal (melempar internal) -> hasil request sukses TIDAK berubah', async () => {
    const metadata: AuditMetadata = {
      modul: 'Masjid',
      teks: 'membuat-masjid',
      catatGagal: false,
    };
    const reflector = createReflectorMock(metadata);
    const interceptor = new ActivityLogInterceptor(
      reflector,
      service as unknown as ActivityLogService,
    );

    // catat() melempar error internal (fire-and-forget di service menangkap,
    // tapi simulasi edge case: interceptor juga harus tahan).
    service.catat.mockImplementation(() => {
      throw new Error('simulasi gagal internal');
    });

    const request = {
      user: { sub: 'pengguna-1', username: 'admin', role: Role.Admin },
    };
    const ctx = createExecutionContext({ request });
    const handler = createCallHandler({ nama_masjid: 'Masjid Tes' });

    const hasil = await interceptor.intercept(ctx, handler).pipe(take(1)).toPromise();

    expect(hasil).toEqual({ nama_masjid: 'Masjid Tes' });
    // Tidak ada exception yang muncul ke stream.
  });

  // -------------------------------------------------------------------------
  // Respons sudah dibungkus TransformInterceptor {success,...,data}
  // -------------------------------------------------------------------------
  it('respons terbungkus {success,...,data} dibuka dulu sebelum teks dibentuk', async () => {
    const metadata: AuditMetadata = {
      modul: 'Presensi',
      teks: 'presensi',
      catatGagal: false,
    };
    const reflector = createReflectorMock(metadata);
    const interceptor = new ActivityLogInterceptor(
      reflector,
      service as unknown as ActivityLogService,
    );

    const request = {
      user: { sub: 'u1', username: 'mahasantri1', role: Role.Mahasantri },
    };
    const ctx = createExecutionContext({ request });
    // Bentuk persis seperti yang diterima interceptor dari controller
    // (sudah dibungkus TransformInterceptor).
    const handler = createCallHandler({
      success: true,
      statusCode: 201,
      message: 'Presensi berhasil dicatat',
      data: {
        status_presensi: 'Hadir',
        nama_sholat: 'Subuh',
        jarak_meter: 23.4,
      },
    });

    await interceptor.intercept(ctx, handler).pipe(take(1)).toPromise();

    expect(service.catat).toHaveBeenCalledTimes(1);
    expect(service.catat).toHaveBeenCalledWith({
      username: 'mahasantri1',
      role: Role.Mahasantri,
      modul: 'Presensi',
      aktivitas: 'Presensi Subuh berhasil, jarak 23 m',
    });
  });

  // -------------------------------------------------------------------------
  // Bungkusan respons login (bentuk @Public, tanpa req.user)
  // -------------------------------------------------------------------------
  it('login sukses: identitas diambil dari data.user pada bungkusan respons', async () => {
    const metadata: AuditMetadata = {
      modul: 'Auth',
      teks: 'login-berhasil',
      catatGagal: false,
    };
    const reflector = createReflectorMock(metadata);
    const interceptor = new ActivityLogInterceptor(
      reflector,
      service as unknown as ActivityLogService,
    );

    const ctx = createExecutionContext({ request: {} }); // @Public: tanpa req.user
    const handler = createCallHandler({
      success: true,
      statusCode: 201,
      message: 'Operasi berhasil',
      data: {
        token_type: 'Bearer',
        access_token: 'TOKEN-RAHASIA-YANG-TIDAK-BOLEH-TERCATAT',
        user: { id_pengguna: 'p1', username: 'musyrif1', role: Role.Musyrif },
      },
    });

    await interceptor.intercept(ctx, handler).pipe(take(1)).toPromise();

    expect(service.catat).toHaveBeenCalledTimes(1);
    const arg = service.catat.mock.calls[0][0] as {
      username: string;
      role: string;
      aktivitas: string;
    };
    expect(arg.username).toBe('musyrif1');
    expect(arg.role).toBe(Role.Musyrif);
    expect(arg.aktivitas).toBe('Login berhasil');
    // Token tidak pernah ikut tercatat.
    expect(JSON.stringify(arg)).not.toContain('TOKEN-RAHASIA');
  });

  // -------------------------------------------------------------------------
  // Non-HTTP context -> lewat tanpa mencatat
  // -------------------------------------------------------------------------
  it('context non-HTTP (mis. cron) -> lewat tanpa mencatat', async () => {
    const metadata: AuditMetadata = {
      modul: 'Jobs',
      teks: 'pemicu-job',
      catatGagal: false,
    };
    const reflector = createReflectorMock(metadata);
    const interceptor = new ActivityLogInterceptor(
      reflector,
      service as unknown as ActivityLogService,
    );

    const ctx = createExecutionContext({
      request: {},
      type: 'rpc', // bukan http
    });
    const handler = createCallHandler({ ok: true });

    await interceptor.intercept(ctx, handler).pipe(take(1)).toPromise();

    expect(service.catat).not.toHaveBeenCalled();
  });
});
