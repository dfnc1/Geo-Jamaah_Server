/**
 * Pembatas hari untuk filter tanggal activity log dalam WIB (UTC+7).
 *
 * Filter `from`/`to` diterima sebagai tanggal murni `YYYY-MM-DD` dan
 * ditafsirkan sebagai hari WIB penuh: `from` mulai 00:00 WIB, `to` berakhir
 * tepat sebelum 00:00 WIB hari berikutnya (batas eksklusif `lt`).
 */

const OFFSET_JAM_WIB = 7;
const MILIDETIK_PER_JAM = 3_600_000;

/**
 * Awal hari (`00:00:00.000` WIB) dari tanggal `YYYY-MM-DD`, dikembalikan
 * sebagai Date representasi instan UTC-nya (17:00 UTC hari sebelumnya).
 */
export function awalHariWib(tanggal: string): Date {
  return new Date(`${tanggal}T00:00:00.000+07:00`);
}

/**
 * Batas akhir inklusif hari `to` (24 jam setelah awal hari WIB `to`),
 * dipakai sebagai `lt` pada filter `created_at`.
 */
export function akhirHariWib(tanggal: string): Date {
  return new Date(awalHariWib(tanggal).getTime() + 24 * MILIDETIK_PER_JAM - 1);
}

/** Validasi longgar format tanggal `YYYY-MM-DD` (divalidasi ketat di DTO). */
export function tanggalValid(tanggal: string): boolean {
  const d = awalHariWib(tanggal);
  return !Number.isNaN(d.getTime()) && tanggal.length === 10;
}

export { OFFSET_JAM_WIB };
