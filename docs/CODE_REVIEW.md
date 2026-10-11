# Hasil Review Lanjutan (Follow-up Code Review) - Geo-Jamaah_Server

Dokumen ini berisi hasil evaluasi tindak lanjut terhadap review sebelumnya (`docs/CODE_REVIEW.md`), perbandingan status implementasi saat ini, serta penulisan ulang temuan yang **belum selesai** ditambah **temuan/bug baru** yang muncul pada kode terkini.

---

## 📊 1. Matriks Perbandingan Status Implementasi

| Area / Poin Review Sebelumnya | Status Terkini | Catatan Evaluasi |
| :--- | :---: | :--- |
| **Prisma Connection Pool** | ✅ **Selesai** | `PrismaService` kini menginisialisasi `Pool` (`pg`) tersendiri dan menutupnya di `onModuleDestroy()`. |
| **JWT Expiration (BR-10)** | ✅ **Selesai** | Telah diubah ke `'1w'` (7 hari) pada `auth.module.ts`. |
| **Index FK Mahasantri** | ✅ **Selesai** | `@@index([id_musyrif])` telah dipasang pada model `Mahasantri`. |
| **Index FK Presensi & Izin** | ❌ **Belum Selesai** | `Presensi(id_jadwal, tanggal)` dan `Izin(nim)` belum ditambahkan ke `schema.prisma`. |
| **Validation `LoginDto.device_id`** | ⚠️ **Parsial & Muncul Bug** | Dibuat opsional, namun verifikasi wajib `device_id` untuk Mahasantri hilang di level service. |
| **Role Guard & `@Roles()`** | ⚠️ **Parsial & Bug Fatal** | File dibuat, namun terdapat typo enum, kesalahan objek Request, decorator single-role, dan ketiadaan `@Injectable()`. |
| **Verifikasi Status Aktif di JWT** | ❌ **Belum Selesai** | `JwtStrategy` belum memvalidasi `status_aktif` santri secara real-time. |
| **Endpoint Reset Device** | ❌ **Belum Selesai** | Belum ada mekanisme unbind/reset `device_id` santri. |
| **Mitigasi Brute Force (Query Berat)** | ❌ **Belum Selesai** | `validateUser` masih melakukan `findUnique` dengan relasi lengkap sebelum memverifikasi password. |
| **Whitelist di `ValidationPipe`** | ❌ **Belum Selesai** | `main.ts` masih menginisialisasi `new ValidationPipe()` tanpa parameter `whitelist` & `transform`. |
| **Path Alias di `tsconfig.json`** | ❌ **Belum Selesai** | Belum ada konfigurasi path alias untuk `@generated/*` atau `@src/*`. |

---

## 🔴 2. Temuan Kritis Baru (Critical & Fatal Bugs)

Bagian ini menyoroti bug yang muncul dari implementasi terbaru pada commit terakhir:

### 1. Bug Fatal pada `RolesGuard` (`src/auth/guard/Roles.guard.ts`)
- **Masalah 1 — Objek Request Tertukar:**
  ```typescript
  const user = context.switchToHttp().getRequest();
  return requiredRoles.includes(user.role);
  ```
  `getRequest()` mengembalikan instance objek HTTP Request Express (`req`), **bukan** user profile. Objek user hasil autentikasi JWT diletakkan oleh Passport pada properti `req.user`. Memanggil `user.role` pada objek request akan selalu menghasilkan `undefined`.
- **Masalah 2 — Missing `@Injectable()`:**
  Class `RolesGuard` belum memiliki decorator `@Injectable()`, yang dapat memicu error dependensi pada container IoC NestJS.
- **Masalah 3 — Null Pointer Exception:**
  Jika endpoint dipasang `RolesGuard` tanpa `JwtAuthGuard` atau jika user tidak login, `req.user` bernilai `undefined`, pemanggilan properti role akan melempar `TypeError: Cannot read properties of undefined`.
- **Masalah 4 — Penamaan File:**
  File dinamai `Roles.guard.ts` (PascalCase), inkonsisten dengan berkas guard lain seperti `jwt-auth.guard.ts` (kebab-case). Di sistem operasi Linux (case-sensitive), perbedaan ini rawan memicu bug import.

### 2. Typo & Inkonsistensi Enum pada `@Roles()` Decorator (`src/auth/decorators/roles.decorator.ts`)
- **Typo Fatal pada Enum:**
  ```typescript
  export enum ROLE {
    MAHASANTRI = 'MAHASANTRI',
    MUSYRIF = 'MUSYR  IF', // ⚠️ Typo: ada dua spasi di tengah kata!
  }
  ```
- **Inkonsistensi Nilai Enum:**
  Di schema database Prisma, enum `Role` bernilai PascalCase (`Mahasantri`, `Musyrif`, `Admin`). Enum lokal `ROLE` yang dibuat menggunakan UPPERCASE dan tidak memiliki nilai `ADMIN`. Jika payload token JWT berisi role dari Prisma (`user.role === 'Musyrif'`), komparasi dengan enum ini tidak akan pernah cocok.
- **Batasan Tipe Decorator:**
  `Reflector.createDecorator<ROLE>()` membatasi metadata hanya satu role saja. Padahal banyak endpoint yang dapat diakses oleh beberapa role sekaligus (misal: Musyrif dan Admin). Seharusnya menerima array `Role[]`.

### 3. Celah Validasi: Mahasantri Dapat Login Tanpa `device_id`
- Di `src/auth/dto/login.dto.ts`, properti `device_id` diubah menjadi `@IsOptional()`. Ini tepat untuk role Musyrif dan Admin.
- Namun di `AuthService.login()`:
  ```typescript
  if (user.role === Role.Mahasantri) {
    // ...
    await this.bindDevice(user.id_pengguna, user.device_id, dto.device_id);
  }
  ```
  Jika akun Mahasantri login tanpa mengirimkan `device_id` (`dto.device_id` bernilai `undefined`), fungsi `bindDevice` akan menerima `undefined` dan meloloskan login tanpa pengikatan perangkat (melanggar aturan **BR-04 Anti-Fake GPS: device_id terikat ke satu akun**).

---

## ⚠️ 3. Temuan yang Masih Belum Diselesaikan dari Review Sebelumnya

### 1. Database Indexing yang Masih Kurang (`prisma/schema.prisma`)
1. **Model `Presensi`**:
   - Query cron scheduler (penanda otomatis status `Tidak_Hadir` pasca shalat) dan dashboard pemantauan membutuhkan pencarian berdasarkan `id_jadwal` dan `tanggal` secara berkala.
   - Index komposit yang ada saat ini (`@@index([nim, tanggal, id_jadwal])`) diawali oleh `nim`, sehingga PostgreSQL tidak dapat menggunakannya jika query tidak menyertakan filter `nim`.
   - **Solusi**: Tambahkan index komposit:
     ```prisma
     @@index([id_jadwal, tanggal])
     ```
2. **Model `Izin`**:
   - Endpoint santri `GET /v1/izin/saya` memfilter riwayat izin berdasarkan `nim`.
   - Index yang ada saat ini adalah `@@index([id_musyrif, status_persetujuan, nim])`. Index B-Tree multi-kolom yang diawali `id_musyrif` tidak akan mengoptimalkan query yang hanya mencari berdasarkan `WHERE nim = ?`.
   - **Solusi**: Tambahkan index mandiri:
     ```prisma
     @@index([nim])
     ```

### 2. Celah JWT Expiration Saat Mahasantri Dinonaktifkan (`src/auth/strategies/jwt.strategy.ts`)
- `JwtStrategy.validate()` hanya mengembalikan data hasil decode token tanpa memverifikasi apakah Mahasantri yang bersangkutan masih aktif (`status_aktif = true`).
- Akun yang dinonaktifkan oleh Admin di tengah hari masih dapat melakukan presensi atau request lain sampai masa berlaku token JWT (7 hari) habis.

### 3. Tidak Ada Mekanisme Reset / Unbind Device
- Jika Mahasantri kehilangan gawai, berganti ponsel, atau mereset perangkat ke pengaturan pabrik, mereka akan terkunci secara permanen dengan pesan `ERR_DEVICE_MISMATCH`.
- Belum ada endpoint bagi Admin atau Musyrif untuk mengosongkan kolom `device_id` pada akun Mahasantri.

### 4. Beban Query Berat Saat Percobaan Login Gagal (Brute Force Risk)
- Fungsi `validateUser()` langsung memanggil `this.prismaService.pengguna.findUnique` dengan relasi kompleks (`include: { mahasantri: { include: { musyrif: ... } }, musyrif: true }`) **sebelum** password dicocokkan dengan `bcrypt.compare`.
- Saat terjadi serangan brute-force, database dipaksa melakukan query JOIN relasi berat untuk setiap percobaan password yang salah.

### 5. `ValidationPipe` di `main.ts` Belum Dikonfigurasi
- Di `src/main.ts`:
  ```typescript
  app.useGlobalPipes(new ValidationPipe());
  ```
  Parameter proteksi belum dipasang:
  - `whitelist: true`: Mencegah *Mass Assignment* dengan membuang field yang tidak didefinisikan pada DTO.
  - `transform: true`: Mengonversi tipe data primitif secara otomatis dari query/param string ke tipe yang sesuai.

### 6. Path Alias Belum Dikonfigurasi di `tsconfig.json`
- Impor dari folder generated prisma masih berupa relative import bertingkat (`../../generated/prisma/client` vs `../../../generated/prisma/enums`). Perlu path alias (misal `@generated/*` atau `@prisma-client`) agar kode tetap stabil saat terjadi refactoring folder.

---

## 🛠️ 4. Panduan Solusi & Rekomendasi Kode Perbaikan

### A. Perbaikan Decorator `@Roles()` (`src/auth/decorators/roles.decorator.ts`)
Gunakan enum `Role` resmi dari Prisma dan dukung penerimaan multi-role:
```typescript
import { SetMetadata } from '@nestjs/common';
import { Role } from '../../../generated/prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

### B. Perbaikan `RolesGuard` (`src/auth/guard/roles.guard.ts`)
Ubah nama file menjadi `roles.guard.ts` (kebab-case) dan perbaiki pembacaan user dari `request.user`:
```typescript
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../generated/prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException({
        message: 'Akses ditolak: pengguna tidak terautentikasi atau tidak memiliki role',
        error: 'ERR_FORBIDDEN_ROLE',
      });
    }

    return requiredRoles.includes(user.role);
  }
}
```

### C. Perbaikan Validasi Device pada Mahasantri (`src/auth/auth.service.ts`)
Tambahkan pengecekan eksplisit bahwa `device_id` wajib ada jika role adalah Mahasantri:
```typescript
if (user.role === Role.Mahasantri) {
  if (!user.mahasantri?.status_aktif) {
    throw new ForbiddenException({
      message: 'Akun tidak aktif',
      error: 'ERR_ACCOUNT_INACTIVE',
    });
  }

  if (!dto.device_id) {
    throw new BadRequestException({
      message: 'Perangkat (device_id) wajib disertakan untuk Mahasantri',
      error: 'ERR_DEVICE_ID_REQUIRED',
    });
  }

  await this.bindDevice(user.id_pengguna, user.device_id, dto.device_id);
}
```

### D. Optimasi `validateUser` (Mencegah Query Berat Saat Brute-force)
Pisahkan query verifikasi kredensial dari query pemuatan profil lengkap:
```typescript
async validateUser(username: string, pass: string): Promise<UserWithProfil | null> {
  // Query awal hanya mengambil kredensial minimal
  const credential = await this.prismaService.pengguna.findUnique({
    where: { username },
    select: { id_pengguna: true, password: true },
  });

  if (!credential) return null;

  const isPasswordValid = await bcrypt.compare(pass, credential.password);
  if (!isPasswordValid) return null;

  // Jika password valid, muat profil lengkap untuk respon login
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

### E. Penambahan Index pada `prisma/schema.prisma`
```prisma
model Presensi {
  // ... kolom lainnya ...

  @@unique([nim, id_jadwal, tanggal])
  @@index([nim, tanggal, id_jadwal])
  @@index([id_jadwal, tanggal]) // <-- Tambahkan untuk scheduled job & rekap jadwal
  @@map("presensi")
}

model Izin {
  // ... kolom lainnya ...

  @@index([id_musyrif, status_persetujuan, nim])
  @@index([nim]) // <-- Tambahkan untuk query GET /v1/izin/saya
  @@map("izin")
}
```

### F. Konfigurasi `main.ts`
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
);
```

---

## 📋 5. Checklist Prioritas Tindak Lanjut

- [ ] **P0 (Urgent / Bug):** Perbaiki `RolesGuard` dan decorator `@Roles()` (hapus typo, perbaiki `req.user`, gunakan enum Prisma).
- [ ] **P0 (Urgent / Bug):** Tambahkan validasi kewajiban `device_id` khusus Mahasantri pada `AuthService.login()`.
- [ ] **P1 (High):** Tambahkan index `@@index([id_jadwal, tanggal])` pada `Presensi` dan `@@index([nim])` pada `Izin` di `prisma/schema.prisma` lalu jalankan migrasi.
- [ ] **P1 (High):** Aktifkan `whitelist: true` dan `transform: true` pada `ValidationPipe` di `src/main.ts`.
- [ ] **P1 (High):** Ekstrak pendaftaran `RolesGuard` ke `AuthModule` (providers & exports) atau daftarkan secara global.
- [ ] **P2 (Medium):** Optimasi `validateUser()` agar tidak melakukan join berat jika password salah.
- [ ] **P2 (Medium):** Buat endpoint Admin/Musyrif untuk reset `device_id` akun Mahasantri.
- [ ] **P2 (Medium):** Tambahkan verifikasi `status_aktif` di `JwtStrategy.validate()` untuk mencegah penggunaan token oleh akun non-aktif.
- [ ] **P3 (Low):** Konfigurasikan path alias di `tsconfig.json` untuk impor prisma client.
