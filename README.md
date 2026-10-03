# Geo-Jamaah_Server

Backend sistem manajemen presensi shalat berjamaah berbasis **geofencing** dan **Decision Support System (DSS)** untuk mahasantri di lingkungan pesantren/boarding.

## Fitur Utama

- **Presensi geofencing**: jarak HP ke masjid dihitung di server dengan rumus Haversine.
- **Validasi window time**: presensi hanya diterima pada rentang waktu shalat.
- **Anti-fake GPS**: pengecekan mock location, akurasi GPS, dan pengikatan device.
- **Pengajuan izin**: Mahasantri mengajukan, Musyrif menyetujui atau menolak.
- **Early Warning System (EWS)**: mendeteksi santri berkategori kritis (kehadiran < 75% atau 3x alpha berturut-turut).
- **RBAC**: tiga role, yaitu Mahasantri, Musyrif, dan Admin.

## Tech Stack

| Layer | Teknologi |
|---|---|
| Runtime | Node.js |
| Framework | NestJS (TypeScript) |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | Passport JWT, bcrypt |
| Validasi | class-validator, class-transformer |
| Dokumentasi API | Swagger / OpenAPI (`@nestjs/swagger`) |
| Storage lampiran | MinIO (S3-compatible) |

## Dokumentasi

Backend contract ada di folder [`docs/`](./docs):

| File | Isi |
|---|---|
| [`API_CONTRACT.md`](./docs/API_CONTRACT.md) | Endpoint, request, response, dan kode error |
| [`DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md) | ERD, constraint, dan Prisma schema |
| [`BUSINESS_RULES.md`](./docs/BUSINESS_RULES.md) | Aturan logika bisnis dan state machine |

Setelah server berjalan, dokumentasi interaktif tersedia di `http://localhost:3000/docs`.

## Struktur Folder

```
Geo-Jamaah_Server/
├── docs/               # backend contract
├── prisma/
│   └── schema.prisma
├── src/
│   ├── auth/
│   ├── presensi/
│   ├── izin/
│   ├── musyrif/
│   ├── admin/
│   ├── common/         # guards, decorators, filters, interceptors
│   └── main.ts
├── .env.example
└── README.md
```

## Memulai

### Prasyarat
- Node.js 20+
- PostgreSQL 15+ (atau Docker)
- pnpm 9+ (`npm i -g pnpm` atau `corepack enable`)

### Instalasi

```bash
git clone <url-repo>
cd Geo-Jamaah_Server
pnpm install
cp .env.example .env
```

### Konfigurasi `.env`

```env
DATABASE_URL="postgresql://user:password@localhost:5432/geo_jamaah?schema=public"
JWT_SECRET="ganti-dengan-secret-yang-kuat"
JWT_EXPIRES_IN="7d"
PORT=3000
TZ="Asia/Jakarta"

MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET="bukti-izin"
```

### Migrasi Database

```bash
pnpm prisma migrate dev --name init
pnpm prisma generate
```

### Menjalankan Server

```bash
# development
pnpm start:dev

# production
pnpm build
pnpm start:prod
```

### Testing

```bash
pnpm test
pnpm test:e2e
```

## Format Response

Sukses:
```json
{ "success": true, "statusCode": 200, "message": "...", "data": {} }
```

Error:
```json
{ "success": false, "statusCode": 400, "message": "...", "error": "ERR_CODE" }
```

## Konvensi Commit

Memakai [Conventional Commits](https://www.conventionalcommits.org): `<tipe>(<scope>): <deskripsi>`

| Tipe | Kegunaan |
|---|---|
| `feat` | Fitur baru |
| `fix` | Perbaikan bug |
| `docs` | Perubahan dokumentasi |
| `refactor` | Ubah kode tanpa mengubah perilaku |
| `test` | Menambah atau mengubah test |
| `chore` | Konfigurasi, dependency, tooling |

Contoh: `feat(presensi): add haversine geofencing validation`

## Status Project

Tahap awal: backend contract sudah disusun, implementasi sedang berjalan.
