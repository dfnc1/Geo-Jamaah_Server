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

---

## 📊 Matriks Backlog & Prioritas Pengerjaan

| No | Area / Komponen | Tingkat Prioritas | Status | Dampak & Masalah Utama |
| :---: | :--- | :---: | :---: | :--- |
| 1 | **Standarisasi Response & Exception Filter** | 🟡 **P1 (High)** | Perlu Diperbaiki | Draft interceptor dan filter sudah dibuat di `src/common/` namun belum diekspor, belum di-bind di `main.ts`, dan struktur payload belum sesuai kontrak API (`docs/API_CONTRACT.md`). |
| 2 | **Endpoint Reset / Unbind Device ID** | 🔵 **P2 (Medium)** | Belum Dikerjakan | Mahasantri terkunci permanen (`ERR_DEVICE_MISMATCH`) jika gawai rusak atau berganti perangkat. Belum ada API bagi Admin/Musyrif untuk mereset `device_id`. |
| 3 | **Refaktor Import ke Path Alias (`@generated`, `@src`)** | ⚪ **P3 (Low)** | Belum Dimigrasi | Konfigurasi alias di `tsconfig.json` sudah aktif, tetapi impor pada modul-modul yang ada masih menggunakan relative path berjenjang (`../../../generated/...`). |

---

## 🔍 Rincian Masalah & Panduan Solusi Kode

### 1. Standarisasi Response Interceptor & Global Exception Filter (P1)

#### Masalah Terkini (Review Pengerjaan):
Sudah ada file draft di `src/common/interceptor/transform.interceptors.ts` dan `src/common/filters/http-exception.filter.ts`, namun masih terdapat kekurangan:
1. **Class Interceptor Belum Diekspor**: Pada `transform.interceptors.ts`, class dideklarasikan sebagai `class TransformInterceptor` tanpa kata kunci `export`, sehingga memicu lint error (`unused variable`) dan tidak bisa diimpor.
2. **Format Response Sukses Belum Sesuai Kontrak**: Sesuai `docs/API_CONTRACT.md`, format sukses wajib berupa:
   ```json
   {
     "success": true,
     "statusCode": 200,
     "message": "Operasi berhasil",
     "data": {}
   }
   ```
   Saat ini hanya membungkus `{ data: T }`.
3. **Format Response Error Belum Sesuai Kontrak**: Sesuai `docs/API_CONTRACT.md`, format error wajib berupa:
   ```json
   {
     "success": false,
     "statusCode": 400,
     "message": "Deskripsi pesan error",
     "error": "ERR_CODE"
   }
   ```
   Filter saat ini masih mengembalikan `{ statusCode, timestamp, path }`.
4. **Registrasi Global di `main.ts` Belum Di-instansiasi**: Di `src/main.ts`, pemanggilan `app.useGlobalInterceptors()` dan `app.useGlobalFilters()` belum menyertakan instance (`new TransformInterceptor()`, `new HttpExceptionFilter()`).
5. **Konvensi Nama File / Direktori**: Sebaiknya gunakan bentuk jamak untuk folder dan tunggal untuk file:
   - `src/common/interceptors/transform.interceptor.ts`
   - `src/common/filters/http-exception.filter.ts`

#### Solusi Kode Rekomendasi:

**A. `src/common/interceptors/transform.interceptor.ts`**
```typescript
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();
    const statusCode = response.statusCode;

    return next.handle().pipe(
      map((data) => ({
        success: true,
        statusCode,
        message: data?.message || 'Operasi berhasil',
        data: data?.message && data?.data !== undefined ? data.data : data,
      })),
    );
  }
}
```

**B. `src/common/filters/http-exception.filter.ts`**
```typescript
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const statusCode = exception.getStatus();
    const res = exception.getResponse();

    let message = 'Terjadi kesalahan pada server';
    let error = 'ERR_INTERNAL_ERROR';

    if (typeof res === 'string') {
      message = res;
    } else if (typeof res === 'object' && res !== null) {
      const resObj = res as Record<string, any>;
      message = Array.isArray(resObj.message)
        ? resObj.message.join(', ')
        : resObj.message || exception.message;
      error = resObj.error || HttpStatus[statusCode] || 'ERR_HTTP_EXCEPTION';
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      error,
    });
  }
}
```

**C. Daftarkan di `src/main.ts`**
```typescript
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// ...
app.useGlobalInterceptors(new TransformInterceptor());
app.useGlobalFilters(new HttpExceptionFilter());
```

---

### 2. Endpoint Reset / Unbind `device_id` Mahasantri (P2)

#### Masalah:
Sesuai aturan **BR-04**, `device_id` dikunci ke akun Mahasantri pada login pertama. Jika gawai rusak atau berganti perangkat, santri akan terkunci permanen dengan pesan `ERR_DEVICE_MISMATCH`. Belum ada endpoint bagi Admin atau Musyrif untuk mereset binding perangkat.

#### Solusi Desain:
Tambahkan endpoint khusus Admin/Musyrif (misal `POST /v1/mahasantri/:nim/reset-device`):
1. Dilindungi oleh `JwtAuthGuard` dan `RolesGuard` (`@Roles(Role.Admin, Role.Musyrif)`).
2. Memperbarui `device_id = null` pada tabel `pengguna` milik Mahasantri terkait.
3. Mencatat aktivitas ke `activity_logs` sesuai **BR-11**.

---

### 3. Refaktor Impor Menggunakan Path Alias (P3)

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

- [ ] **P1:** Perbaiki dan ekspor `TransformInterceptor`, sesuaikan `HttpExceptionFilter` dengan format `{ success, statusCode, message, error }`, lalu daftarkan secara global di `src/main.ts`.
- [ ] **P2:** Implementasikan endpoint reset / unbind `device_id` Mahasantri untuk Admin & Musyrif (`POST /v1/mahasantri/:nim/reset-device`).
- [ ] **P3:** Refaktor import relatif panjang menggunakan path alias `@generated/*` dan `@src/*`.
