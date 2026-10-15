# Action Items & Code Review (Outstanding Items) - Geo-Jamaah_Server

Dokumen ini memuat daftar temuan, bug, serta fitur yang **belum diselesaikan / masih bermasalah** pada codebase terkini. Poin yang telah selesai diverifikasi telah dihapus dari backlog utama:
- Connection Pool Prisma
- JWT expiration 7 hari
- Whitelist ValidationPipe
- Validasi `device_id` Mahasantri saat login
- Perbaikan `RolesGuard`, decorator `@Roles()`, registrasi `RolesGuard` di `AuthModule`
- Migrasi index komposit pada tabel `presensi`, `mahasantri`, dan `izin`
- Optimasi `AuthService.validateUser()` (mitigasi brute force query overhead)
- Verifikasi real-time `status_aktif` Mahasantri pada `JwtStrategy`
- Konfigurasi path alias di `tsconfig.json`
- Penyesuaian tag image PostgreSQL ke versi stabil `postgres:17-alpine` pada `docker-compose.yaml`
- Pengaktifan konfigurasi CORS di `src/main.ts`
- Standarisasi Response Interceptor (`TransformInterceptor`) dan Global Exception Filter (`HttpExceptionFilter`) sesuai kontrak API di `src/main.ts`

---

## 📊 Matriks Backlog & Prioritas Pengerjaan

| No | Area / Komponen | Tingkat Prioritas | Status | Dampak & Masalah Utama |
| :---: | :--- | :---: | :---: | :--- |
| 1 | **Endpoint Reset / Unbind Device ID** | 🔵 **P2 (Medium)** | Belum Dikerjakan | Mahasantri terkunci permanen (`ERR_DEVICE_MISMATCH`) jika gawai rusak atau berganti perangkat. Belum ada API bagi Admin/Musyrif untuk mereset `device_id`. |
| 2 | **Refaktor Import ke Path Alias (`@generated`, `@src`)** | ⚪ **P3 (Low)** | Belum Dimigrasi | Konfigurasi alias di `tsconfig.json` sudah aktif, tetapi impor pada modul-modul yang ada masih menggunakan relative path berjenjang (`../../../generated/...`). |

---

## 🔍 Rincian Masalah & Panduan Solusi Kode

### 1. Endpoint Reset / Unbind `device_id` Mahasantri (P2)

#### Masalah:
Sesuai aturan **BR-04**, `device_id` dikunci ke akun Mahasantri pada login pertama. Jika gawai rusak atau berganti perangkat, santri akan terkunci permanen dengan pesan `ERR_DEVICE_MISMATCH`. Belum ada endpoint bagi Admin atau Musyrif untuk mereset binding perangkat.

#### Solusi Desain:
Tambahkan endpoint khusus Admin/Musyrif (misal `POST /v1/mahasantri/:nim/reset-device`):
1. Dilindungi oleh `JwtAuthGuard` dan `RolesGuard` (`@Roles(Role.Admin, Role.Musyrif)`).
2. Memperbarui `device_id = null` pada tabel `pengguna` milik Mahasantri terkait.
3. Mencatat aktivitas ke `activity_logs` sesuai **BR-11**.

---

### 2. Refaktor Impor Menggunakan Path Alias (P3)

#### Masalah:
Alias `@generated/*` dan `@src/*` sudah aktif di `tsconfig.json`, namun kode lama masih memakai import relatif yang panjang seperti:
`import { Role } from '../../../generated/prisma/enums';`

#### Solusi:
Ubah import relatif secara bertahap pada modul-modul:
```typescript
import { Role } from '@generated/prisma/enums';
import { PrismaService } from '@src/prisma/prisma.service';
```

---

## 📋 Checklist Prioritas Tindak Lanjut

- [ ] **P2:** Implementasikan endpoint reset / unbind `device_id` Mahasantri untuk Admin & Musyrif (`POST /v1/mahasantri/:nim/reset-device`).
- [ ] **P3:** Refaktor import relatif panjang menggunakan path alias `@generated/*` dan `@src/*`.
