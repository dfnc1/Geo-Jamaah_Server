# Business Rules - Geo-Jamaah_Server

## BR-01 Geofencing
- Presensi diterima hanya jika jarak Haversine antara (latitude_user, longitude_user) dan Masjid <= `radius_toleransi` (meter).
- Perhitungan dilakukan di server. Frontend hanya mengirim koordinat mentah.
- Jika melebihi radius: 400 `ERR_GEOFENCE_RADIUS_EXCEEDED`.

## BR-02 Window Time
- Presensi diterima hanya jika jam server (zona waktu Asia/Jakarta) berada di antara `waktu_mulai_presensi` dan `waktu_akhir_presensi` pada JadwalSholat terkait.
- Jika di luar window: 400 `ERR_TIME_WINDOW_INVALID`.
- Jam yang dipakai selalu jam server, bukan jam dari HP.

## BR-03 Proteksi Double Presensi
- Satu Mahasantri hanya boleh punya 1 presensi per `id_jadwal` per `tanggal`.
- Dijaga di database lewat `@@unique([nim, id_jadwal, tanggal])`.
- Jika duplikat: 409 `ERR_ALREADY_PRESENT`.

## BR-04 Anti-Fake GPS
- Request presensi wajib menyertakan `is_mock_location` dan `akurasi_meter`.
- Jika `is_mock_location = true`: 400 `ERR_MOCK_LOCATION`.
- Jika `akurasi_meter` > 50: 400 `ERR_GPS_ACCURACY_LOW`.
- `device_id` terikat ke satu akun. Login dari device lain pada akun yang sudah terikat ditolak (401 `ERR_DEVICE_MISMATCH`).
- Nilai `is_mock_location` dan `akurasi_meter` disimpan di Presensi untuk audit.

## BR-05 Status Tidak_Hadir (otomatis)
- Jika `waktu_akhir_presensi` sebuah shalat lewat dan Mahasantri aktif tidak punya presensi pada jadwal itu, sistem membuat Presensi dengan status `Tidak_Hadir`.
- Dijalankan oleh scheduled job (`@nestjs/schedule`), tidak ada interaksi user.
- Jika pada tanggal itu ada Izin berstatus `Disetujui`, status yang dibuat adalah `Izin`, bukan `Tidak_Hadir`.
- Hanya Mahasantri dengan `status_aktif = true` yang diproses.

## BR-06 Pengajuan Izin
- Mahasantri mengajukan izin dengan `jenis_izin`, `tanggal_izin`, `alasan`, dan `bukti_lampiran` (opsional).
- `id_musyrif` diisi otomatis dari Musyrif pembina Mahasantri tersebut.
- Status awal selalu `Pending`.
- Hanya Musyrif pembina yang bersangkutan yang boleh memverifikasi (403 jika bukan).

## BR-07 State Machine Izin
- `Pending -> Disetujui`
- `Pending -> Ditolak`
- Izin yang sudah `Disetujui` atau `Ditolak` tidak dapat diubah lagi (409 `ERR_IZIN_ALREADY_DECIDED`).

## BR-08 Early Warning System (EWS)
Mahasantri berkategori `KRITIS` jika memenuhi salah satu:
1. Rasio kehadiran < 75%.
2. Status `Tidak_Hadir` 3 kali berturut-turut (streak alpha).

Aturan perhitungan:
- Rasio = jumlah `Hadir` / (jumlah jadwal terhitung - jumlah `Izin`).
- Presensi berstatus `Izin` tidak dihitung sebagai ketidakhadiran.
- Status `Manual` dihitung sebagai hadir.
- Periode perhitungan: ditentukan di konfigurasi (default 30 hari terakhir).
- Streak dihitung berdasarkan urutan jadwal shalat secara kronologis.
- Musyrif hanya melihat Mahasantri binaannya.

## BR-09 Hak Akses
| Aksi | Mahasantri | Musyrif | Admin |
|---|---|---|---|
| Login | ya | ya | ya |
| Presensi | ya | - | - |
| Ajukan izin | ya | - | - |
| Verifikasi izin | - | ya | - |
| Lihat santri kritis | - | ya | - |
| CRUD Masjid & Jadwal | - | - | ya |

## BR-10 Keamanan
- Password di-hash dengan bcrypt.
- Autentikasi JWT via header `Authorization: Bearer <token>`, masa berlaku 7 hari. Refresh token belum dipakai.
- Role dicek dengan `@Roles()` dan `RolesGuard`.
- Lampiran izin disimpan di MinIO, hanya object key yang disimpan di database. File diakses lewat presigned URL.

## Catatan Teknis
- Zona waktu operasional: Asia/Jakarta (WIB).
- Semua waktu shalat disimpan sebagai string "HH:mm".
- Hard delete dipakai, kecuali Mahasantri yang cukup dinonaktifkan lewat `status_aktif`.