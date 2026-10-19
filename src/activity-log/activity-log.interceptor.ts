import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Request } from 'express';
import { Role } from '@generated/prisma/client';
import { ActivityLogService } from './activity-log.service';

export const AUDIT_KEY = 'audit';

/** Metadata `@Audit`. */
export interface AuditMetadata {
  /** Nama modul pada kolom `modul` (Auth, Presensi, Izin, Masjid, dst). */
  modul: string;
  /**
   * Pembentuk teks sukses — DITULIS LANGSUNG DI DECORATOR tiap endpoint
   * sebagai fungsi kecil yang hanya memilih field eksplisit dari `data`
   * (bentuk mentah respons handler, bungkusan TransformInterceptor sudah
   * dibuka dulu). Kebijakan keras: teks harus eksplisit (contoh:
   * "Presensi Subuh berhasil, jarak 23 m"), maks 500 karakter (ditekan
   * `ActivityLogService.catat`), dan TIDAK PERNAH memuat field sensitif
   * (password, token, device_id, body mentah) karena teks tidak pernah
   * dibentuk dari objek request.
   */
  teks: (data: unknown) => string;
  /**
   * Khusus login: pembentuk teks kegagalan dari kode error whitelist
   * `ERR_XXX` + hasil lookup username (bukan body mentah). Dipakai bila
   * `catatGagal: true`; tanpa ini fallback `Login gagal (<kode>)`.
   */
  teksGagal?: (info: {
    kodeError: string;
    usernameTerdaftar: boolean;
  }) => string;
  /** Khusus login: catat juga bila handler melempar error (login gagal). */
  catatGagal?: boolean;
}

/**
 * Tandai handler HTTP supaya interceptor global mencatat activity log
 * (BR-11) setelah handler sukses, atau — bila `catatGagal: true` — saat
 * handler melempar error (login gagal). Hanya berlaku untuk handler yang
 * memakai decorator ini; aksi baru TIDAK otomatis dicatat (endpoint GET
 * memang tidak diberi `@Audit`, sehingga tidak pernah tercatat).
 *
 * Contoh:
 * ```ts
 * @Audit('Masjid', (data) => `Membuat masjid ${(data as MasjidDto).nama_masjid}`)
 * ```
 */
export function Audit(
  modul: string,
  teks: AuditMetadata['teks'],
  options?: {
    catatGagal?: boolean;
    teksGagal?: AuditMetadata['teksGagal'];
  },
): MethodDecorator & ClassDecorator {
  return SetMetadata(AUDIT_KEY, {
    modul,
    teks,
    teksGagal: options?.teksGagal,
    catatGagal: options?.catatGagal ?? false,
  } satisfies AuditMetadata);
}

/**
 * Bentuk `req.user` yang diisi JwtStrategy (hanya dipakai interceptor ini).
 */
interface RequestWithUser extends Request {
  user?: { sub: string; username: string; role: Role };
}

/**
 * Interceptor global (BR-11) yang membaca metadata `@Audit` lewat Reflector.
 * - Tanpa metadata: lewat tanpa mencatat (aksi baru tidak otomatis dicatat).
 * - Dengan metadata + handler sukses: catat satu baris activity log.
 * - Dengan metadata + `catatGagal: true` + handler melempar error: catat
 *   login gagal (hanya login yang dicatat saat gagal; GET tidak pernah).
 * - Kegagalan menulis log TIDAK PERNAH menggagalkan request (fire-and-
 *   forget di ActivityLogService.catat); error asli request tetap
 *   dilempar utuh lewat `throwError`.
 */
@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly activityLogService: ActivityLogService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const audit = this.reflector.getAllAndOverride<
      AuditMetadata | undefined
    >(AUDIT_KEY, [context.getHandler(), context.getClass()]);

    // Tanpa metadata: lewat tanpa mencatat (aksi baru TIDAK otomatis dicatat).
    if (!audit) return next.handle();

    // Hanya HTTP; metode non-HTTP (mis. cron) tidak dicatat.
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    return next.handle().pipe(
      tap((wrapper) => {
        // Seluruh blok audit dibungkus try/catch: kegagalan menulis log
        // (termasuk error sync builder teks yang tak terduga) TIDAK PERNAH
        // boleh menggagalkan request utama.
        try {
          // Respons di sini sudah dibungkus TransformInterceptor
          // `{ success, statusCode, message, data }`; builder teks menerima
          // `data` (bukan body mentah). Bila belum dibungkus (bentuk
          // mentah), dipakai apa adanya.
          const response = this.bukaBungkus(wrapper);

          // Identitas pelaku: req.user (endpoint terautentikasi) ATAU data
          // login pada respons (endpoint login yang memakai @Public).
          const identitas = this.resolveIdentitas(request, response);
          if (!identitas) {
            this.logger.warn(
              `Audit ${audit.modul}: identitas pelaku tidak ditemukan, log tidak ditulis`,
            );
            return;
          }

          this.activityLogService.catat({
            username: identitas.username,
            role: identitas.role,
            modul: audit.modul,
            aktivitas: audit.teks(response),
          });
        } catch (e) {
          this.logger.warn(
            `Gagal mencatat aktivitas (modul ${audit.modul}): ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        }
      }),
      catchError((error: unknown) => {
        // Login gagal (catatGagal: true): catat sebagai aktivitas gagal.
        // Hanya login yang dicatat saat gagal (GET tidak pernah; aksi lain
        // tanpa catatGagal lewat begitu saja).
        if (audit.catatGagal) {
          const kode = this.extractKodeError(error);
          const username = this.extractUsernameFromLoginBody(request);
          if (username) {
            // Floating promise: catatLoginGagal menangkap errornya sendiri
            // dan tidak pernah melempar (fire-and-forget).
            void this.catatLoginGagal(audit, username, kode);
          }
        }

        // Error asli request tetap dilempar utuh — tidak pernah diganti.
        return throwError(() => error);
      }),
    );
  }

  /**
   * Buka bungkus TransformInterceptor `{ success, statusCode, message, data }`
   * menjadi `data` mentah. Bila objek bukan bungkusan (bentuk mentah
   * controller), dikembalikan apa adanya.
   */
  private bukaBungkus(wrapper: unknown): unknown {
    if (
      wrapper !== null &&
      typeof wrapper === 'object' &&
      'success' in wrapper &&
      'data' in wrapper
    ) {
      return (wrapper as { data: unknown }).data;
    }
    return wrapper;
  }

  /**
   * Identitas pelaku: req.user bila ada (endpoint terautentikasi); fallback
   * ke data login pada respons (endpoint @Public login) — baik bentuk mentah
   * `{ user }` maupun yang sudah dibungkus TransformInterceptor
   * `{ data: { user } }`. Token/password tidak pernah dibaca dari sini.
   */
  private resolveIdentitas(
    request: RequestWithUser,
    response: unknown,
  ): { username: string; role: Role } | null {
    if (request.user) {
      return { username: request.user.username, role: request.user.role };
    }

    const r = response as {
      user?: { username?: string; role?: Role };
      data?: { user?: { username?: string; role?: Role } };
    };

    // Bentuk mentah respons AuthService.login: { access_token, user: {...} }.
    if (r.user?.username && r.user.role) {
      return { username: r.user.username, role: r.user.role };
    }

    // Bentuk setelah TransformInterceptor: { data: { user: {...} } }.
    if (r.data?.user?.username && r.data.user.role) {
      return { username: r.data.user.username, role: r.data.user.role };
    }

    return null;
  }

  /** Ambil kode error ERR_XXX dari HttpException. */
  private extractKodeError(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (
        typeof response === 'object' &&
        response !== null &&
        'error' in response
      ) {
        return String((response as { error: unknown }).error);
      }
    }
    return 'ERR_UNKNOWN';
  }

  /**
   * Ambil username dari body login (`POST /v1/auth/login` @Public). Body
   * dibaca dari req.body; potong maks 100 karakter (kolom VarChar(100)).
   * Password TIDAK PERNAH dibaca dari sini.
   */
  private extractUsernameFromLoginBody(
    request: RequestWithUser,
  ): string | null {
    const body = request.body as { username?: unknown } | undefined;
    if (
      body &&
      typeof body.username === 'string' &&
      body.username.trim() !== ''
    ) {
      return body.username.slice(0, 100);
    }
    return null;
  }

  /**
   * Cari role asli untuk login gagal via 1 query by username, lalu bentuk
   * teks lewat `teksGagal` di decorator login. Return null bila username
   * tidak terdaftar (teks disesuaikan; role memakai placeholder Mahasantri).
   * Query gagal -> null (jangan gagalkan request).
   */
  private async catatLoginGagal(
    audit: AuditMetadata,
    username: string,
    kode: string,
  ): Promise<void> {
    try {
      const role = await this.cariRolePengguna(username);
      const terdaftar = role !== null;
      const teks = audit.teksGagal
        ? audit.teksGagal({ kodeError: kode, usernameTerdaftar: terdaftar })
        : `Login gagal (${kode})`;
      this.activityLogService.catat({
        username,
        // Role asli bila username terdaftar; placeholder Mahasantri bila
        // tidak (hanya penanda, bukan role sebenarnya).
        role: role ?? Role.Mahasantri,
        modul: audit.modul,
        aktivitas: teks,
      });
    } catch (e) {
      this.logger.warn(
        `Gagal mencatat login gagal untuk ${username}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  private async cariRolePengguna(username: string): Promise<Role | null> {
    try {
      const prisma = (this.activityLogService as unknown as {
        prismaService: {
          pengguna: {
            findUnique: (args: unknown) => Promise<{ role: Role } | null>;
          };
        };
      }).prismaService;
      const result = await prisma.pengguna.findUnique({
        where: { username },
        select: { role: true },
      });
      return result?.role ?? null;
    } catch {
      return null;
    }
  }
}
