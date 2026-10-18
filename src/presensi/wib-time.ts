/**
 * Waktu berbasis zona Asia/Jakarta (WIB, UTC+7 tanpa DST).
 *
 * Semua waktu presensi dihitung di server memakai helper ini (BR-02),
 * bukan jam perangkat (HP) dan bukan timezone proses Node — supaya
 * hasilnya sama berapapun nilai TZ environment.
 */

const WIB_TIME_ZONE = 'Asia/Jakarta';

const wibFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: WIB_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const wibDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: WIB_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Jam WIB saat ini dalam format "HH:mm" (24 jam, nol-terisi).
 * Dipakai untuk membandingkan waktu server dengan window presensi jadwal.
 */
export function toWibHHmm(date: Date): string {
  return wibFormatter.format(date);
}

/**
 * Tanggal WIB saat ini sebagai Date pada tengah malam UTC, format yang
 * cocok untuk kolom Prisma `DateTime @db.Date` (supaya zona runtime tidak
 * menggeser tanggal yang tersimpan).
 */
export function toWibDate(date: Date): Date {
  const [year, month, day] = wibDateFormatter.format(date).split('-');
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

/** Ubah "HH:mm" menjadi menit sejak tengah malam. Asumsi format valid. */
export function hhmmToMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Cek apakah waktu server "HH:mm" berada di dalam window presensi.
 * Inklusif di kedua ujung: tepat di `waktu_mulai_presensi` dan tepat di
 * `waktu_akhir_presensi` tetap diterima.
 */
export function isWithinWindow(
  nowHHmm: string,
  mulaiHHmm: string,
  akhirHHmm: string,
): boolean {
  const now = hhmmToMinutes(nowHHmm);
  return now >= hhmmToMinutes(mulaiHHmm) && now <= hhmmToMinutes(akhirHHmm);
}
