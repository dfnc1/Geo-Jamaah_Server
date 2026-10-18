import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

export interface AuditMetadata {
  /** Nama modul pada kolom `modul` (Auth, Presensi, Izin, Masjid, dst). */
  modul: string;
  /** Teks aktivitas yang eksplisit, mis. "Presensi Subuh berhasil, jarak 23 m". */
  teks: string;
  /** Khusus login: catat juga bila handler melempar error (login gagal). */
  catatGagal?: boolean;
}

/**
 * Tandai handler HTTP supaya interceptor global mencatat activity log
 * (BR-11) setelah handler sukses, atau — bila `catatGagal: true` — saat
 * handler melempar error (login gagal). Hanya berlaku untuk handler yang
 * memakai decorator ini; aksi baru TIDAK otomatis dicatat.
 */
export function Audit(
  modul: string,
  teks: string,
  options?: { catatGagal?: boolean },
): MethodDecorator & ClassDecorator {
  return SetMetadata(AUDIT_KEY, {
    modul,
    teks,
    catatGagal: options?.catatGagal ?? false,
  } satisfies AuditMetadata);
}
