import { hhmmToMinutes, toWibDate } from '@src/presensi/wib-time';

/**
 * Logika murni Early Warning System (BR-08).
 *
 * Semua fungsi di sini bebas Prisma/Nest supaya mudah diuji: service
 * hanya bertugas mengambil baris presensi (sedikit query) lalu
 * menghitung di memori dengan fungsi-fungsi ini.
 *
 * Kolom yang dipakai hanya `status_presensi`, `tanggal`, dan
 * `jadwal.waktu_mulai_presensi` — baris otomatis job (koordinat 0,0,
 * masjid utama) aman dipakai untuk perhitungan ini.
 */

/** Default periode perhitungan (hari) bila env DSS_PERIODE_HARI kosong/tidak valid. */
export const PERIODE_HARI_DEFAULT = 30;

/** Alasan pemunculan di daftar kritis. */
export type AlasanKritis = 'rasio' | 'streak';

/** Satu baris presensi yang dibutuhkan EWS. */
export interface BarisPresensi {
  nim: string;
  /** Tanggal WIB sebagai Date UTC tengah-malam (kolom @db.Date). */
  tanggal: Date;
  /** Hadir | Manual | Tidak_Hadir | Izin (string agar bebas enum Prisma). */
  status_presensi: string;
  id_jadwal: string;
  /** `jadwal.waktu_mulai_presensi`, format "HH:mm" WIB. */
  waktu_mulai: string;
}

export interface RentangPeriode {
  /** Tanggal WIB awal periode (inklusif), UTC tengah-malam. */
  mulai: Date;
  /** Tanggal WIB akhir periode = hari ini (inklusif), UTC tengah-malam. */
  akhir: Date;
}

export interface HasilRasio {
  /** Jumlah baris Hadir + Manual. */
  pembilang: number;
  /** Jumlah baris terhitung: Hadir + Manual + Tidak_Hadir (Izin dikeluarkan). */
  penyebut: number;
  /** Persen dengan 1 desimal; null bila penyebut 0. */
  rasio: number | null;
  /** Hitungan per status dari baris dalam periode (Manual masuk `hadir`). */
  jumlah: { hadir: number; tidak_hadir: number; izin: number };
}

export interface Evaluasi {
  kategori: 'KRITIS' | 'AMAN';
  alasan: AlasanKritis[];
  rasio: number | null;
  streak_alpha: number;
  jumlah: { hadir: number; tidak_hadir: number; izin: number };
}

/**
 * Teks rekomendasi — aturan TETAP di satu tempat (keputusan tahap 10).
 * Kunci: pemicu rasio saja, streak saja, atau keduanya.
 */
export const ATURAN_REKOMENDASI: Record<
  'rasio' | 'streak' | 'rasio_dan_streak',
  string
> = {
  rasio:
    'Lakukan pendampingan kehadiran dan bimbingan belajar terjadwal; evaluasi mingguan bersama mahasantri.',
  streak:
    'Segera hubungi mahasantri untuk mengetahui penyebab ketidakhadiran beruntun; koordinasikan dengan wali santri bila perlu.',
  rasio_dan_streak:
    'Tindak lanjut intensif: pendampingan kehadiran, bimbingan belajar, dan klarifikasi penyebab ketidakhadiran beruntun; libatkan wali santri dan laporkan perkembangan ke Admin.',
};

/**
 * Parse env DSS_PERIODE_HARI: hanya bilangan bulat > 0; selainnya memakai
 * default. (Peringatan log dilakukan pemanggil bila raw tidak valid.)
 */
export function parsePeriodeHari(raw: string | undefined): number {
  if (raw !== undefined) {
    const trimmed = raw.trim();
    if (/^\d+$/.test(trimmed)) {
      const value = Number(trimmed);
      if (value > 0) return value;
    }
  }
  return PERIODE_HARI_DEFAULT;
}

/**
 * Rentang N hari terakhir TERMASUK hari ini (WIB).
 *
 * Batas hari memakai `toWibDate` (zona Asia/Jakarta), bukan tanggal UTC
 * proses, supaya konsisten dengan cara Presensi menyimpan tanggal.
 */
export function rentangPeriode(nHari: number, sekarang: Date): RentangPeriode {
  const akhir = toWibDate(sekarang);
  const mulai = new Date(akhir.getTime() - (nHari - 1) * 24 * 60 * 60 * 1000);
  return { mulai, akhir };
}

/** Inkusi baris dalam periode (kedua ujung inklusif). */
export function dalamPeriode(tanggal: Date, rentang: RentangPeriode): boolean {
  return (
    tanggal.getTime() >= rentang.mulai.getTime() &&
    tanggal.getTime() <= rentang.akhir.getTime()
  );
}

/**
 * Urutkan kronologis: (tanggal, waktu_mulai, id_jadwal) menaik — persis
 * urutan jadwal shalat lintas hari (BR-08).
 */
export function urutKronologis(rows: BarisPresensi[]): BarisPresensi[] {
  return [...rows].sort((a, b) => {
    const tanggal = a.tanggal.getTime() - b.tanggal.getTime();
    if (tanggal !== 0) return tanggal;
    const mulai = hhmmToMinutes(a.waktu_mulai) - hhmmToMinutes(b.waktu_mulai);
    if (mulai !== 0) return mulai;
    return a.id_jadwal.localeCompare(b.id_jadwal);
  });
}

/**
 * Rasio kehadiran (BR-08): (Hadir + Manual) / (baris terhitung − Izin),
 * dikali 100 dan dibulatkan SATU desimal. Izin dikeluarkan dari penyebut;
 * penyebut 0 -> rasio null (tidak pernah kritis karena rasio).
 */
export function hitungRasio(rows: BarisPresensi[]): HasilRasio {
  const jumlah = { hadir: 0, tidak_hadir: 0, izin: 0 };
  for (const row of rows) {
    if (row.status_presensi === 'Hadir' || row.status_presensi === 'Manual') {
      jumlah.hadir += 1;
    } else if (row.status_presensi === 'Tidak_Hadir') {
      jumlah.tidak_hadir += 1;
    } else if (row.status_presensi === 'Izin') {
      jumlah.izin += 1;
    }
  }

  const pembilang = jumlah.hadir;
  const penyebut = jumlah.hadir + jumlah.tidak_hadir;
  const rasio =
    penyebut > 0 ? Math.round((pembilang / penyebut) * 1000) / 10 : null;
  return { pembilang, penyebut, rasio, jumlah };
}

/**
 * Streak alpha: jumlah `Tidak_Hadir` berturut-turut dihitung mundur dari
 * baris TERBARU (urutan kronologis). `Hadir`, `Manual`, dan `Izin`
 * memutus streak; slot tanpa baris tidak memutus dan tidak menambah.
 */
export function hitungStreakAlpha(rows: BarisPresensi[]): number {
  const terbaruDulu = [...rows].sort((a, b) => {
    const tanggal = b.tanggal.getTime() - a.tanggal.getTime();
    if (tanggal !== 0) return tanggal;
    const mulai = hhmmToMinutes(b.waktu_mulai) - hhmmToMinutes(a.waktu_mulai);
    if (mulai !== 0) return mulai;
    return b.id_jadwal.localeCompare(a.id_jadwal);
  });

  let streak = 0;
  for (const row of terbaruDulu) {
    if (row.status_presensi !== 'Tidak_Hadir') break;
    streak += 1;
  }
  return streak;
}

/**
 * Evaluasi satu Mahasantri (BR-08): filter baris ke periode lalu hitung
 * rasio + streak. KRITIS bila rasio < 75 (perbandingan setelah pembulatan
 * satu desimal) ATAU streak alpha >= 3. Baris di luar periode tidak
 * dihitung untuk apa pun.
 */
export function evaluasiSantri(
  rows: BarisPresensi[],
  rentang: RentangPeriode,
): Evaluasi {
  const periodeRows = rows.filter((row) => dalamPeriode(row.tanggal, rentang));
  const { rasio, jumlah } = hitungRasio(periodeRows);
  const streak_alpha = hitungStreakAlpha(periodeRows);

  const alasan: AlasanKritis[] = [];
  if (rasio !== null && rasio < 75) alasan.push('rasio');
  if (streak_alpha >= 3) alasan.push('streak');

  return {
    kategori: alasan.length > 0 ? 'KRITIS' : 'AMAN',
    alasan,
    rasio,
    streak_alpha,
    jumlah,
  };
}

/** Teks rekomendasi tindakan dari daftar alasan pemicu. */
export function rekomendasiTindakan(alasan: AlasanKritis[]): string {
  if (alasan.length === 0) return '';
  const adaRasio = alasan.includes('rasio');
  const adaStreak = alasan.includes('streak');
  if (adaRasio && adaStreak) return ATURAN_REKOMENDASI.rasio_dan_streak;
  if (adaRasio) return ATURAN_REKOMENDASI.rasio;
  return ATURAN_REKOMENDASI.streak;
}
