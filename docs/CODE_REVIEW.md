# Code Review & Progress - Geo-Jamaah_Server

Legenda: ✅ selesai, 🟡 sebagian, ⬜ belum.

## Posisi Sekarang

Tahap 1 sampai 5, tahap 7 (izin, tanpa upload lampiran), tahap 8 (scheduled job `Tidak_Hadir`), dan tahap 10 (DSS & EWS) selesai (setup dasar, auth/RBAC/device binding, seed, master data Admin, presensi geolokasi, pengajuan/daftar/verifikasi izin dengan state machine, job penandaan absen otomatis + pemicu manual, serta endpoint santri kritis dengan rasio/streak EWS). P1 (env, Swagger, throttler) juga sudah beres. Berikutnya tahap 6 (Riwayat dan ringkasan hari ini). Sisa pekerjaan besar: riwayat, lampiran izin (MinIO), monitoring/grafik, activity log, rekap, testing, dan Docker aplikasi.

## Status 14 Tahap Backend

**1. Setup dasar** ✅
- ✅ ConfigModule, PrismaModule, PrismaService
- ✅ Prefix `v1`, CORS, path alias `@src/*` dan `@generated/*`
- ✅ Format response sukses dan error
- ✅ Validasi global (`ERR_VALIDATION`) dan filter error umum
- ✅ Docker Compose PostgreSQL (volume sudah diperbaiki)
- ✅ `.env.example`
- ✅ Swagger (`/docs`, dikecualikan dari prefix `v1`)

**2. Auth, RBAC, device binding** ✅
- ✅ Login, JWT, bcrypt, profil per role
- ✅ Device binding Mahasantri dan `ERR_DEVICE_ID_REQUIRED`
- ✅ Cek `status_aktif` saat login dan di JwtStrategy
- ✅ `@Roles()`, `RolesGuard`, `@Public()`, guard global
- ✅ Tes manual auth (18 skenario)
- ✅ Throttler login (env `THROTTLE_LOGIN_LIMIT`, default 20/menit/IP) dan global (env `THROTTLE_GLOBAL_LIMIT`, default 600/menit)
- ✅ Samakan waktu respons saat username tidak ada (hash palsu cost 12)
- ✅ Reset device (dikerjakan di tahap 4)

**3. Seed** ✅
- ✅ Admin, Musyrif, Mahasantri (termasuk satu nonaktif)
- ✅ Masjid dan 5 Jadwal Shalat
- ✅ Aman dijalankan berulang

**4. Master data Admin** ✅
- ✅ CRUD Masjid
- ✅ CRUD Jadwal Shalat
- ✅ Reset device Mahasantri
- ✅ Validasi (koordinat, radius, format jam, window presensi)
- ✅ Tes manual hak akses Admin (401 tanpa token, 403 Musyrif/Mahasantri, 400 validasi, 404 not found, 409 `ERR_IN_USE`, reset device lalu login perangkat baru)

**5. Presensi** ✅
- ✅ Haversine, validasi radius (`src/presensi/haversine.ts`, fungsi murni)
- ✅ Window time (jam server WIB, batas inklusif; `src/presensi/wib-time.ts`)
- ✅ Cegah double presensi (tangkap P2002 dari `@@unique` → 409 `ERR_ALREADY_PRESENT`)
- ✅ Anti-fake GPS (`is_mock_location` → 400, akurasi > 50 m → 400)
- ✅ Unit test Haversine dan window time (16 test, `pnpm test`)
- ✅ Tes manual 14 skenario (sukses, RBAC, validasi, 404, 409, mock, akurasi, luar radius, luar jam)

**6. Riwayat dan ringkasan hari ini** ⬜
- ⬜ Ringkasan 5 shalat hari ini
- ⬜ Riwayat kehadiran (pagination)

**7. Izin dan lampiran** 🟡
- ✅ Pengajuan dan daftar izin milik sendiri (`POST /v1/izin`, `GET /v1/izin/saya`; `id_musyrif` otomatis dari pembina, status awal selalu `Pending`)
- ✅ Verifikasi Musyrif (hanya santri binaan; `GET /v1/musyrif/izin?status=` + `PATCH .../verify`)
- ✅ State machine izin: `Pending → Disetujui | Ditolak`, final tak bisa diubah; update bersyarat pada `Pending` (aman race, tes paralel 1×200 + 1×409)
- ✅ Unit test state machine + service (mock Prisma): 24 unit test baru
- ✅ Tes manual izin (20 skenario: validasi, RBAC, 403 bukan pembina, 409 dobel, 404, race paralel)
- ⬜ Upload lampiran ke MinIO (`POST /v1/izin/lampiran`; `bukti_lampiran` sekarang hanya string opsional)

**8. Scheduled job `Tidak_Hadir`** ✅
- ✅ Cron `@nestjs/schedule` (`* * * * *`, Asia/Jakarta): proses jadwal yang `waktu_akhir_presensi`-nya sudah lewat, tanggal WIB hari ini; cache in-memory per (jadwal, tanggal), gagal → retry menit berikutnya
- ✅ Status `Izin` jika ada izin Disetujui pada tanggal itu, selainnya `Tidak_Hadir`; izin Pending/Ditolak dianggap tidak ada
- ✅ Hanya Mahasantri aktif; idempoten via `createMany(skipDuplicates)` + `@@unique` — baris Hadir tidak ditimpa
- ✅ Pemicu manual Admin `POST /v1/admin/jobs/tandai-tidak-hadir` (`{ tanggal?, id_jadwal? }`, jumlah per status)
- ✅ Kolom tanpa lokasi: keputusan desain **opsi A** — `id_masjid` masjid utama (deterministik), koordinat 0,0, `is_manual = false`; baris otomatis dikenali dari `status_presensi` (tanpa ubah schema)
- ✅ Fungsi murni `tentukanAbsensi` + 21 unit test (5 skenario status, idempoten, isolasi error per jadwal dan per baris, fallback P2002)
- ✅ Tes manual 14 skenario (cron otomatis, backfill, idempoten, validasi, RBAC, verifikasi DB tanpa duplikat)

**9. Monitoring Musyrif dan grafik** ⬜
- ⬜ Monitoring presensi santri binaan
- ⬜ Endpoint grafik tren kehadiran Musyrif

**10. DSS dan EWS** ✅
- ✅ Fungsi murni `src/dss/ews.ts`: rasio = (`Hadir`+`Manual`) / (baris presensi tercatat dalam periode − `Izin`) ×100 dibulatkan 1 desimal; `< 75` setelah pembulatan; penyebut 0 / tanpa data → rasio null (bukan kritis)
- ✅ Streak `Tidak_Hadir` ≥ 3 dari baris terbaru (urutan `tanggal`, `waktu_mulai_presensi`, `id_jadwal`); `Hadir`/`Manual`/`Izin` memutus; slot kosong tidak memutus
- ✅ Periode dari env `DSS_PERIODE_HARI` (default 30 hari, termasuk hari ini WIB via `toWibDate`); invalid → default + `Logger.warn`
- ✅ `GET /v1/musyrif/dss/santri-kritis` (hanya binaan aktif): 3 query tetap + hitung di memori (tanpa N+1); field `jumlah { hadir, tidak_hadir, izin }`, `alasan`, `rekomendasi_tindakan` (aturan tetap `ATURAN_REKOMENDASI`); urut rasio ↑, streak ↓, nim ↑
- ✅ 29 unit test (fungsi murni + service: tepat 75 bukan kritis, 74,9 kritis, 74,95 membulat jadi 75, tiga alpha lintas hari/jadwal, dua alpha lalu Hadir, Izin bukan alpha + keluar penyebut, Manual = hadir, penyebut nol, baris luar periode, batas WIB vs UTC, urutan respons, env invalid)
- **Batasan EWS (diketahui, diterima)**: penilaian hanya menghitung **baris presensi yang tercatat**. Hari yang tidak diproses job (server mati / menit terlewat tanpa backfill) **tidak punya baris**, sehingga Tidak_Hadir hari itu **tidak terhitung alpha** sampai backfill manual (`POST /v1/admin/jobs/tandai-tidak-hadir`) dijalankan untuk tanggal lampau.

**11. Activity log** ⬜
- ⬜ Interceptor pencatat aktivitas
- ⬜ Endpoint log untuk Admin (filter, pagination)
- ⬜ Tidak ada password atau token di log
- ⬜ Catat aksi master data dari tahap 4 (sudah ditandai `TODO(tahap-11)` di `src/admin/`): buat/ubah/hapus Masjid, buat/ubah/hapus JadwalSholat, dan reset device Mahasantri

**12. Rekap Admin dan grafik** ⬜
- ⬜ Rekap global
- ⬜ Endpoint grafik tren kehadiran Admin

**13. Testing** ⬜
- ⬜ Konfigurasi Jest (`moduleNameMapper`), ganti e2e bawaan
- ⬜ Unit test: Haversine, window time, EWS
- ⬜ E2E: alur presensi dan izin

**14. Docker aplikasi** ⬜
- ⬜ Dockerfile dan service `api` di Compose
- ⬜ Service MinIO (jika belum)

## Urutan Pengerjaan Berikutnya

1. Tahap 6 riwayat dan ringkasan
2. Tahap 7 lampiran izin (MinIO) — bagian izin sudah selesai
3. Tahap 9 monitoring dan grafik Musyrif
4. Tahap 11 activity log (wajib untuk laporan, ketentuan audit trail)
5. Tahap 12 rekap dan grafik Admin
6. Tahap 13 testing (unit test inti sudah dimulai di tahap 5, EWS di tahap 10)
7. Tahap 14 Docker aplikasi

Jika waktu terbatas, potong dari bawah. Yang wajib: tahap 6 dan 11 (izin, scheduled job, dan DSS/EWS sudah selesai; lampiran MinIO boleh menyusul). Tahap 9 dan 12 cukup satu endpoint grafik per role. Tahap 13 cukup unit test inti. Tahap 14 paling akhir.

Sebelum tahap 13, bereskan backlog P2 no. 10 (sisa mengganti e2e bawaan).

## Backlog P1 — Semua Selesai

| No | Item | Status | Catatan |
|---|---|---|---|
| 6 | `.env.example`, sinkronkan `JWT_EXPIRES_IN` dan `CORS_ORIGIN` | ✅ | `JWT_EXPIRES_IN` dibaca lewat `ConfigService` (default `7d`). `CORS_ORIGIN` kosong → origin `'*'` tanpa `credentials` (auth memakai header Bearer); diisi → daftar origin dengan `credentials: true` |
| 7 | Swagger | ✅ | `@nestjs/swagger` + plugin di `nest-cli.json`. `/docs` dan `/docs-json` dikecualikan dari prefix `v1` |
| 8 | Throttler login dan timing username tidak ada | ✅ | Global `THROTTLE_GLOBAL_LIMIT`/menit (default 600); login `THROTTLE_LOGIN_LIMIT`/menit/IP (default 20) via `@Throttle`, keduanya dari env + fallback `Logger.warn` bila tidak valid. 429 dipetakan ke `ERR_TOO_MANY_REQUESTS` di `HttpExceptionFilter`. Username tidak ada tetap dijalankan `bcrypt.compare` ke hash palsu (cost 12) |

## Backlog P2 (sambil jalan)

| No | Item | Status | Catatan |
|---|---|---|---|
| 9 | Endpoint reset `device_id` | ✅ | Selesai di tahap 4, khusus Admin. Hak akses Musyrif untuk santri binaannya masih dipertimbangkan |
| 10 | Konfigurasi Jest dan ganti e2e bawaan | 🟡 | Unit test jalan (22 test: tahap 5 + guard auth). `moduleNameMapper` untuk `@src/*` dan `@generated/*` ditambahkan di `package.json`. Sisa: ganti/stub file e2e bawaan (`test/`) sebelum tahap 13 |
| 11 | Sinkronkan dokumen | ✅ | `API_CONTRACT.md`, `DATABASE_SCHEMA.md`, `README.md`, `FRONTEND_GUIDE.md` sudah disinkronkan dengan kode |
| 12 | Pertimbangkan hapus `--fix` dari script `lint` | ⬜ | `--fix` mengubah file saat lint dijalankan |

## Dokumen yang Sudah Disinkronkan

| File | Status |
|---|---|
| `API_CONTRACT.md` | ✅ Login lengkap (`ERR_ACCOUNT_INACTIVE`, `ERR_DEVICE_ID_REQUIRED`, `ERR_TOO_MANY_REQUESTS`, `device_id` wajib hanya untuk Mahasantri) dan 11 endpoint Admin. Endpoint rencana ditandai |
| `DATABASE_SCHEMA.md` | ✅ Bagian Prisma schema disalin ulang dari `prisma/schema.prisma`; daftar index dan foreign key diperbarui |
| `README.md` | ✅ Status modul sesuai kenyataan, `src/common/` dan `src/admin/` di struktur folder, bagian Swagger, variabel `.env`, Node 24+ |
| `FRONTEND_GUIDE.md` | ✅ Dibuat berisi tabel status endpoint (Siap / Rencana). Perbarui tiap ada endpoint baru |
| `BUSINESS_RULES.md` | ✅ Sudah sesuai |

## Checklist

- [x] Volume Postgres
- [x] Seed
- [x] RBAC global dan `@Public()`
- [x] `main.ts`: pipe dan filter
- [x] Tes manual auth
- [x] `.env.example` dan sinkron env
- [x] Swagger
- [x] Throttler dan timing login
- [x] Sinkron dokumen
- [x] Tahap 4 master data Admin
- [x] Tahap 5 presensi (Haversine, window time, anti-fake GPS; 16 unit test + 14 tes manual)
- [x] Tahap 7 izin (state machine Pending → Disetujui/Ditolak aman race; verifikasi `Disetujui` konversi `Tidak_Hadir` → `Izin` atomik dalam `$transaction`; 27 unit test + 20 tes manual)
  - **Batasan race job vs persetujuan (diketahui, diterima)**: konversi hanya menyentuh baris `Tidak_Hadir` yang **sudah ada** saat verifikasi berjalan. Jika cron job membaca status izin (`Pending`) tepat sebelum transaksi persetujuan commit, job dapat membuat baris `Tidak_Hadir` **sesudah** persetujuan selesai — baris telat itu tidak ikut terkonversi dan verify kedua tidak bisa (status sudah final → 409); perbaikannya backfill `POST /v1/admin/jobs/tandai-tidak-hadir` + update manual. Kasus aman: job yang berjalan **setelah** persetujuan commit membaca izin `Disetujui` dan membuat baris `Izin` langsung (logika tahap 8).
- [x] Tahap 8 scheduled job `Tidak_Hadir` (cron + pemicu manual Admin, opsi A masjid utama + koordinat 0,0; 21 unit test + 14 tes manual)
- [x] Tahap 10 DSS & EWS (`GET /v1/musyrif/dss/santri-kritis`; fungsi murni `ews.ts`, 3 query tanpa N+1, 29 unit test; penyebut = baris presensi tercatat dalam periode, `< 75` setelah bulat 1 desimal)