/**
 * Logika murni ringkasan presensi hari ini (tahap 6).
 *
 * Dipisah dari service agar bisa diuji tanpa IO — tidak ada query di sini.
 * Service menyiapkan data dari tiga query lalu memanggil `susunHariIni`.
 */

import { isWithinWindow } from './wib-time';
import { StatusHariIni } from './dto/hari-ini.dto';

/** Subset jadwal yang dibutuhkan kalkulasi (tanpa baris presensi). */
export type JadwalInput = {
  id_jadwal: string;
  nama_sholat: string;
  waktu_azan: string;
  waktu_iqamah: string;
  waktu_mulai_presensi: string;
  waktu_akhir_presensi: string;
};

/** Baris presensi hari ini (kolom yang dipakai saja). */
export type BarisPresensiHariIni = {
  id_jadwal: string;
  status_presensi: string;
};

/** Hasil kalkulasi satu slot jadwal. */
export type SlotHariIni = JadwalInput & {
  status: StatusHariIni;
  sedang_dalam_window: boolean;
};

const STATUS_VALID: readonly string[] = [
  'Hadir',
  'Tidak_Hadir',
  'Izin',
  'Manual',
];

/**
 * Tentukan status satu jadwal berdasarkan baris presensi yang ada.
 *
 * - Jika ada baris presensi untuk jadwal itu → pakai status_presensi-nya.
 * - Jika tidak ada baris → "Belum".
 * - Nilai tak dikenal dari DB (defensif) diperlakukan "Belum".
 */
export function tentukanStatusHariIni(
  idJadwal: string,
  baris: BarisPresensiHariIni[],
): StatusHariIni {
  const found = baris.find((b) => b.id_jadwal === idJadwal);
  if (!found) return 'Belum';
  return STATUS_VALID.includes(found.status_presensi)
    ? (found.status_presensi as StatusHariIni)
    : 'Belum';
}

/**
 * Susun daftar slot jadwal hari ini dengan status dan flag `sedang_dalam_window`.
 *
 * @param jadwal      semua jadwal sholat (urut waktu_azan menaik dari query)
 * @param baris       baris presensi hari ini milik santri bersangkutan
 * @param nowHHmm     jam server WIB saat ini dalam format "HH:mm"
 */
export function susunHariIni(
  jadwal: JadwalInput[],
  baris: BarisPresensiHariIni[],
  nowHHmm: string,
): SlotHariIni[] {
  return jadwal.map((j) => ({
    ...j,
    status: tentukanStatusHariIni(j.id_jadwal, baris),
    sedang_dalam_window: isWithinWindow(
      nowHHmm,
      j.waktu_mulai_presensi,
      j.waktu_akhir_presensi,
    ),
  }));
}
