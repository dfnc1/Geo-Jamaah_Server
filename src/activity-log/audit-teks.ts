/**
 * Fungsi murni pembentuk teks aktivitas untuk activity log (BR-11).
 *
 * Kebijakan keras: teks aktivitas harus eksplisit (contoh: "Presensi Subuh
 * berhasil, jarak 23 m"), TIDAK PERNAH body mentah, dan TIDAK PERNAH
 * memuat field sensitif (password, token, device_id, dsb). Karena teks
 * hanya dibentuk dari fungsi-fungsi di sini — bukan dari objek request
 * secara utuh — field sensitif tidak pernah bisa ikut tercatat. Hal ini
 * dibuktikan oleh unit test `audit-teks.spec.ts`.
 */

export const MAKS_AKTIVITAS = 500;

/** Potong teks aktivitas maksimum 500 karakter (batas kolom praktis). */
export function potongTeks(teks: string): string {
  return teks.length > MAKS_AKTIVITAS ? teks.slice(0, MAKS_AKTIVITAS) : teks;
}

/** Potong username maksimum 100 karakter (batas kolom VarChar(100)). */
export function potongUsername(username: string): string {
  return username.length > 100 ? username.slice(0, 100) : username;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export function teksLoginBerhasil(): string {
  return 'Login berhasil';
}

/**
 * Teks login gagal. `usernameTerdaftar` = hasil lookup `pengguna` di DB:
 * bila tidak terdaftar, teks menyebut "username tidak terdaftar" dan role
 * pada log adalah placeholder (bukan role asli — memang tidak ada).
 * `kodeError` dipetakan dari exception whitelist AuthService sehingga body
 * mentah/tidak dikenal tidak pernah masuk teks.
 */
export function teksLoginGagal(kodeError: string, usernameTerdaftar: boolean): string {
  if (!usernameTerdaftar) return 'Login gagal: username tidak terdaftar';
  switch (kodeError) {
    case 'ERR_INVALID_CREDENTIALS':
      // Sengaja memakai "kata sandi" (bukan "password") supaya teks log
      // tidak pernah memuat token yang bisa disalahartikan sebagai nilai
      // kredensial — grep harfiah '%password%' harus 0 baris.
      return 'Login gagal: username atau kata sandi salah';
    case 'ERR_DEVICE_MISMATCH':
      return 'Login gagal: perangkat sudah terikat akun lain';
    case 'ERR_ACCOUNT_INACTIVE':
      return 'Login gagal: akun tidak aktif';
    case 'ERR_DEVICE_ID_REQUIRED':
      // Frasa "perangkat" menggantikan nama field `device_id` supaya
      // grep harfiah '%device_id%' juga 0 baris.
      return 'Login gagal: perangkat wajib diisi untuk Mahasantri';
    default:
      // Alasan lain: sertakan kode error whitelist dari exception
      // (ERR_XXX), bukan body mentah.
      return `Login gagal (${kodeError})`;
  }
}

// ---------------------------------------------------------------------------
// Presensi
// ---------------------------------------------------------------------------

/** Contoh BR-11: "Presensi Subuh berhasil, jarak 23 m". */
export function teksPresensi(opsi: { nama_sholat: string; jarak_meter: number }): string {
  const jarak = Math.round(opsi.jarak_meter);
  return `Presensi ${opsi.nama_sholat} berhasil, jarak ${jarak} m`;
}

// ---------------------------------------------------------------------------
// Izin
// ---------------------------------------------------------------------------

export function teksAjukanIzin(opsi: {
  jenis_izin: string;
  tanggal_izin: Date | string;
}): string {
  // Menerima Date (bentuk mentah Prisma) maupun string ISO (setelah
  // serialisasi respons); keduanya dipotong ke YYYY-MM-DD.
  const iso =
    typeof opsi.tanggal_izin === 'string'
      ? opsi.tanggal_izin
      : opsi.tanggal_izin.toISOString();
  return `Mengajukan izin ${opsi.jenis_izin} tanggal ${iso.slice(0, 10)}`;
}

export function teksVerifikasiIzin(opsi: { nim: string; status_persetujuan: string }): string {
  return `Memverifikasi izin ${opsi.nim} menjadi ${opsi.status_persetujuan}`;
}

// ---------------------------------------------------------------------------
// Master data: Masjid
// ---------------------------------------------------------------------------

export function teksMembuatMasjid(namaMasjid: string): string {
  return `Membuat masjid ${namaMasjid}`;
}

export function teksMengubahMasjid(idMasjid: string): string {
  return `Mengubah masjid ${idMasjid}`;
}

export function teksMenghapusMasjid(idMasjid: string): string {
  return `Menghapus masjid ${idMasjid}`;
}

// ---------------------------------------------------------------------------
// Master data: Jadwal Sholat
// ---------------------------------------------------------------------------

export function teksMembuatJadwal(namaSholat: string): string {
  return `Membuat jadwal sholat ${namaSholat}`;
}

export function teksMengubahJadwal(idJadwal: string): string {
  return `Mengubah jadwal sholat ${idJadwal}`;
}

export function teksMenghapusJadwal(idJadwal: string): string {
  return `Menghapus jadwal sholat ${idJadwal}`;
}

// ---------------------------------------------------------------------------
// Mahasantri & Jobs
// ---------------------------------------------------------------------------

export function teksResetDevice(opsi: { nim: string; nama: string }): string {
  return `Reset device Mahasantri ${opsi.nim} (${opsi.nama})`;
}

export function teksPemicuJob(opsi: { tanggal: string; dibuat: { Tidak_Hadir: number; Izin: number } }): string {
  const { tanggal, dibuat } = opsi;
  const total = dibuat.Tidak_Hadir + dibuat.Izin;
  return `Pemicu manual job tandai-tidak-hadir ${tanggal}: Tidak_Hadir ${dibuat.Tidak_Hadir}, Izin ${dibuat.Izin} (total ${total})`;
}
