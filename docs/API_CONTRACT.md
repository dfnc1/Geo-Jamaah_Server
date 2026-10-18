# API Contract - Geo-Jamaah_Server

Base path: `/v1`. Dokumentasi Swagger interaktif: `/docs` (dan `/docs-json` untuk spek OpenAPI mentah). Kedua path ini dikecualikan dari prefix global, jadi tidak menjadi `/v1/docs`.

Status: ✅ = sudah ada di kode dan teruji, 📋 = rencana (belum diimplementasikan).

## Format Response

Sukses:
```json
{ "success": true, "statusCode": 200, "message": "...", "data": {} }
```
Error:
```json
{ "success": false, "statusCode": 400, "message": "...", "error": "ERR_CODE" }
```

### Kode Error Umum
| Kode | HTTP | Kapan |
|---|---|---|
| `ERR_VALIDATION` | 400 | Body gagal validasi (`whitelist` aktif: field tak dikenal dibuang) |
| `ERR_UNAUTHORIZED` | 401 | Token tidak ada, tidak sah, atau kedaluwarsa |
| `ERR_FORBIDDEN_ROLE` | 403 | Token sah tetapi role tidak diizinkan `@Roles()` |
| `ERR_TOO_MANY_REQUESTS` | 429 | Melewati batas rate limit |
| `ERR_INTERNAL` | 500 | Error tak terduga di server |

### Autentikasi
Kirim token di header: `Authorization: Bearer <access_token>`.

### Rate Limit
- Global: `THROTTLE_GLOBAL_LIMIT` request per 60 detik per IP — default **600**.
- Login: `THROTTLE_LOGIN_LIMIT` percobaan per 60 detik per IP — default **20** (lebih ketat).
- Nilai env harus bilangan bulat > 0; selain itu memakai default plus `Logger.warn` di log server. TTL tetap 60 detik (tidak bisa dioverride).

---

# Endpoint yang Sudah Diimplementasikan

## 1. ✅ POST /v1/auth/login
- Akses: Public (`@Public()`, tetap kena rate limit)
- Body:
  ```json
  { "username": "ahmad_fauzi", "password": "rahasia123", "device_id": "dev-a1b2c3" }
  ```
  - `username`, `password`: wajib (maks 100 karakter).
  - `device_id`: **wajib hanya untuk role Mahasantri**, diabaikan untuk Musyrif dan Admin. Bersifat opsional di schema, tapi di-level service akan ditolak untuk Mahasantri yang belum mengirimnya.
- 201:
  ```json
  {
    "success": true, "statusCode": 201, "message": "Login berhasil",
    "data": {
      "token_type": "Bearer",
      "access_token": "eyJhbGciOiJIUzI1NiIs...",
      "user": {
        "id_pengguna": "uuid-pengguna",
        "username": "ahmad_fauzi",
        "role": "Mahasantri",
        "profil": {
          "nim": "24050505050", "nama": "Ahmad Fauzi", "kamar": "A-12",
          "status_aktif": true, "musyrif": { "id_musyrif": "uuid-musyrif", "nama": "Ustadz Abdul Rahman" }
        }
      }
    }
  }
  ```
- Bentuk `user.profil` tergantung role: `Mahasantri` (role Mahasantri), `Musyrif` (role Musyrif), atau `null` (role Admin).
- Device binding hanya untuk Mahasantri: `device_id` pertama yang berhasil login disimpan ke akun. Percobaan login dari perangkat lain pada akun yang sudah terikat ditolak `ERR_DEVICE_MISMATCH`.
- Error:
  - 400 `ERR_VALIDATION` — body tidak lolos validasi
  - 400 `ERR_DEVICE_ID_REQUIRED` — role Mahasantri tanpa `device_id`
  - 401 `ERR_INVALID_CREDENTIALS` — username tidak ada atau password salah (waktu respons sengaja disamakan lewat hash bcrypt palsu)
  - 401 `ERR_DEVICE_MISMATCH` — akun/perangkat sudah terikat ke perangkat atau akun lain
  - 403 `ERR_ACCOUNT_INACTIVE` — Mahasantri dengan `status_aktif = false`
  - 429 `ERR_TOO_MANY_REQUESTS` — melewati `THROTTLE_LOGIN_LIMIT` percobaan per menit per IP (default 20)
- **Activity log (BR-11)** — endpoint ini adalah satu-satunya aksi yang juga **dicatat saat gagal**; aksi lain hanya dicatat saat sukses. Dicatat oleh interceptor global, teksnya dibentuk fungsi murni, bukan body mentah, dan **tidak pernah memuat nilai password/token/`device_id`**:
  - Sukses → `Login berhasil` dengan role asli dari token.
  - 401 `ERR_INVALID_CREDENTIALS` → `Login gagal: username atau kata sandi salah` (username diambil dari body, **dipotong maks 100 karakter**); bila username tak terdaftar → `Login gagal: username tidak terdaftar`.
  - 400 `ERR_DEVICE_ID_REQUIRED` → `Login gagal: perangkat wajib diisi untuk Mahasantri`
  - 401 `ERR_DEVICE_MISMATCH` → `Login gagal: perangkat sudah terikat akun lain`
  - 403 `ERR_ACCOUNT_INACTIVE` → `Login gagal: akun tidak aktif`
  - Lainnya (mis. 400 `ERR_VALIDATION`) → `Login gagal (<kode error>)`
  - **Catatan keputusan**: untuk username yang tidak terdaftar, kolom `role` diisi **placeholder `Mahasantri`** — hanya penanda karena role asli memang tidak ada (1 query lookup `pengguna` by username dipakai untuk role asli pada kasus lainnya). Gagal karena throttler/401 JWT tidak dicatat (terjadi di luar handler, sebelum interceptor).

---

## 2. ✅ POST /v1/admin/masjid
- Akses: Admin
- Body:
  ```json
  { "nama_masjid": "Masjid Al-Ikhlas", "latitude": -7.9666, "longitude": 112.6326, "radius_toleransi": 100 }
  ```
- Validasi: `nama_masjid` wajib (maks 150, tidak boleh hanya spasi), `latitude` -90..90, `longitude` -180..180, `radius_toleransi` > 0 (meter).
- 201: `data` = `{ id_masjid, nama_masjid, latitude, longitude, radius_toleransi }`
- Error: 400 `ERR_VALIDATION`, 401, 403

## 3. ✅ GET /v1/admin/masjid
- Akses: Admin
- 200: `data` = array masjid, diurutkan berdasarkan nama.

## 4. ✅ GET /v1/admin/masjid/:id_masjid
- Akses: Admin
- 200: `data` = satu masjid.
- Error: 404 `ERR_MASJID_NOT_FOUND`

## 5. ✅ PATCH /v1/admin/masjid/:id_masjid
- Akses: Admin
- Body: semua field opsional (PATCH). Field yang tidak dikirim tetap seperti semula. Nilai `null` ditolak.
- 200: `data` = masjid terbaru.
- Error: 400 `ERR_VALIDATION`, 404 `ERR_MASJID_NOT_FOUND`

## 6. ✅ DELETE /v1/admin/masjid/:id_masjid
- Akses: Admin. Hard delete.
- 200: `data` = `{ "id_masjid": "uuid" }`
- Error:
  - 404 `ERR_MASJID_NOT_FOUND`
  - 409 `ERR_IN_USE` — masih dipakai oleh data presensi

---

## 7. ✅ POST /v1/admin/jadwal-sholat
- Akses: Admin
- Body:
  ```json
  {
    "nama_sholat": "Subuh", "waktu_azan": "04:30", "waktu_iqamah": "04:45",
    "waktu_mulai_presensi": "04:15", "waktu_akhir_presensi": "05:10"
  }
  ```
- Validasi: `nama_sholat` wajib (maks 50, tidak boleh hanya spasi). Semua waktu wajib berformat `HH:mm` (24 jam). `waktu_mulai_presensi` < `waktu_akhir_presensi`.
- 201: `data` = `{ id_jadwal, nama_sholat, waktu_azan, waktu_iqamah, waktu_mulai_presensi, waktu_akhir_presensi }`
- Error: 400 `ERR_VALIDATION`, 401, 403

## 8. ✅ GET /v1/admin/jadwal-sholat
- Akses: Admin
- 200: `data` = array jadwal, diurutkan berdasarkan jam azan.

## 9. ✅ GET /v1/admin/jadwal-sholat/:id_jadwal
- Akses: Admin
- 200: `data` = satu jadwal.
- Error: 404 `ERR_JADWAL_NOT_FOUND`

## 10. ✅ PATCH /v1/admin/jadwal-sholat/:id_jadwal
- Akses: Admin
- Body: semua field opsional (PATCH). Field yang tidak dikirim memakai nilai tersimpan.
- Aturan window presensi (`mulai` < `akhir`) dievaluasi terhadap nilai **gabungan** dengan data tersimpan, sehingga mengirim salah satu field saja tetap diperiksa dengan benar.
- 200: `data` = jadwal terbaru.
- Error: 400 `ERR_VALIDATION`, 404 `ERR_JADWAL_NOT_FOUND`

## 11. ✅ DELETE /v1/admin/jadwal-sholat/:id_jadwal
- Akses: Admin. Hard delete.
- 200: `data` = `{ "id_jadwal": "uuid" }`
- Error:
  - 404 `ERR_JADWAL_NOT_FOUND`
  - 409 `ERR_IN_USE` — masih dipakai oleh data presensi

---

## 12. ✅ POST /v1/admin/mahasantri/:nim/reset-device
- Akses: Admin (BR-09; hak akses Musyrif untuk santri binaannya masih dipertimbangkan di backlog)
- Param: `nim` (NIM Mahasantri)
- Efek: `device_id` pengguna milik Mahasantri tersebut di-set `null`, sehingga akun bisa diikat ulang ke perangkat baru. Idempoten: mengulang reset pada akun yang belum terikat tetap berhasil.
- 200:
  ```json
  {
    "success": true, "statusCode": 200, "message": "Device ID berhasil direset",
    "data": { "nim": "24050505050", "nama": "Ahmad Fauzi", "username": "mahasantri1", "device_id": null }
  }
  ```
- Setelah reset, login berikutnya dari perangkat baru mengikat `device_id` baru.
- Error: 401, 403, 404 `ERR_MAHASANTRI_NOT_FOUND`

---

## ✅ POST /v1/presensi
- Akses: Mahasantri (`@Roles(Role.Mahasantri)`). `nim` diambil dari token (klaim `sub` → profil Mahasantri), bukan dari body.
- Body:
  ```json
  {
    "id_jadwal": "uuid",
    "id_masjid": "uuid",
    "latitude_user": -7.9671,
    "longitude_user": 112.6326,
    "akurasi_meter": 12.5,
    "is_mock_location": false
  }
  ```
- Validasi body: `latitude_user` -90..90, `longitude_user` -180..180, `akurasi_meter` **wajib** angka ≥ 0, `is_mock_location` **wajib** boolean, `id_jadwal`/`id_masjid` wajib UUID.
- Urutan validasi bisnis di server:
  1. `is_mock_location = true` → 400 `ERR_MOCK_LOCATION`
  2. `akurasi_meter` > 50 → 400 `ERR_GPS_ACCURACY_LOW` (tepat 50 masih diterima)
  3. jadwal/masjid tidak ada → 404 `ERR_JADWAL_NOT_FOUND` / `ERR_MASJID_NOT_FOUND`
  4. jam server WIB di luar window → 400 `ERR_TIME_WINDOW_INVALID`. **Batas inklusif**: tepat di `waktu_mulai_presensi` dan tepat di `waktu_akhir_presensi` diterima. Jam yang dipakai selalu jam server (zona Asia/Jakarta), bukan jam HP.
  5. jarak Haversine user ↔ masjid > `radius_toleransi` → 400 `ERR_GEOFENCE_RADIUS_EXCEEDED` (jarak tepat sama dengan radius diterima)
  6. disimpan dengan status `Hadir`; presensi ganda per jadwal per hari ditolak 409 `ERR_ALREADY_PRESENT` (unique constraint `@@unique([nim, id_jadwal, tanggal])`, aman terhadap race condition)
- `tanggal` dihitung dari tanggal WIB saat ini.
- 201: `{ "status_presensi": "Hadir", "nama_sholat": "Subuh", "jarak_meter": 55.6 }`
  - `jarak_meter` = jarak Haversine dalam meter, dibulatkan 2 desimal (hanya untuk response; tidak disimpan ke database).
  - `nama_sholat` = nama jadwal terkait (field **tambahan / additive** sejak tahap 11, dipakai untuk teks activity log `Presensi <nama> berhasil, jarak <n> m` tanpa query tambahan).
- Error: 400 (`ERR_VALIDATION`, `ERR_MOCK_LOCATION`, `ERR_GPS_ACCURACY_LOW`, `ERR_TIME_WINDOW_INVALID`, `ERR_GEOFENCE_RADIUS_EXCEEDED`), 401, 403, 404 (`ERR_JADWAL_NOT_FOUND` / `ERR_MASJID_NOT_FOUND` / `ERR_MAHASANTRI_NOT_FOUND`), 409 `ERR_ALREADY_PRESENT`

---

## ✅ POST /v1/izin
- Akses: Mahasantri (`@Roles(Role.Mahasantri)`). `nim` dan `id_musyrif` diambil dari profil Mahasantri (klaim `sub` → profil), bukan dari body.
- Body:
  ```json
  {
    "jenis_izin": "Sakit | Pulang | Tugas_Kampus",
    "tanggal_izin": "2026-10-05",
    "alasan": "Sakit demam, sudah ke puskesmas",
    "bukti_lampiran": "izin/24050505050/2026-10-05.jpg"
  }
  ```
- Validasi body:
  - `jenis_izin` wajib, salah satu dari enum `JenisIzin` (`Sakit`, `Pulang`, `Tugas_Kampus`).
  - `tanggal_izin` wajib, format ketat `YYYY-MM-DD` dan harus tanggal kalender valid (`2026-02-30` → 400). **Tanggal lampau diizinkan** (izin menyusul).
  - `alasan` wajib (tidak boleh kosong/spasi saja), maksimal **500** karakter.
  - `bukti_lampiran` opsional; string (object key) maksimal **255** karakter. Tidak dikirim = tanpa lampiran; `null` eksplisit → 400. Upload file (MinIO) masih rencana (`POST /v1/izin/lampiran`).
  - Field lain (mis. `status_persetujuan`, `id_musyrif`) **dibuang** oleh whitelist DTO.
- `id_musyrif` diisi **otomatis** dari Musyrif pembina profil Mahasantri; status awal **selalu `Pending`**.
- 201: pengajuan izin tercatat, respons field polos:
  ```json
  { "id_izin": "uuid", "nim": "24050505050", "jenis_izin": "Sakit", "tanggal_izin": "2026-10-05T00:00:00.000Z", "alasan": "...", "bukti_lampiran": null, "status_persetujuan": "Pending" }
  ```
  - `tanggal_izin` disimpan & dikembalikan sebagai Date tengah-malam UTC (= tanggal WIB); frontend pakai 10 karakter pertama (`.slice(0, 10)`) untuk menampilkan `YYYY-MM-DD`.
- Error: 400 `ERR_VALIDATION`, 401 `ERR_UNAUTHORIZED`, 403 `ERR_FORBIDDEN_ROLE`, 404 `ERR_MAHASANTRI_NOT_FOUND`

## ✅ GET /v1/izin/saya
- Akses: Mahasantri. Daftar izin milik sendiri.
- Query: tidak ada.
- Urutan: **terbaru dulu** — `tanggal_izin` menurun, seri `id_izin` menurun.
- 200: array berisi bentuk data polos yang sama seperti respons `POST /v1/izin` (tanpa `nama_mahasantri`).
- Error: 401, 403, 404 `ERR_MAHASANTRI_NOT_FOUND`

## ✅ GET /v1/musyrif/izin
- Akses: Musyrif (`@Roles(Role.Musyrif)`). Hanya menampilkan izin milik mahasantri **binaannya**.
- Query: `status` (opsional: `Pending` | `Disetujui` | `Ditolak`; kosongkan untuk semua). Nilai lain → 400 `ERR_VALIDATION`.
- Urutan: terbaru dulu (`tanggal_izin` menurun, seri `id_izin` menurun).
- 200: array field izin + `nama_mahasantri`:
  ```json
  [{ "id_izin": "uuid", "nim": "24050505050", "jenis_izin": "Sakit", "tanggal_izin": "2026-10-17T00:00:00.000Z", "alasan": "...", "bukti_lampiran": null, "status_persetujuan": "Pending", "nama_mahasantri": "santri_satu" }]
  ```
- Error: 400 `ERR_VALIDATION`, 401, 403 `ERR_FORBIDDEN_ROLE`, 404 `ERR_MUSYRIF_NOT_FOUND` (token Musyrif tanpa profil — defensif)

## ✅ PATCH /v1/musyrif/izin/:id_izin/verify
- Akses: Musyrif pembina dari mahasantri pengaju (bukan pembina → 403 `ERR_NOT_YOUR_STUDENT`).
- Param: `id_izin` wajib UUID (bukan UUID → 400 `ERR_VALIDATION`).
- Body: `{ "status_persetujuan": "Disetujui | Ditolak" }` — `Pending` ditolak (400) karena verify = memutuskan.
- State machine (BR-07): `Pending → Disetujui | Ditolak`; status final tidak bisa diubah lagi.
- **Aman terhadap race condition**: perubahan memakai `updateMany` dengan syarat `status_persetujuan = 'Pending'` (atomic, bukan cek-lalu-update). Dua verify bersamaan → hanya satu yang berhasil; sisanya 409 (dilempar dari dalam transaksi, jadi rollback).
- **Efek `Disetujui` pada presensi (BR-05/BR-07)**: dalam `$transaction` yang sama, baris `Presensi` `Tidak_Hadir` milik mahasantri pengaju pada `tanggal_izin` diubah menjadi `Izin` — hanya baris itu, `Hadir`/`Manual` tidak disentuh. `Ditolak` tidak mengubah presensi. `tanggal_izin` disimpan sebagai Date tengah-malam UTC, format yang sama dengan `Presensi.tanggal` (`@db.Date`), sehingga kecocokan where-clause presisi pada tanggalnya.
- Urutan pemeriksaan: 404 izin tak ada → 403 bukan pembina → 409 bukan Pending → update bersyarat di transaksi → bila kalah race (count 0, baris masih ada) → 409 dari dalam transaksi.
- 200: data izin terbaru + `nama_mahasantri` (satu kali klik hanya mengubah sekali; klik kedua → 409).
- Error: 400 (`ERR_VALIDATION`), 401, 403 (`ERR_FORBIDDEN_ROLE` / `ERR_NOT_YOUR_STUDENT`), 404 (`ERR_IZIN_NOT_FOUND` / `ERR_MUSYRIF_NOT_FOUND`), 409 `ERR_IZIN_ALREADY_DECIDED`

---

## ✅ POST /v1/admin/jobs/tandai-tidak-hadir
- Akses: Admin (`@Roles(Role.Admin)`). Pemicu manual untuk demo/backfill job penandaan otomatis (BR-05). Job yang sama juga berjalan **otomatis** via cron `@nestjs/schedule` (`* * * * *`, zona Asia/Jakarta): setiap menit, semua JadwalSholat yang `waktu_akhir_presensi`-nya sudah lewat diproses untuk tanggal WIB hari ini — frontend tidak perlu memicu apa pun.
- Body (semua opsional):
  ```json
  { "tanggal": "2026-10-17", "id_jadwal": "uuid" }
  ```
  - `tanggal`: format ketat `YYYY-MM-DD` + tanggal kalender valid; default hari ini WIB; **tidak boleh melebihi hari ini** (400 `ERR_VALIDATION`). Tanggal lampau = backfill (semua jadwal diproses).
  - `id_jadwal`: proses satu jadwal saja; default semua jadwal yang `waktu_akhir_presensi`-nya sudah lewat. Tidak ada → 404 `ERR_JADWAL_NOT_FOUND`; jadwal hari ini yang akhirnya **belum** lewat → 400 `ERR_TIME_WINDOW_INVALID` (tidak pernah menandai santri yang masih bisa presensi).
- Yang diproses: Mahasantri `status_aktif = true` yang **belum punya baris presensi** pada (jadwal, tanggal) — apa pun status barisnya. Baris `Hadir`/`Manual` yang sudah ada **tidak pernah ditimpa atau diduplikat** (insert `skipDuplicates` memanfaatkan `@@unique([nim, id_jadwal, tanggal])`); idempoten — run kedua mengembalikan nol.
- Status yang dibuat: `Izin` bila ada Izin `Disetujui` dengan `tanggal_izin` = tanggal itu; selainnya `Tidak_Hadir` (izin `Pending`/`Ditolak` dianggap tidak ada izin). Santri nonaktif dilewati.
- **Konvensi baris otomatis** (keputusan desain tahap 8): baris tidak memiliki lokasi asli, jadi dibuat dengan `id_masjid` **masjid utama** (pemenang deterministik: `nama_masjid` lalu `id_masjid` menaik), `latitude_user = 0`, `longitude_user = 0`, `akurasi_meter = NULL`, `is_mock_location = false`, `is_manual = false`. Baris otomatis dikenali dari `status_presensi` (`Tidak_Hadir`/`Izin`) — **jangan menampilkan koordinatnya** (0,0 bukan lokasi).
- 200:
  ```json
  { "tanggal": "2026-10-17", "id_jadwal": null, "dibuat": { "Tidak_Hadir": 5, "Izin": 5 }, "total_dibuat": 10 }
  ```
  - `id_jadwal` = UUID yang diproses atau `null` (semua jadwal). `dibuat` = jumlah baris **yang berhasil dibuat** per status.
- Error: 400 (`ERR_VALIDATION`, `ERR_TIME_WINDOW_INVALID`), 401, 403, 404 (`ERR_JADWAL_NOT_FOUND` / `ERR_MASJID_NOT_FOUND` bila tidak ada data masjid — job membutuhkan masjid utama).

---

## ✅ GET /v1/musyrif/dss/santri-kritis
- Akses: Musyrif (`@Roles(Role.Musyrif)`). Hanya Mahasantri **binaan** dengan `status_aktif = true` (BR-08).
- Periode: `DSS_PERIODE_HARI` hari terakhir **termasuk hari ini (WIB)** — default 30; nilai env bukan bilangan bulat > 0 → default + `Logger.warn`.
- Kategori `KRITIS` bila salah satu: (1) rasio kehadiran < 75% — **setelah** pembulatan satu desimal; (2) streak `Tidak_Hadir` ≥ 3 berturut-turut (dihitung mundur dari baris terbaru; `Hadir`/`Manual`/`Izin` memutus; slot tanpa baris tidak memutus).
- Rasio = (`Hadir` + `Manual`) / (jumlah **baris presensi tercatat** dalam periode − `Izin`) × 100, dibulatkan 1 desimal. `Izin` dikeluarkan dari penyebut dan bukan alpha. Tanpa baris / penyebut 0 → rasio tidak dihitung, santri tidak muncul (respons selalu berupa angka).
- Field `jumlah`: `{ hadir, tidak_hadir, izin }` — hitungan per status dari baris dalam periode; `Manual` masuk `hadir`.
- `alasan`: subset urut dari `["rasio", "streak"]` yang memicu kategori; `rekomendasi_tindakan` mengikuti aturan tetap di server (lihat BR-08).
- Urutan respons: `rasio_kehadiran` menaik → `streak_alpha` menurun → `nim` menaik. Bisa `[]`.
- Hanya kolom `status_presensi`, `tanggal`, dan `jadwal.waktu_mulai_presensi` yang dibaca — baris otomatis job (koordinat 0,0 / masjid utama) aman dipakai; koordinat tidak pernah ikut respons.
- 200:
  ```json
  [
    {
      "nim": "24050505050",
      "nama": "Ahmad Fauzi",
      "kategori_risiko": "KRITIS",
      "rasio_kehadiran": 61.5,
      "streak_alpha": 0,
      "jumlah": { "hadir": 8, "tidak_hadir": 5, "izin": 1 },
      "alasan": ["rasio"],
      "rekomendasi_tindakan": "Lakukan pendampingan kehadiran dan bimbingan belajar terjadwal; evaluasi mingguan bersama mahasantri."
    }
  ]
  ```
- Error: 401, 403 `ERR_FORBIDDEN_ROLE`, 404 `ERR_MUSYRIF_NOT_FOUND` (token Musyrif tanpa profil — defensif)

---

## ✅ GET /v1/admin/activity-logs
- Akses: Admin saja (`@Roles(Role.Admin)`); Musyrif/Mahasantri → 403 `ERR_FORBIDDEN_ROLE`, tanpa token → 401. **Read-only** — tidak ada endpoint ubah/hapus (append-only, BR-11). Request GET tidak pernah menciptakan log baru.
- Query (semua opsional):
  | Param | Tipe | Default | Ketentuan |
  |---|---|---|---|
  | `role` | `Mahasantri \\| Musyrif \\| Admin` | — | exact match |
  | `username` | string | — | exact match (bukan substring) |
  | `modul` | `Auth \\| Presensi \\| Izin \\| Masjid \\| Jadwal \\| Mahasantri \\| Jobs` | — | exact match |
  | `from` | `YYYY-MM-DD` | — | `created_at` **≥ awal hari WIB** tanggal itu (17:00 UTC hari sebelumnya) |
  | `to` | `YYYY-MM-DD` | — | `created_at` **≤ akhir hari WIB** tanggal itu (23:59:59.999 WIB) |
  | `page` | int ≥ 1 | `1` | nomor halaman |
  | `limit` | int 1–100 | `20` | ukuran halaman, maksimum **100** |
- Parameter tidak valid (format tanggal salah, `page=0`, `limit=0`, `limit>101`, `role` di luar enum) → 400 `ERR_VALIDATION`.
- Urutan: `created_at` DESC lalu `id_log` DESC (terbaru dulu, stabil).
- 200: **Respons berupa objek** (berbeda dari endpoint lain yang `data`-nya array — klien membaca `data.logs` dan `data.pagination`):
  ```json
  {
    "success": true, "statusCode": 200, "message": "Operasi berhasil",
    "data": {
      "logs": [
        { "id_log": "uuid", "username": "admin", "role": "Admin", "modul": "Masjid", "aktivitas": "Mengubah masjid 00000000-0000-4000-8000-000000000001", "created_at": "2026-10-18T14:59:28.044Z" }
      ],
      "pagination": { "page": 1, "limit": 20, "total": 17, "total_pages": 1 }
    }
  }
  ```
  - `total_pages = ceil(total / limit)`; `total = 0` → `total_pages = 0`; halaman di luar jangkauan → `logs = []` (bukan 404).
  - `created_at` selalu UTC (format standar ISO) — klien yang menampilkan "hari WIB" memakai `from`/`to` (sudah dihitung server dalam WIB) atau konversi lokal.
- Modul yang tercatat: `Auth` (login sukses & gagal), `Presensi`, `Izin`, `Masjid`, `Jadwal`, `Mahasantri` (reset device), `Jobs` (pemicu manual).
- Teks `aktivitas` selalu eksplisit, maksimum 500 karakter, contoh:
  - `Login berhasil` / `Login gagal: username tidak terdaftar`
  - `Presensi Subuh berhasil, jarak 23 m`
  - `Mengajukan izin Sakit tanggal 2026-10-20`
  - `Memverifikasi izin 24050505050 menjadi Disetujui`
  - `Membuat masjid Masjid Baru` / `Mengubah masjid <id>` / `Menghapus masjid <id>`
  - `Membuat jadwal sholat Terawih` / `Mengubah jadwal sholat <id>` / `Menghapus jadwal sholat <id>`
  - `Reset device Mahasantri 24060505051 (santri_dua)`
  - `Pemicu manual job tandai-tidak-hadir 2026-10-18: Tidak_Hadir 5, Izin 1 (total 6)`
  - **UPDATE/DELETE memakai `id`** (respons DELETE hanya memuat id), CREATE memakai nama — keputusan dokumen.
- Error: 400 `ERR_VALIDATION`, 401, 403 `ERR_FORBIDDEN_ROLE`.

---

## ✅ GET /v1/musyrif/presensi/monitoring
- Akses: Musyrif (`@Roles(Role.Musyrif)`); Admin/Mahasantri → 403 `ERR_FORBIDDEN_ROLE`, tanpa token → 401. GET (tidak pernah menciptakan activity log).
- Query: `tanggal` opsional, format ketat `YYYY-MM-DD` dan tanggal kalender valid (`2026-02-30` → 400). **Default hari ini (WIB)** dihitung server (`toWibDate`), bukan jam HP. Tanggal lampau diperbolehkan (melihat riwayat hari itu); **tanggal setelah hari ini WIB → 400 `ERR_VALIDATION`** `"tanggal tidak boleh melebihi hari ini"` (pemeriksaan sebelum query apa pun).
- Cakupan: **hanya Mahasantri binaan** token Musyrif (`mahasantri.id_musyrif` = profil token) dan **hanya `status_aktif = true`** — santri binaan lain Musyrif, santri nonaktif, dan Musyrif tanpa binaan tidak pernah muncul (`santri: []`, `ringkasan` semua 0).
- **Matriks status per sel** (santri × jadwal), maksimal 3 query tanpa N+1 (profil Musyrif → santri binaan → jadwal + presensi nested):
  - `Hadir`, `Tidak_Hadir`, `Izin`, `Manual` = baris presensi pada `(nim, id_jadwal, tanggal)` itu; `"Belum"` = belum ada baris (termasuk jadwal yang window-nya belum lewat dan jadwal yang belum diproses job).
  - `jadwal` diurut `waktu_azan` menaik (string `HH:mm` zero-padded → urutan leksikal = kronologis); `santri` diurut `nim` menaik.
  - `ringkasan` menghitung **sel** (bukan santri): totalnya selalu `jumlah_santri × jumlah_jadwal`.
- 200 (contoh, 2 santri × 2 jadwal):
  ```json
  {
    "success": true, "statusCode": 200, "message": "Monitoring presensi berhasil diambil",
    "data": {
      "tanggal": "2026-10-15",
      "jadwal": [
        { "id_jadwal": "uuid", "nama_sholat": "Subuh", "waktu_azan": "04:30", "waktu_mulai_presensi": "04:15", "waktu_akhir_presensi": "05:10" },
        { "id_jadwal": "uuid", "nama_sholat": "Dzuhur", "waktu_azan": "11:45", "waktu_mulai_presensi": "11:30", "waktu_akhir_presensi": "12:30" }
      ],
      "ringkasan": { "Hadir": 0, "Tidak_Hadir": 2, "Izin": 2, "Manual": 0, "Belum": 0 },
      "santri": [
        {
          "nim": "24050505050", "nama": "santri_satu", "kamar": "A0-1",
          "status": [
            { "id_jadwal": "uuid", "nama_sholat": "Subuh", "status": "Izin" },
            { "id_jadwal": "uuid", "nama_sholat": "Dzuhur", "status": "Izin" }
          ]
        },
        {
          "nim": "24060505092", "nama": "santri_tiga", "kamar": "A1-1",
          "status": [
            { "id_jadwal": "uuid", "nama_sholat": "Subuh", "status": "Tidak_Hadir" },
            { "id_jadwal": "uuid", "nama_sholat": "Dzuhur", "status": "Tidak_Hadir" }
          ]
        }
      ]
    }
  }
  ```
- Tanpa baris presensi pada tanggal itu → semua sel `"Belum"` (jadwal tetap tampil). Tanpa binaan aktif → `santri: []` dan `ringkasan` semua 0 (bukan 404).
- Error: 400 `ERR_VALIDATION` (format tanggal salah / bukan tanggal kalender / tanggal masa depan), 401, 403 `ERR_FORBIDDEN_ROLE`, 404 `ERR_MUSYRIF_NOT_FOUND` (token Musyrif tanpa profil — defensif).

---

# Endpoint Rencana (📋 Belum Diimplementasikan)

Daftar fitur dari PRD yang belum punya kode. Jangan dipanggil frontend sebelum kode ada. Perlu diputuskan detailnya sebelum tahap terkait dikerjakan.

## 📋 Endpoint Rencana Lainnya
- `GET /v1/presensi/hari-ini` (ringkasan 5 shalat hari ini, Mahasantri)
- `GET /v1/presensi/riwayat` (riwayat kehadiran, Mahasantri)
- `POST /v1/izin/lampiran` (upload ke MinIO, mengembalikan object key)
- `GET /v1/admin/rekap` (rekapitulasi global)
- `GET /v1/admin/mahasantri`, `GET/PATCH/DELETE /v1/admin/mahasantri/:nim` (CRUD lengkap Mahasantri; sekarang hanya endpoint reset-device)
