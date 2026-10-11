<div align="center">

# 🕌 Geo-Jamaah Server

**Backend sistem manajemen presensi shalat berjamaah berbasis geofencing**

[![NestJS](https://img.shields.io/badge/NestJS-v11-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![pnpm](https://img.shields.io/badge/pnpm-9+-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io)
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
| 📊 **Activity Logs** | Audit trail seluruh aktivitas pengguna untuk keperluan Admin |

---

## 🛠️ Tech Stack

| Layer | Teknologi | Versi |
|---|---|---|
| **Runtime** | Node.js | 20+ |
| **Framework** | NestJS (TypeScript) | v11 |
| **Database** | PostgreSQL | 15+ |
| **ORM** | Prisma | v7 |
| **Auth** | Passport JWT + bcrypt | — |
| **Validasi** | class-validator, class-transformer | — |
| **Dokumentasi API** | Swagger / OpenAPI (`@nestjs/swagger`) | — |
| **Storage Lampiran** | MinIO (S3-compatible) | — |
| **Package Manager** | pnpm | v9+ |
| **Containerization** | Docker + Docker Compose | — |

---

## 📁 Struktur Folder

```
Geo-Jamaah_Server/
├── docs/                       # Backend contract & dokumentasi
│   ├── API_CONTRACT.md         # Endpoint, request, response, error code
│   ├── DATABASE_SCHEMA.md      # ERD, constraint, Prisma schema
│   ├── BUSINESS_RULES.md       # Aturan logika bisnis & state machine
│   └── CODE_REVIEW.md          # Catatan code review
├── prisma/
│   └── schema.prisma           # Definisi database schema
├── src/
│   ├── auth/                   # Autentikasi (login, JWT, guard)
│   │   ├── dto/
│   │   ├── guard/
│   │   ├── strategies/
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   └── auth.service.ts
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
| [`DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md) | ERD, constraint, dan Prisma schema lengkap |
| [`BUSINESS_RULES.md`](./docs/BUSINESS_RULES.md) | Aturan logika bisnis dan state machine |
| [`CODE_REVIEW.md`](./docs/CODE_REVIEW.md) | Catatan review kode dan keputusan teknis |

> **💡 Tip:** Setelah server berjalan, dokumentasi interaktif Swagger tersedia di:
> ```
> http://localhost:3000/docs
> ```

---

## 🚀 Memulai

### Prasyarat

Pastikan tools berikut sudah terinstall di sistem kamu:

- **Node.js** `v20+` — [Download](https://nodejs.org)
- **pnpm** `v9+` — `npm i -g pnpm` atau `corepack enable`
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
DATABASE_URL="postgresql://user:password@localhost:5432/geo_jamaah?schema=public"

# ── JWT ──────────────────────────────────────────────────
JWT_SECRET="ganti-dengan-secret-yang-kuat-dan-panjang"
JWT_EXPIRES_IN="7d"

# ── App ──────────────────────────────────────────────────
PORT=3000
TZ="Asia/Jakarta"

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

| Method | Endpoint | Role | Deskripsi |
|---|---|---|---|
| `POST` | `/v1/auth/login` | Public | Login & dapatkan JWT token |
| `POST` | `/v1/presensi` | Mahasantri | Submit presensi dengan koordinat GPS |
| `GET` | `/v1/presensi/hari-ini` | Mahasantri | Ringkasan 5 shalat hari ini |
| `GET` | `/v1/presensi/riwayat` | Mahasantri | Riwayat kehadiran |
| `POST` | `/v1/izin` | Mahasantri | Ajukan izin ketidakhadiran |
| `GET` | `/v1/izin/saya` | Mahasantri | Daftar pengajuan izin milik sendiri |
| `PATCH` | `/v1/musyrif/izin/:id/verify` | Musyrif | Setujui atau tolak pengajuan izin |
| `GET` | `/v1/musyrif/dss/santri-kritis` | Musyrif | Daftar santri dengan risiko kehadiran kritis |
| `GET` | `/v1/admin/activity-logs` | Admin | Audit log seluruh aktivitas sistem |

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

> **🚧 Dalam Pengembangan Aktif**

| Tahap | Status |
|---|---|
| Backend contract & dokumentasi | ✅ Selesai |
| Setup project (NestJS + Prisma + Auth) | ✅ Selesai |
| Modul Presensi (Geofencing) | 🔄 In Progress |
| Modul Izin | ⏳ Belum Dimulai |
| Modul Musyrif (DSS/EWS) | ⏳ Belum Dimulai |
| Modul Admin | ⏳ Belum Dimulai |
| Testing & QA | ⏳ Belum Dimulai |

---

<div align="center">

Dibuat dengan ☕ untuk kebutuhan pesantren modern

</div>
