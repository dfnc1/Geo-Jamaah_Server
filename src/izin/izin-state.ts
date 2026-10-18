import { StatusPersetujuan } from '@generated/prisma/enums';

/**
 * State machine izin (BR-07), fungsi murni tanpa IO supaya mudah diuji:
 *
 *   Pending   -> Disetujui | Ditolak
 *   Disetujui -> (tidak boleh berubah lagi)
 *   Ditolak   -> (tidak boleh berubah lagi)
 */
export const IZIN_TRANSITIONS: Record<StatusPersetujuan, StatusPersetujuan[]> =
  {
    Pending: [StatusPersetujuan.Disetujui, StatusPersetujuan.Ditolak],
    Disetujui: [],
    Ditolak: [],
  };

/** Apakah `to` status yang sah untuk transisi dari `from`. */
export function canTransition(
  from: StatusPersetujuan,
  to: StatusPersetujuan,
): boolean {
  return IZIN_TRANSITIONS[from].includes(to);
}

/** Hanya izin berstatus Pending yang boleh diputuskan (BR-07). */
export function isDecidable(status: StatusPersetujuan): boolean {
  return status === StatusPersetujuan.Pending;
}
