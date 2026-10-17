# Code Review & Progress - Geo-Jamaah_Server

Legenda: ✅ selesai, 🟡 sebagian, ⬜ belum.

## Posisi Sekarang

Volume Postgres, seed, RBAC global, dan rapikan `main.ts` sudah beres. Tinggal satu item: tes manual auth untuk
membuktikan seluruh perilaku sebelum lanjut ke tahap 4 (master data Admin).

## Urutan Pengerjaan

| No | Item                                | Prioritas | Status |
|----|-------------------------------------|-----------|--------|
| 5  | Tes manual auth                     | P1        | ⬜     |

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
- [x] 3 Guard global, `@Public()`, `ERR_FORBIDDEN_ROLE`, file di-rename
- [x] 4 `ERR_VALIDATION`, tanpa `forbidNonWhitelisted`, filter error umum
- [ ] 5 Delapan belas skenario tes manual lulus
- [ ] Controller debug sudah dihapus
- [x] Semua perubahan ter-commit dengan pesan Conventional Commits