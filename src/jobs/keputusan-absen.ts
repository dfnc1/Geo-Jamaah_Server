import { StatusPresensi } from '@generated/prisma/enums';

/** Status yang mungkin dibuat oleh job otomatis (BR-05). */
export type StatusAbsenOtomatis = Extract<
  StatusPresensi,
  'Tidak_Hadir' | 'Izin'
>;

/**
 * Logika penentuan status presensi otomatis (BR-05) sebagai fungsi murni
 * tanpa IO supaya mudah diuji.
 */
export type KandidatAbsensi = {
  status_aktif: boolean;
  punya_presensi: boolean; // sudah ada baris presensi apa pun pada jadwal+tanggal
  ada_izin_disetujui: boolean; // Izin berstatus Disetujui yang mencakup tanggal
};

export type KeputusanAbsensi =
  | { aksi: 'lewati'; alasan: 'nonaktif' | 'sudah_ada_presensi' }
  | {
      aksi: 'buat';
      status: StatusAbsenOtomatis;
    };

/**
 * Aturan, berurutan:
 * 1. Nonaktif dilewati (BR-05: hanya status_aktif = true).
 * 2. Sudah punya presensi (Hadir / Manual / hasil job sebelumnya) dilewati —
 *    tidak pernah menimpa baris yang ada.
 * 3. Ada izin Disetujui pada tanggal itu → buat `Izin`.
 * 4. Selainnya → buat `Tidak_Hadir` (izin Pending/Ditolak tetap dihitung
 *    tidak ada izin).
 */
export function tentukanAbsensi(kandidat: KandidatAbsensi): KeputusanAbsensi {
  if (!kandidat.status_aktif) {
    return { aksi: 'lewati', alasan: 'nonaktif' };
  }
  if (kandidat.punya_presensi) {
    return { aksi: 'lewati', alasan: 'sudah_ada_presensi' };
  }
  if (kandidat.ada_izin_disetujui) {
    return { aksi: 'buat', status: StatusPresensi.Izin };
  }
  return { aksi: 'buat', status: StatusPresensi.Tidak_Hadir };
}
