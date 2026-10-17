# Code Review & Progress - Geo-Jamaah_Server

Legenda: ✅ selesai, 🟡 sebagian, ⬜ belum.

## Posisi Sekarang

Volume Postgres dan seed sudah beres. Tiga item di bawah menutup sisa tahap 1 sampai 3. Setelah ketiganya beres,
lanjut ke tahap 4 (master data Admin).

## Urutan Pengerjaan

| No | Item                                | Prioritas | Status |
|----|-------------------------------------|-----------|--------|
| 3  | RBAC global dan `@Public()`         | P0        | 🟡     |
| 4  | Rapikan `main.ts` (pipe dan filter) | P0        | ⬜     |
| 5  | Tes manual auth                     | P1        | ⬜     |

Kerjakan berurutan. Guard global (3) harus ada sebelum controller baru dibuat.

---

## 3. RBAC Global dan `@Public()`

> Sudah selesai: file di-rename jadi `roles.guard.ts` (commit `refactor(auth): rename Roles.guard.ts to roles.guard.ts`).
> Sisanya masih perlu dikerjakan.

**Masalah:**

- Guard mengembalikan `false` saat role tidak cocok, hasilnya 403 tanpa `ERR_FORBIDDEN_ROLE`
- Guard belum global, jadi endpoint baru terbuka tanpa token kalau lupa `@UseGuards`
- Warning lint `no-unsafe-argument` di guard

**Arahan:**

1. ~~Rename dengan git: `git mv src/auth/guard/Roles.guard.ts src/auth/guard/roles.guard.ts`, lalu perbaiki semua
   import-nya.~~ (sudah dilakukan)
2. Ubah akhir `canActivate` di `RolesGuard`: jika role tidak termasuk `requiredRoles`, lempar
   `ForbiddenException({ message: 'Anda tidak memiliki akses ke resource ini', error: 'ERR_FORBIDDEN_ROLE' })`, selain
   itu `return true`. Beri tipe pada `request` (misalnya `{ user?: { role: Role } }`) agar warning lint hilang.
3. Buat `src/auth/decorators/public.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

4. Ubah `JwtAuthGuard` supaya melewati endpoint publik:

```ts

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

5. Daftarkan sebagai guard global di `AppModule`. **Urutan penting:** `JwtAuthGuard` harus sebelum `RolesGuard`.

```ts
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
]
```

6. Beri `@Public()` pada method `login` di `AuthController`.
7. Boleh hapus `RolesGuard` dari `providers` dan `exports` di `AuthModule` karena sudah didaftarkan global.

**Aturan setelah ini:** semua endpoint otomatis butuh token. Endpoint tanpa `@Roles()` boleh diakses semua role yang
sudah login. Endpoint khusus role wajib diberi `@Roles(...)`.

**Selesai jika:**

- Login tetap bisa tanpa token
- Endpoint lain tanpa token menghasilkan 401
- Role salah menghasilkan 403 dengan `error: "ERR_FORBIDDEN_ROLE"`
- `pnpm lint` tanpa warning di file guard

**Commit:** `refactor(auth): make jwt and roles guards global with public decorator`

---

## 4. Rapikan `main.ts`

**Masalah:**

- `forbidNonWhitelisted: true` membuat request dengan satu field berlebih langsung ditolak 400. Mobile yang menambah
  field akan gagal total
- Error validasi keluar sebagai `error: "Bad Request"`, bukan `ERR_VALIDATION`
- `HttpExceptionFilter` hanya menangkap `HttpException`. Error Prisma atau bug tak terduga keluar dengan format bawaan
  Nest, bukan format contract

**Arahan:**

1. **ValidationPipe:** hapus `forbidNonWhitelisted`, pertahankan `whitelist` dan `transform`, dan tambahkan
   `exceptionFactory`:

```ts
new ValidationPipe({
  whitelist: true,
  transform: true,
  exceptionFactory: (errors) =>
    new BadRequestException({
      message: errors.flatMap((e) => Object.values(e.constraints ?? {})),
      error: 'ERR_VALIDATION',
    }),
});
```

Filter yang sekarang sudah menggabungkan `message` berupa array menjadi satu string, jadi tidak perlu diubah di bagian
itu.

2. **Filter penangkap semua error:** ubah `@Catch(HttpException)` menjadi `@Catch()` dan tipe parameter menjadi
   `unknown`. Logikanya:
    - Jika `exception instanceof HttpException`: perilaku lama, tidak berubah
    - Selain itu: `statusCode 500`, `message: 'Terjadi kesalahan pada server'`, `error: 'ERR_INTERNAL'`
    - **Jangan** mengirim pesan error asli ke client. Catat lewat `Logger` dari `@nestjs/common`
      (`this.logger.error(...)`) supaya bisa kamu baca di terminal
3. Pastikan `Logger` dipakai, bukan `console.log`.
4. Opsional, tapi sebaiknya: perbaiki `CORS_ORIGIN`. Kode memakai `'*'` bersama `credentials: true` kalau variabel
   kosong, kombinasi yang ditolak browser. Isi `CORS_ORIGIN` di `.env`, atau hapus `credentials: true` karena auth
   memakai header Bearer, bukan cookie.

**Selesai jika:**

- Login dengan body `{}` menghasilkan 400 dengan `error: "ERR_VALIDATION"`
- Login dengan field tambahan (misalnya `"foo": 1`) tetap diproses, field itu diabaikan
- Memicu error tak terduga (misalnya mematikan database lalu login) menghasilkan 500 dengan `error: "ERR_INTERNAL"`,
  tanpa menampilkan pesan Prisma ke client, dan detailnya muncul di log terminal

**Commit:** `fix(api): align validation errors and catch-all filter with api contract`

---

## 5. Tes Manual Auth

**Persiapan:**

- Database dan seed sudah jalan, server aktif (`pnpm start:dev`)
- Pakai Postman, Thunder Client, atau `curl`
- Endpoint selain login belum ada. Untuk menguji 401 dan 403, buat **controller sementara** (jangan di-commit):

```ts

@Controller('debug')
export class DebugController {
  @Get('semua-role')
  semuaRole() {
    return { ok: true };
  }

  @Roles(Role.Musyrif)
  @Get('musyrif')
  musyrifSaja() {
    return { ok: true };
  }
}
```

Daftarkan di `AppModule`, hapus setelah tes selesai.

**Skenario dan hasil yang diharapkan:**

| No | Skenario                                                                                                                      | Hasil yang diharapkan                                                              |
|----|-------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------|
| 1  | Login Admin tanpa `device_id`                                                                                                 | 201, `profil: null`, ada `access_token`                                            |
| 2  | Login Musyrif tanpa `device_id`                                                                                               | 201, profil berisi `id_musyrif`, `nama`, `no_telepon`                              |
| 3  | Login Mahasantri dengan `device_id`                                                                                           | 201, profil berisi `nim`, `nama`, `kamar`, `status_aktif`, dan `musyrif` (ringkas) |
| 4  | Login Mahasantri tanpa `device_id`                                                                                            | 400 `ERR_DEVICE_ID_REQUIRED`                                                       |
| 5  | Login ulang Mahasantri yang sama, `device_id` sama                                                                            | 201                                                                                |
| 6  | Login Mahasantri yang sama, `device_id` berbeda                                                                               | 401 `ERR_DEVICE_MISMATCH`                                                          |
| 7  | Login Mahasantri lain memakai `device_id` milik santri pertama                                                                | 401 `ERR_DEVICE_MISMATCH`                                                          |
| 8  | Password salah                                                                                                                | 401 `ERR_INVALID_CREDENTIALS`                                                      |
| 9  | Username tidak ada                                                                                                            | 401 `ERR_INVALID_CREDENTIALS` (pesan sama dengan nomor 8)                          |
| 10 | Login Mahasantri nonaktif                                                                                                     | 403 `ERR_ACCOUNT_INACTIVE`                                                         |
| 11 | Body kosong `{}`                                                                                                              | 400 `ERR_VALIDATION`                                                               |
| 12 | Response login tidak memuat `password` atau `device_id`                                                                       | Periksa body response                                                              |
| 13 | `GET /v1/debug/semua-role` tanpa token                                                                                        | 401                                                                                |
| 14 | Endpoint yang sama dengan token rusak atau diubah                                                                             | 401                                                                                |
| 15 | `GET /v1/debug/musyrif` dengan token Musyrif                                                                                  | 200                                                                                |
| 16 | `GET /v1/debug/musyrif` dengan token Mahasantri                                                                               | 403 `ERR_FORBIDDEN_ROLE`                                                           |
| 17 | `GET /v1/debug/musyrif` dengan token Admin                                                                                    | 403 `ERR_FORBIDDEN_ROLE`                                                           |
| 18 | Login Mahasantri aktif dan simpan token, ubah `status_aktif` jadi `false` di database, lalu panggil endpoint dengan token itu | 401 `ERR_ACCOUNT_INACTIVE`                                                         |

**Tambahan:**

- Cek format semua response sesuai contract (`success`, `statusCode`, `message`, `data` atau `error`)
- Cek isi `.env` tidak muncul di `git status`

**Selesai jika:** semua baris di atas sesuai. Catat hasilnya (lulus atau gagal beserta response aslinya) supaya bisa
dijadikan bukti di laporan.

**Setelah itu:**

1. Hapus `DebugController`
2. Commit semua yang belum ter-commit
3. Perbarui checklist di bawah
4. Mulai tahap 4 (master data Admin)

---

## Checklist

- [x] 1 Volume Postgres diperbaiki dan diverifikasi
- [x] 2 Seed jalan dua kali tanpa error, semua akun bisa login
- [ ] 3 Guard global, `@Public()`, `ERR_FORBIDDEN_ROLE` (rename file sudah, sisanya belum)
- [ ] 4 `ERR_VALIDATION`, tanpa `forbidNonWhitelisted`, filter error umum
- [ ] 5 Delapan belas skenario tes manual lulus
- [ ] Controller debug sudah dihapus
- [x] Semua perubahan ter-commit dengan pesan Conventional Commits