# Action Items & Code Review (Outstanding Items) - Geo-Jamaah_Server

Dokumen ini memuat daftar temuan, bug, serta fitur yang **belum diselesaikan / masih bermasalah** pada codebase terkini. Poin yang telah selesai (Connection Pool Prisma, JWT expiration 7 hari, Whitelist ValidationPipe, validasi `device_id` Mahasantri saat login, perbaikan `RolesGuard`, decorator `@Roles()`, registrasi `RolesGuard` di `AuthModule`, dan migrasi index komposit) telah disaring agar fokus pengerjaan terarah pada backlog yang tersisa.

---

## 📊 Matriks Backlog & Prioritas Pengerjaan

| No | Area / Komponen | Tingkat Prioritas | Status | Dampak & Masalah Utama |
| :---: | :--- | :---: | :---: | :--- |
| 1 | **Standarisasi Response & Exception Filter** | 🟡 **P1 (High)** | Belum Diterapkan | Format response sukses dan error belum seragam sesuai kontrak API (`API_CONTRACT.md`). |
| 2 | **Optimasi `validateUser` (Brute Force)** | 🔵 **P2 (Medium)** | Belum Dikerjakan | Query JOIN profil berat dieksekusi sebelum pencocokan password dengan `bcrypt.compare`. |
| 3 | **Verifikasi `status_aktif` di `JwtStrategy`** | 🔵 **P2 (Medium)** | Belum Dikerjakan | Token JWT berlaku 7 hari; Mahasantri yang dinonaktifkan Admin di tengah periode masih bisa presensi. |
| 4 | **Endpoint Reset / Unbind Device ID** | 🔵 **P2 (Medium)** | Belum Dikerjakan | Mahasantri terkunci permanen (`ERR_DEVICE_MISMATCH`) jika berganti atau kehilangan perangkat. Belum ada API reset. |
| 5 | **Path Alias di `tsconfig.json`** | ⚪ **P3 (Low)** | Belum Dikonfigurasi | Import Prisma Client masih menggunakan relative path berjenjang (`../../../generated/...`). |
| 6 | **Tag Image PostgreSQL Docker Compose** | ⚪ **P3 (Low)** | Perlu Disesuaikan | Menggunakan `postgres:18-alpine` (versi belum stabil/rilis resmi). |
| 7 | **Konfigurasi CORS di `main.ts`** | ⚪ **P3 (Low)** | Belum Diaktifkan | Frontend web/mobile berisiko terblokir CORS saat mengakses server. |

---

## 🔍 Rincian Masalah & Panduan Solusi Kode

### 1. Standarisasi Response Interceptor & Global Exception Filter (P1)

#### Masalah:
Sesuai dokumen `docs/API_CONTRACT.md`, struktur payload HTTP harus terstandarisasi:
- Sukses: `{ "success": true, "statusCode": 200, "message": "...", "data": {} }`
- Error: `{ "success": false, "statusCode": 400, "message": "...", "error": "ERR_CODE" }`

Saat ini NestJS masih mengembalikan raw payload bawaan (tidak konsisten antara format controller dan `HttpException`).

#### Solusi Kode:
1. Buat `TransformInterceptor` di `src/common/interceptors/transform.interceptor.ts`.
2. Buat `HttpExceptionFilter` di `src/common/filters/http-exception.filter.ts`.
3. Daftarkan keduanya secara global di `src/main.ts`:
```typescript
app.useGlobalInterceptors(new TransformInterceptor());
app.useGlobalFilters(new HttpExceptionFilter());
```

---

### 2. Mitigasi Serangan Brute Force pada `validateUser()` (P2)

#### Masalah:
Pada `src/auth/auth.service.ts`, query JOIN multi-tabel dieksekusi untuk setiap percobaan login, bahkan sebelum password diverifikasi:
```typescript
const user = await this.prismaService.pengguna.findUnique({
  where: { username },
  include: {
    mahasantri: { include: { musyrif: true } },
    musyrif: true,
  },
});
const ok = await bcrypt.compare(pass, user.password);
```
Setiap percobaan password salah tetap memicu query JOIN berat ke PostgreSQL.

#### Solusi Kode:
Pisahkan verifikasi kredensial minimal dari pengambilan data profil lengkap:
```typescript
async validateUser(username: string, pass: string): Promise<UserWithProfil | null> {
  const credential = await this.prismaService.pengguna.findUnique({
    where: { username },
    select: { id_pengguna: true, password: true },
  });

  if (!credential) return null;

  const isPasswordValid = await bcrypt.compare(pass, credential.password);
  if (!isPasswordValid) return null;

  return this.prismaService.pengguna.findUnique({
    where: { id_pengguna: credential.id_pengguna },
    include: {
      mahasantri: {
        include: {
          musyrif: {
            select: { id_musyrif: true, nama: true },
          },
        },
      },
      musyrif: true,
    },
  });
}
```

---

### 3. Verifikasi `status_aktif` Mahasantri Real-time di `JwtStrategy` (P2)

#### Masalah:
Pada `src/auth/strategies/jwt.strategy.ts`, method `validate()` langsung meloloskan request berdasarkan decoded payload token tanpa query ke database:
```typescript
validate(payload: JwtPayload) {
  return { sub: payload.sub, username: payload.username, role: payload.role };
}
```
Akun Mahasantri yang dinonaktifkan (`status_aktif = false`) oleh Admin masih dapat presensi atau mengakses API selama token (7 hari) belum kedaluwarsa.

#### Solusi Kode:
Inject `PrismaService` ke `JwtStrategy` dan tambahkan pengecekan `status_aktif` untuk role `Mahasantri`:
```typescript
async validate(payload: JwtPayload) {
  if (payload.role === Role.Mahasantri) {
    const santri = await this.prismaService.mahasantri.findUnique({
      where: { id_pengguna: payload.sub },
      select: { status_aktif: true },
    });

    if (!santri || !santri.status_aktif) {
      throw new UnauthorizedException({
        message: 'Akun Anda telah dinonaktifkan',
        error: 'ERR_ACCOUNT_INACTIVE',
      });
    }
  }

  return {
    sub: payload.sub,
    username: payload.username,
    role: payload.role,
  };
}
```

---

### 4. Endpoint Reset / Unbind `device_id` Mahasantri (P2)

#### Masalah:
Sesuai aturan **BR-04**, `device_id` dikunci ke akun Mahasantri pada login pertama. Jika gawai rusak atau berganti perangkat, santri akan terkunci permanen dengan pesan `ERR_DEVICE_MISMATCH`. Saat ini belum ada endpoint bagi Admin atau Musyrif untuk mereset binding perangkat.

#### Solusi Desain:
Tambahkan endpoint khusus Admin/Musyrif (misal `POST /v1/mahasantri/:nim/reset-device`):
1. Dilindungi oleh `JwtAuthGuard` dan `RolesGuard` (`@Roles(Role.Admin, Role.Musyrif)`).
2. Memperbarui `device_id = null` pada tabel `pengguna` milik Mahasantri terkait.
3. Mencatat aktivitas ke `activity_logs` sesuai **BR-11**.

---

### 5. Konfigurasi Path Alias pada `tsconfig.json` (P3)

#### Masalah:
Impor Prisma Client dan modul masih menggunakan relative path berjenjang seperti:
`import { Role } from '../../../generated/prisma/enums';`

#### Solusi Konfigurasi:
Tambahkan konfigurasi `paths` pada `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@generated/*": ["generated/*"],
      "@src/*": ["src/*"]
    }
  }
}
```

---

### 6. Penyesuaian Versi Image Docker Compose PostgreSQL (P3)

#### Masalah:
Pada `docker-compose.yaml`, image database disetel ke `postgres:18-alpine`. Versi PostgreSQL 18 belum rilis resmi / stabil di Docker Hub, sehingga berisiko gagal pull saat setup lingkungan baru.

#### Solusi Konfigurasi:
Ubah image ke versi LTS stabil:
```yaml
services:
  postgres:
    image: postgres:17-alpine
```

---

### 7. Pengaktifan Konfigurasi CORS di `main.ts` (P3)

#### Masalah:
Server belum mengaktifkan CORS (`app.enableCors()`). Saat frontend mobile atau web dashboard mengakses API dari domain atau port berbeda, browser akan memblokir request.

#### Solusi Kode:
Tambahkan di `src/main.ts`:
```typescript
app.enableCors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  credentials: true,
});
```

---

## 📋 Checklist Prioritas Tindak Lanjut

- [ ] **P1:** Implementasikan `TransformInterceptor` dan `HttpExceptionFilter` sesuai kontrak API.
- [ ] **P2:** Optimasi `AuthService.validateUser()` (pisahkan verifikasi password dari query profil berat).
- [ ] **P2:** Tambahkan pengecekan `status_aktif` di `JwtStrategy.validate()`.
- [ ] **P2:** Implementasikan endpoint reset / unbind `device_id` Mahasantri untuk Admin & Musyrif.
- [ ] **P3:** Konfigurasikan `paths` alias di `tsconfig.json`.
- [ ] **P3:** Sesuaikan tag image `postgres:17-alpine` di `docker-compose.yaml`.
- [ ] **P3:** Aktifkan konfigurasi CORS di `src/main.ts`.
