# API Contract - Geo-Jamaah_Server

Base path: `/v1`. Dokumentasi Swagger: `/docs`.

## Format Response

Sukses:
```json
{ "success": true, "statusCode": 200, "message": "...", "data": {} }
```
Error:
```json
{ "success": false, "statusCode": 400, "message": "...", "error": "ERR_CODE" }
```

## 1. POST /v1/auth/login
- Akses: Public
- Body: `{ "username": string, "password": string, "device_id": string }`
- 201: `{ "access_token": string, "user": { id_pengguna, username, role, profil } }`
- Error: 401 `ERR_INVALID_CREDENTIALS`, 401 `ERR_DEVICE_MISMATCH`

## 2. POST /v1/presensi
- Akses: Mahasantri
- Body:
  ```json
  {
    "id_jadwal": "uuid",
    "id_masjid": "uuid",
    "latitude_user": -7.9666,
    "longitude_user": 112.6326,
    "akurasi_meter": 12.5,
    "is_mock_location": false
  }
  ```
- Validasi: latitude -90..90, longitude -180..180, akurasi_meter >= 0.
- 201: `{ "status_presensi": "Hadir", "jarak_meter": 23.4 }`
- Error:
  - 400 `ERR_GEOFENCE_RADIUS_EXCEEDED`
  - 400 `ERR_TIME_WINDOW_INVALID`
  - 400 `ERR_MOCK_LOCATION`
  - 400 `ERR_GPS_ACCURACY_LOW`
  - 404 `ERR_JADWAL_NOT_FOUND` / `ERR_MASJID_NOT_FOUND`
  - 409 `ERR_ALREADY_PRESENT`

## 3. POST /v1/izin
- Akses: Mahasantri
- Body:
  ```json
  {
    "jenis_izin": "Sakit | Pulang | Tugas_Kampus",
    "tanggal_izin": "2026-10-05",
    "alasan": "string",
    "bukti_lampiran": "object-key (opsional)"
  }
  ```
- 201: pengajuan izin dikirim ke musyrif, status `Pending`.
- Error: 400 validasi, 401, 403

## 4. PATCH /v1/musyrif/izin/:id_izin/verify
- Akses: Musyrif (pembina dari mahasantri pengaju)
- Body: `{ "status_persetujuan": "Disetujui | Ditolak" }`
- 200: status izin diperbarui.
- Error: 403 `ERR_NOT_YOUR_STUDENT`, 404 `ERR_IZIN_NOT_FOUND`, 409 `ERR_IZIN_ALREADY_DECIDED`

## 5. GET /v1/musyrif/dss/santri-kritis
- Akses: Musyrif
- 200:
  ```json
  [
    {
      "nim": "string",
      "nama": "string",
      "kategori_risiko": "KRITIS",
      "rasio_kehadiran": 68.5,
      "streak_alpha": 3,
      "rekomendasi_tindakan": "string"
    }
  ]
  ```

## 6. GET /v1/admin/activity-logs
- Akses: Admin
- Query: `role` (opsional), `username` (opsional), `modul` (opsional), `from`, `to` (opsional, ISO date), `page`, `limit`
- 200: daftar log terbaru dulu
  ```json
  [{ "id_log": "uuid", "username": "string", "role": "Admin", "modul": "Masjid", "aktivitas": "Mengubah radius toleransi", "created_at": "2026-10-05T08:00:00.000Z" }]
  ```
- Error: 401, 403

## Endpoint Tambahan yang Dibutuhkan (belum ada di diskusi)
Fitur di PRD yang belum punya endpoint. Perlu diputuskan sebelum coding:
- `GET /v1/presensi/hari-ini` (ringkasan 5 shalat hari ini, Mahasantri)
- `GET /v1/presensi/riwayat` (riwayat kehadiran, Mahasantri)
- `GET /v1/musyrif/presensi/monitoring` (dashboard real-time Musyrif)
- `GET /v1/izin/saya` dan `GET /v1/musyrif/izin?status=Pending`
- `POST /v1/izin/lampiran` (upload ke MinIO, mengembalikan object key)
- `CRUD /v1/admin/masjid` dan `CRUD /v1/admin/jadwal-sholat`
- `GET /v1/admin/rekap` (rekapitulasi global)