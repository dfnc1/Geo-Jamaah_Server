<div align="center">

# 🕌 Geo-Jamaah Server

**Backend sistem manajemen presensi shalat berjamaah berbasis geofencing**

[![NestJS](https://img.shields.io/badge/NestJS-v11-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![pnpm](https://img.shields.io/badge/pnpm-12+-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io)
[![License](https://img.shields.io/badge/license-UNLICENSED-red?style=flat-square)](LICENSE)

*Solusi presensi digital berbasis GPS & Decision Support System untuk mahasantri di lingkungan pesantren/boarding*

</div>

---

## 📋 Daftar Isi

- [Tentang Proyek](#-tentang-proyek)
- [Fitur Utama](#-fitur-utama)
- [Tech Stack](#-tech-stack)
- [Struktur Folder](#-struktur-folder)
- [Dokumentasi](#-dokumentasi)
- [Memulai](#-memulai)
  - [Prasyarat](#prasyarat)
  - [Instalasi](#instalasi)
  - [Konfigurasi Environment](#konfigurasi-environment)
  - [Setup Database](#setup-database)
  - [Menjalankan Server](#menjalankan-server)
- [API Overview](#-api-overview)
- [Format Response](#-format-response)
- [Konvensi Commit](#-konvensi-commit)
- [Status Proyek](#-status-proyek)

---

## 🌟 Tentang Proyek

**Geo-Jamaah Server** adalah REST API backend yang dibangun untuk mengelola kehadiran shalat berjamaah mahasantri di lingkungan pesantren secara digital dan terverifikasi. Sistem ini menggabungkan teknologi **geofencing berbasis koordinat GPS**, **validasi waktu shalat**, dan **sistem pendukung keputusan (DSS)** untuk memastikan presensi yang akurat dan mencegah kecurangan.

---

## ✨ Fitur Utama

| Fitur | Deskripsi |
|---|---|
| 📍 **Geofencing Server-Side** | Jarak HP ke masjid dihitung di server menggunakan rumus **Haversine** |
| ⏰ **Validasi Window Time** | Presensi hanya diterima pada rentang waktu shalat yang valid |
| 🛡️ **Anti-Fake GPS** | Pengecekan mock location, akurasi GPS, dan pengikatan device ID |
| 📝 **Pengajuan Izin** | Mahasantri mengajukan izin, Musyrif menyetujui atau menolak |
| 🚨 **Early Warning System (EWS)** | Mendeteksi santri kritis: kehadiran < 75% atau 3× alpha berturut-turut |
| 🔐 **RBAC** | Tiga role: **Mahasantri**, **Musyrif**, dan **Admin** |
| 📊 **Activity Logs** | Audit trail otomatis lewat interceptor `@Audit` (login sukses/gagal, presensi, izin, master data, reset device, pemicu job) + endpoint daftar log **hanya-baca** untuk Admin, tanpa password/token |

---

## 🛠️ Tech Stack

| Layer | Teknologi | Versi |
|---|---|---|
| **Runtime** | Node.js | 24+ |
| **Framework** | NestJS (TypeScript) | v11 |
| **Database** | PostgreSQL | 15+ |
| **ORM** | Prisma | v7 |
| **Auth** | Passport JWT + bcrypt | — |
| **Validasi** | class-validator, class-transformer | — |
| **Dokumentasi API** | Swagger / OpenAPI (`@nestjs/swagger`) | — |
| **Storage Lampiran** | MinIO (S3-compatible) | — |
| **Package Manager** | pnpm | v12+ |
| **Containerization** | Docker + Docker Compose | — |

---

## 📁 Struktur Folder

```
Geo-Jamaah_Server/
├── docs/                       # Backend contract & dokumentasi
│   ├── API_CONTRACT.md         # Endpoint, request, response, error code
│   ├── DATABASE_SCHEMA.md      # ERD, constraint, Prisma schema
│   ├── BUSINESS_RULES.md       # Aturan logika bisnis & state machine
│   ├── FRONTEND_GUIDE.md       # Panduan integrasi frontend & status endpoint
│   └── CODE_REVIEW.md          # Catatan code review
├── prisma/
│   ├── migrations/             # Migrasi database
│   ├── schema.prisma           # Definisi database schema
│   └── seed.ts                 # Data awal (Admin, Musyrif, Mahasantri, Masjid, Jadwal)
├── src/
│   ├── admin/                  # Master data Admin (tahap 4)
│   │   ├── jadwal-sholat/      # CRUD jadwal sholat
│   │   ├── mahasantri/         # Reset device Mahasantri
│   │   ├── masjid/             # CRUD masjid
│   │   └── admin.module.ts     # Menggabungkan ketiga module di atas
│   ├── activity-log/            # Activity log / audit trail (tahap 11; maks 4 file)
│   │   ├── activity-log.controller.ts  # GET /v1/admin/activity-logs + DTO query/respons
│   │   ├── activity-log.interceptor.ts # APP_INTERCEPTOR + decorator @Audit (teks inline)
│   │   ├── activity-log.module.ts
│   │   └── activity-log.service.ts     # Tulis fire-and-forget + cari(filter, pagination)
│   ├── auth/                   # Autentikasi (login, JWT, guard)
│   │   ├── decorators/         # @Public(), @Roles()
│   │   ├── dto/
│   │   ├── guard/              # JwtAuthGuard, RolesGuard
│   │   ├── strategies/         # JwtStrategy
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   └── auth.service.ts
│   ├── common/                 # Potongan lintas modul
│   │   ├── filters/            # HttpExceptionFilter (format error contract)
│   │   ├── interceptors/       # TransformInterceptor (format sukses)
│   │   └── swagger/            # Helper skema respons untuk dokumentasi
│   ├── prisma/                 # Prisma service & module
│   ├── app.module.ts
│   └── main.ts
├── test/                       # E2E tests
├── docker-compose.yaml
├── .env.example
└── README.md
```

---

## 📚 Dokumentasi

Semua backend contract tersedia di folder [`docs/`](./docs):

| File | Isi |
|---|---|
| [`API_CONTRACT.md`](./docs/API_CONTRACT.md) | Endpoint, request body, response, dan kode error |
| [`DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md) | ERD, constraint, index, dan Prisma schema lengkap |
| [`BUSINESS_RULES.md`](./docs/BUSINESS_RULES.md) | Aturan logika bisnis dan state machine |
| [`FRONTEND_GUIDE.md`](./docs/FRONTEND_GUIDE.md) | Panduan integrasi frontend dan status tiap endpoint |
| [`CODE_REVIEW.md`](./docs/CODE_REVIEW.md) | Catatan review kode dan keputusan teknis |

> **💡 Tip — Swagger:** Setelah server berjalan, dokumentasi interaktif tersedia di:
> ```
> http://localhost:3000/docs
> ```
> - Klik **Authorize** (ikon gembok) lalu isi `Bearer <access_token>` dari `POST /v1/auth/login`; token tersimpan selama tab dibuka (`persistAuthorization` aktif).
> - Spek OpenAPI mentah: `http://localhost:3000/docs-json`.
> - `/docs` dan `/docs-json` dikecualikan dari prefix global, jadi bukan `/v1/docs`.

---

## 🚀 Memulai

### Prasyarat

Pastikan tools berikut sudah terinstall di sistem kamu:

- **Node.js** `v24+` — [Download](https://nodejs.org)
- **pnpm** `v12+` — `npm i -g pnpm` atau `corepack enable` (`package.json` mengunci `pnpm@12.11.2`)
- **PostgreSQL** `v15+` — Lokal atau via Docker
- **Docker** *(opsional, untuk menjalankan database via container)*

---

### Instalasi

```bash
# 1. Clone repositori
git clone <url-repo>
cd Geo-Jamaah_Server

# 2. Install dependencies
pnpm install

# 3. Salin file environment
cp .env.example .env
```

---

### Konfigurasi Environment

Edit file `.env` sesuai konfigurasi lokal kamu:

```env
# ── Database ─────────────────────────────────────────────
# Sesuaikan user/password dengan docker-compose.yaml
DATABASE_URL="postgresql://geo:geo_1234@localhost:5432/geo_jamaah?schema=public"

# ── JWT ──────────────────────────────────────────────────
# Wajib diganti dengan secret acak yang panjang, contoh: openssl rand -hex 32
JWT_SECRET="ganti-dengan-secret-yang-kuat-dan-panjang"
# Masa berlaku token (format library `ms`): 30m, 12h, 7d, ...
JWT_EXPIRES_IN="7d"

# ── App ──────────────────────────────────────────────────
PORT=3000
TZ="Asia/Jakarta"
# Daftar alamat frontend yang diizinkan CORS, pisahkan dengan koma, tanpa spasi.
# Kosongkan untuk mengizinkan semua origin ('*') tanpa credentials,
# karena auth memakai header Bearer (bukan cookie).
# Contoh: CORS_ORIGIN="http://localhost:5173,https://geo-jamaah.example.com"
CORS_ORIGIN=""

# ── MinIO (Storage Lampiran Izin) ────────────────────────
MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET="bukti-izin"
```

> **⚠️ Penting:** Jangan pernah commit file `.env` ke repository. Sudah tercantum di `.gitignore`.

---

### Setup Database

**Opsi A — Docker (Rekomendasi):**

```bash
# Jalankan PostgreSQL via Docker Compose
docker compose up -d
```

**Opsi B — PostgreSQL Lokal:**

Pastikan PostgreSQL sudah berjalan dan sesuaikan `DATABASE_URL` di `.env`.

**Migrasi & Generate Prisma Client:**

```bash
# Jalankan migrasi pertama
pnpm prisma migrate dev --name init

# Generate Prisma client
pnpm prisma generate
```

---

### Menjalankan Server

```bash
# Mode development (hot-reload)
pnpm start:dev

# Mode debug
pnpm start:debug

# Mode production
pnpm build
pnpm start:prod
```

Server akan berjalan di `http://localhost:3000`.

---

### Testing

```bash
# Unit test
pnpm test

# Unit test dengan watch mode
pnpm test:watch

# Test coverage
pnpm test:cov

# End-to-end test
pnpm test:e2e
```

---

## 📡 API Overview

Base path: `/v1` | Swagger UI: `/docs`

**Sudah diimplementasikan:**

| Method | Endpoint | Role | Deskripsi |
|---|---|---|---|
| `POST` | `/v1/auth/login` | Public | Login & dapatkan JWT token |
| `POST` | `/v1/admin/masjid` | Admin | Tambah masjid |
| `GET` | `/v1/admin/masjid` | Admin | Daftar masjid |
| `GET` | `/v1/admin/masjid/:id_masjid` | Admin | Detail masjid |
| `PATCH` | `/v1/admin/masjid/:id_masjid` | Admin | Ubah masjid |
| `DELETE` | `/v1/admin/masjid/:id_masjid` | Admin | Hapus masjid |
| `POST` | `/v1/admin/jadwal-sholat` | Admin | Tambah jadwal sholat |
| `GET` | `/v1/admin/jadwal-sholat` | Admin | Daftar jadwal sholat |
| `GET` | `/v1/admin/jadwal-sholat/:id_jadwal` | Admin | Detail jadwal sholat |
| `PATCH` | `/v1/admin/jadwal-sholat/:id_jadwal` | Admin | Ubah jadwal sholat |
| `DELETE` | `/v1/admin/jadwal-sholat/:id_jadwal` | Admin | Hapus jadwal sholat |
| `POST` | `/v1/admin/mahasantri/:nim/reset-device` | Admin | Reset `device_id` agar bisa login dari perangkat baru |
| `POST` | `/v1/presensi` | Mahasantri | Catat presensi geolokasi (Haversine, window time WIB, anti-fake GPS) |
| `POST` | `/v1/izin` | Mahasantri | Ajukan izin (`id_musyrif` & status `Pending` otomatis) |
| `GET` | `/v1/izin/saya` | Mahasantri | Daftar izin milik sendiri (terbaru dulu) |
| `GET` | `/v1/musyrif/izin?status=` | Musyrif | Daftar izin santri binaan (+ `nama_mahasantri`) |
| `PATCH` | `/v1/musyrif/izin/:id_izin/verify` | Musyrif | Verifikasi Disetujui/Ditolak (state machine anti-race) |
| `POST` | `/v1/admin/jobs/tandai-tidak-hadir` | Admin | Pemicu manual job Tidak_Hadir/Izin (BR-05; cron juga jalan otomatis) |
| `GET` | `/v1/musyrif/dss/santri-kritis` | Musyrif | Daftar santri kritis: rasio < 75% atau streak alpha ≥ 3 (BR-08) |
| `GET` | `/v1/musyrif/presensi/monitoring` | Musyrif | Matriks presensi harian santri binaan per jadwal (Hadir/Tidak_Hadir/Izin/Manual/Belum) |
| `GET` | `/v1/admin/activity-logs` | Admin | Daftar activity log (filter role/username/modul/tanggal, pagination; BR-11) |

**Rencana (belum diimplementasikan):**

| Method | Endpoint | Role | Tahap |
|---|---|---|---|
| `GET` | `/v1/presensi/hari-ini` | Mahasantri | 6 |
| `GET` | `/v1/presensi/riwayat` | Mahasantri | 6 |
| `POST` | `/v1/izin/lampiran` | Mahasantri | 7 (upload MinIO) |
| `GET` | `/v1/admin/rekap` | Admin | 12 |

> Lihat [`docs/API_CONTRACT.md`](./docs/API_CONTRACT.md) untuk dokumentasi lengkap.

---

## 📦 Format Response

Semua endpoint menggunakan format response yang konsisten:

**✅ Sukses:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Data berhasil diambil",
  "data": {}
}
```

**❌ Error:**
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Deskripsi error yang terjadi",
  "error": "ERR_CODE"
}
```

---

## 📝 Konvensi Commit

Proyek ini menggunakan [Conventional Commits](https://www.conventionalcommits.org):

```
<tipe>(<scope>): <deskripsi singkat>
```

| Tipe | Kegunaan | Contoh |
|---|---|---|
| `feat` | Fitur baru | `feat(presensi): add haversine geofencing` |
| `fix` | Perbaikan bug | `fix(auth): handle expired token edge case` |
| `docs` | Perubahan dokumentasi | `docs: update API contract for izin endpoint` |
| `refactor` | Ubah kode tanpa mengubah perilaku | `refactor(prisma): extract service base class` |
| `test` | Menambah atau mengubah test | `test(auth): add login e2e test` |
| `chore` | Konfigurasi, dependency, tooling | `chore: upgrade nestjs to v11` |

---

## 📌 Status Proyek

> **🚧 Dalam Pengembangan Aktif** — rincian per tahap ada di [`docs/CODE_REVIEW.md`](./docs/CODE_REVIEW.md)

| Modul / Tahap | Status | Keterangan |
|---|---|---|
| Setup dasar | ✅ Selesai | Config, Prisma, prefix `v1`, CORS, format response, validasi global, `.env.example`, Swagger `/docs` |
| Auth, RBAC, device binding | ✅ Selesai | Login, JWT, bcrypt, `@Roles()`, guard global, throttler login, timing login disamakan |
| Seed | ✅ Selesai | Admin, Musyrif, Mahasantri, Masjid, 5 Jadwal Sholat |
| Master data Admin | ✅ Selesai | CRUD Masjid & Jadwal Sholat, reset device Mahasantri |
| Modul Presensi (Geofencing) | ✅ Selesai | `POST /v1/presensi`: Haversine, window time jam server WIB, anti-fake GPS, cegah double presensi (P2002 → 409), 16 unit test |
| Riwayat & ringkasan hari ini | ⏳ Belum Dimulai | Tahap 6 |
| Modul Izin & lampiran | 🟡 Sebagian | Tahap 7: izin selesai (ajukan, daftar, filter, verifikasi Musyrif pembina dengan state machine aman race + konversi `Tidak_Hadir` → `Izin` atomik saat Disetujui; 27 unit test). Upload lampiran MinIO menyusul |
| Scheduled job `Tidak_Hadir` | ✅ Selesai | Cron `@nestjs/schedule` tiap menit (Asia/Jakarta) + pemicu manual Admin; izin Disetujui → status `Izin`; idempoten (skipDuplicates, Hadir tidak ditimpa); baris otomatis: masjid utama + koordinat 0,0; 21 unit test |
| Monitoring Musyrif & grafik | 🟡 Sebagian | Tahap 9: `GET /v1/musyrif/presensi/monitoring` (matriks Hadir/Tidak_Hadir/Izin/Manual/"Belum" per jadwal + ringkasan sel; 3 query tanpa N+1; 18 unit test). Grafik tren kehadiran menyusul |
| DSS & EWS | ✅ Selesai | Tahap 10: `GET /v1/musyrif/dss/santri-kritis` (rasio = Hadir+Manual / (baris presensi periode − Izin), streak alpha; 29 unit test) |
| Activity log | ✅ Selesai | Tahap 11: interceptor `@Audit` + `APP_INTERCEPTOR` (11 titik aksi, GET tidak dicatat, teks eksplisit tanpa password/token/`device_id`, gagal menulis log tidak menggagalkan request) + `GET /v1/admin/activity-logs` (hanya Admin, filter WIB & pagination); struktur sederhana 4 file di `src/activity-log/` (teks tiap aksi inline di decorator) + 20 unit test satu suite |
| Rekap Admin & grafik | ⏳ Belum Dimulai | Tahap 12 |
| Testing & QA | ⏳ Belum Dimulai | Tahap 13 (konfigurasi Jest + e2e bawaan belum diganti) |
| Docker aplikasi | 🟡 Sebagian | Baru service Postgres; Dockerfile & service `api` belum (tahap 14) |

---

<div align="center">

Dibuat dengan ☕ untuk kebutuhan pesantren modern

</div>
