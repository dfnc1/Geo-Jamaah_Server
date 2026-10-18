# Frontend Guide - Geo-Jamaah_Server

Panduan singkat untuk tim frontend: cara memanggil API, format respons, autentikasi, dan status kesiapan tiap endpoint.

- Base URL: `http://localhost:3000` (sesuaikan `PORT` di `.env`)
- Semua endpoint berada di bawah prefix `/v1`
- Swagger interaktif: `http://localhost:3000/docs`
- Kontrak lengkap: [`API_CONTRACT.md`](./API_CONTRACT.md)

## Status Endpoint

Legenda: 🟢 **Siap** = sudah ada di kode dan teruji. ⚪ **Rencana** = belum diimplementasikan, jangan dipanggil.

| Method | Endpoint | Akses | Status |
|---|---|---|---|
| `POST` | `/v1/auth/login` | Public | 🟢 Siap |
| `POST` | `/v1/admin/masjid` | Admin | 🟢 Siap |
| `GET` | `/v1/admin/masjid` | Admin | 🟢 Siap |
| `GET` | `/v1/admin/masjid/:id_masjid` | Admin | 🟢 Siap |
| `PATCH` | `/v1/admin/masjid/:id_masjid` | Admin | 🟢 Siap |
| `DELETE` | `/v1/admin/masjid/:id_masjid` | Admin | 🟢 Siap |
| `POST` | `/v1/admin/jadwal-sholat` | Admin | 🟢 Siap |
| `GET` | `/v1/admin/jadwal-sholat` | Admin | 🟢 Siap |
| `GET` | `/v1/admin/jadwal-sholat/:id_jadwal` | Admin | 🟢 Siap |
| `PATCH` | `/v1/admin/jadwal-sholat/:id_jadwal` | Admin | 🟢 Siap |
| `DELETE` | `/v1/admin/jadwal-sholat/:id_jadwal` | Admin | 🟢 Siap |
| `POST` | `/v1/admin/mahasantri/:nim/reset-device` | Admin | 🟢 Siap |
| `POST` | `/v1/presensi` | Mahasantri | 🟢 Siap |
| `GET` | `/v1/presensi/hari-ini` | Mahasantri | ⚪ Rencana (tahap 6) |
| `GET` | `/v1/presensi/riwayat` | Mahasantri | ⚪ Rencana (tahap 6) |
| `POST` | `/v1/izin` | Mahasantri | 🟢 Siap (tahap 7) |
| `GET` | `/v1/izin/saya` | Mahasantri | 🟢 Siap (tahap 7) |
| `POST` | `/v1/izin/lampiran` | Mahasantri | ⚪ Rencana (upload MinIO) |
| `GET` | `/v1/musyrif/izin?status=Pending` | Musyrif | 🟢 Siap (tahap 7) |
| `PATCH` | `/v1/musyrif/izin/:id_izin/verify` | Musyrif | 🟢 Siap (tahap 7) |
| `GET` | `/v1/musyrif/dss/santri-kritis` | Musyrif | ⚪ Rencana (tahap 10) |
| `GET` | `/v1/admin/activity-logs` | Admin | ⚪ Rencana (tahap 11) |
| `GET` | `/v1/admin/rekap` | Admin | ⚪ Rencana (tahap 12) |

## Format Respons

Semua respons dibungkus interceptor, jadi bentuknya seragam.

Sukses:
```json
{ "success": true, "statusCode": 200, "message": "Operasi berhasil", "data": {} }
```
`data` berisi payload yang sebenarnya (objek, array, atau `null`). `message` bisa berisi teks lebih spesifik tergantung endpoint.

Gagal:
```json
{ "success": false, "statusCode": 404, "message": "Masjid tidak ditemukan", "error": "ERR_MASJID_NOT_FOUND" }
```
Baca `error` untuk menentukan penanganan; `message` untuk ditampilkan ke user.

### Kode Error yang Perlu Dihadapi

| `error` | HTTP | Penanganan di frontend |
|---|---|---|
| `ERR_VALIDATION` | 400 | Tampilkan `message` (sudah berisi daftar field yang gagal) |
| `ERR_DEVICE_ID_REQUIRED` | 400 | Login Mahasantri tanpa `device_id`; kirim identitas perangkat |
| `ERR_MOCK_LOCATION` | 400 | Lokasi dari mock/Fake GPS; minta user mematikan mock GPS |
| `ERR_GPS_ACCURACY_LOW` | 400 | Akurasi GPS > 50 m; minta user pindah ke tempat terbuka lalu coba lagi |
| `ERR_TIME_WINDOW_INVALID` | 400 | Di luar window presensi jadwal; tampilkan jadwal window yang benar |
| `ERR_GEOFENCE_RADIUS_EXCEEDED` | 400 | User di luar radius masjid; `message` berisi jarak aktual |
| `ERR_UNAUTHORIZED` | 401 | Token tidak ada/salah/kedaluwarsa → arahkan ke login |
| `ERR_INVALID_CREDENTIALS` | 401 | Username atau password salah |
| `ERR_DEVICE_MISMATCH` | 401 | Akun terikat perangkat lain → minta Admin melakukan reset device |
| `ERR_ACCOUNT_INACTIVE` | 403 | Akun Mahasantri dinonaktifkan |
| `ERR_FORBIDDEN_ROLE` | 403 | Role login tidak punya akses ke endpoint itu |
| `ERR_NOT_YOUR_STUDENT` | 403 | Musyrif mencoba memverifikasi izin santri yang bukan binaannya |
| `ERR_MASJID_NOT_FOUND` | 404 | Data masjid tidak ada |
| `ERR_JADWAL_NOT_FOUND` | 404 | Data jadwal sholat tidak ada |
| `ERR_MAHASANTRI_NOT_FOUND` | 404 | NIM tidak terdaftar |
| `ERR_MUSYRIF_NOT_FOUND` | 404 | Token Musyrif tapi profil musyrif tidak ada di database |
| `ERR_IZIN_NOT_FOUND` | 404 | ID izin tidak ada |
| `ERR_IN_USE` | 409 | Masjid/jadwal masih dipakai presensi, tidak bisa dihapus |
| `ERR_ALREADY_PRESENT` | 409 | Sudah presensi untuk jadwal yang sama hari ini |
| `ERR_IZIN_ALREADY_DECIDED` | 409 | Izin sudah pernah diputuskan (state final), klik/kirim ulang tidak mengubah apa pun |
| `ERR_TOO_MANY_REQUESTS` | 429 | Melewati rate limit → tunggu lalu coba lagi |
| `ERR_INTERNAL` | 500 | Gangguan server → laporkan/coba lagi |

## Autentikasi

1. Login sekali untuk mendapat token:
   ```bash
   curl -X POST http://localhost:3000/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"mahasantri1","password":"12345678","device_id":"dev-a1b2c3"}'
   ```
2. Simpan `data.access_token`, lalu kirim di setiap request:
   ```
   Authorization: Bearer <access_token>
   ```
3. Token memakai masa berlaku dari `JWT_EXPIRES_IN` (default `7d`). Saat kedaluwarsa server membalas 401; arahkan user ke login ulang. Refresh token belum tersedia.

### Login Per Role

| Role | Kirim `device_id`? | `data.user.profil` |
|---|---|---|
| Mahasantri | **Wajib** — tanpa ini dibalas 400 `ERR_DEVICE_ID_REQUIRED` | objek `{ nim, nama, kamar, status_aktif, musyrif }` |
| Musyrif | Tidak perlu (diabaikan) | objek `{ id_musyrif, nama, no_telepon }` |
| Admin | Tidak perlu (diabaikan) | `null` |

### Device Binding (khusus Mahasantri)

- Perangkat pertama yang berhasil login mengikat akun (`device_id` disimpan di server).
- Login dari perangkat lain pada akun yang sudah terikat dibalas 401 `ERR_DEVICE_MISMATCH`.
- Untuk pindah perangkat, Admin memanggil `POST /v1/admin/mahasantri/:nim/reset-device`; setelah itu login dari perangkat baru otomatis mengikat perangkat baru.
- `device_id` harus unik antar akun. Kalau device milik akun lain, server membalas `ERR_DEVICE_MISMATCH`.

## Rate Limit

| Endpoint | Batas | Saat dilanggar |
|---|---|---|
| Semua endpoint | 100 request / 60 detik / IP | 429 `ERR_TOO_MANY_REQUESTS` |
| `POST /v1/auth/login` | 5 percobaan / 60 detik / IP | 429 `ERR_TOO_MANY_REQUESTS` |

Batas memakai penanda `default` dengan penyimpanan in-memory, jadi reset saat server restart.

## Catatan Master Data Admin

Semua endpoint `/v1/admin/*` hanya untuk role Admin (selain itu 403 `ERR_FORBIDDEN_ROLE`).

- **Masjid** — `nama_masjid` wajib (maks 150, bukan hanya spasi), `latitude` -90..90, `longitude` -180..180, `radius_toleransi` > 0 (meter).
- **Jadwal Sholat** — `nama_sholat` wajib. Semua waktu wajib format `HH:mm` (24 jam, contoh `04:30`). `waktu_mulai_presensi` harus lebih kecil dari `waktu_akhir_presensi`. Aturan ini dievaluasi terhadap nilai gabungan dengan data tersimpan, jadi PATCH sebagian (hanya mengirim satu field waktu) tetap aman.
- **PATCH** memakai `PartialType`: field yang tidak dikirim tetap seperti semula. Mengirim `null` ditolak 400.
- **DELETE** bersifat hard delete, tapi ditolak 409 `ERR_IN_USE` bila masih dipakai data presensi. Saat fitur presensi sudah ada, jangan andalkan keberhasilan hapus tanpa menangani 409.
- `whitelist` validasi aktif: field yang tidak dikenal di body dibuang diam-diam, bukan error.
- Semua waktu shalat disimpan sebagai string `HH:mm` dalam WIB.

## Catatan Presensi (`POST /v1/presensi`)

- Hanya role Mahasantri. Kirim token; `nim` diambil dari token, tidak usah dimasukkan ke body.
- Body wajib lengkap: `id_jadwal`, `id_masjid`, `latitude_user`, `longitude_user`, `akurasi_meter` (≥ 0), `is_mock_location` (boolean). Ambil koordinat dari Geolocation API (`getCurrentPosition`/`watchPosition`) beserta `accuracy` dan `fakeGps` (Android: `isFromMockProvider`) lalu kirim apa adanya — semua pengecekan di server.
- Urutan penolakan server: mock location → akurasi > 50 m → jadwal/masjid tidak ada (404) → di luar jam presensi → di luar radius → dobel (409). Karena urut, kalau GPS palsu Anda tidak akan pernah tahu jarak/radiusnya.
- Jam presensi memakai **jam server WIB**, bukan jam HP — jangan pernah membandingkan waktu sendiri di frontend untuk menentukan boleh presensi atau tidak; biarkan server yang menolak.
- Respons sukses 201: `{ "status_presensi": "Hadir", "jarak_meter": 55.6 }`. `jarak_meter` dibulatkan 2 desimal, boleh ditampilkan sebagai bukti jarak; tidak dikirim balik ke server.
- Satu presensi per jadwal per hari. Kalau user menekan tombol dua kali dan mendapat 409 `ERR_ALREADY_PRESENT`, anggap sebagai sukses (presensi pertama sudah tercatat).

## Catatan Izin (`POST /v1/izin`, `GET /v1/izin/saya`, `GET /v1/musyrif/izin`, `PATCH /v1/musyrif/izin/:id_izin/verify`)

- **Ajukan (Mahasantri)** — kirim `jenis_izin` (`Sakit` | `Pulang` | `Tugas_Kampus`), `tanggal_izin` format `YYYY-MM-DD` (tanggal kalender valid; lampau diizinkan), `alasan` wajib maks 500 karakter. `bukti_lampiran` opsional string (object key, maks 255) — kirim saja tidak ada, `null` eksplisit ditolak 400. `id_musyrif` dan status `Pending` diisi server; jangan kirim `status_persetujuan` (dibuang whitelist).
- **Respons `tanggal_izin`** selalu ISO datetime tengah-malam UTC (mis. `2026-10-05T00:00:00.000Z`); tampilkan 10 karakter pertamanya (`.slice(0, 10)`).
- **Daftar sendiri** — `GET /v1/izin/saya` mengurutkan terbaru dulu (`tanggal_izin` menurun).
- **Musyrif** — `GET /v1/musyrif/izin` hanya menampilkan izin santri binaan dan menyertakan `nama_mahasantri`; respons Mahasantri tidak punya field itu. Filter `?status=Pending|Disetujui|Ditolak` opsional; nilai lain → 400.
- **Verifikasi** — hanya `Disetujui`/`Ditolak` (kirim `Pending` → 400). Urutan respons: 404 `ERR_IZIN_NOT_FOUND` (ID tak ada) → 403 `ERR_NOT_YOUR_STUDENT` (bukan pembina) → 409 `ERR_IZIN_ALREADY_DECIDED` (sudah diputuskan).
- **Setelah keputusan, izin final** — tombol verifikasi matikan di UI setelah 200. Dua klik/dua request bersamaan tidak merusak apa pun: server hanya mengizinkan perubahan lewat update bersyarat pada status `Pending`, jadi hanya satu yang menang; sisanya 409. Bila mendapat 409, refresh daftar — status sebenarnya sudah berubah.
- **Belum ada upload lampiran** — `POST /v1/izin/lampiran` (MinIO) masih rencana; endpoint `POST /v1/izin` tidak menerima file/multipart, hanya string object key.
