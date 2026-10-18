# Geo-Jamaah_Server - konteks tetap

Backend presensi shalat berjamaah berbasis geofencing untuk mahasantri
(proyek tugas akhir). Stack: NestJS, PostgreSQL, Prisma 7, JWT + Passport,
bcrypt, class-validator, Swagger, pnpm. Role (persis): Mahasantri,
Musyrif, Admin.

Sumber kebenaran: docs/API_CONTRACT.md, docs/BUSINESS_RULES.md,
docs/DATABASE_SCHEMA.md, prisma/schema.prisma, docs/CODE_REVIEW.md
(daftar progres dan backlog). Baca CODE_REVIEW.md dulu di setiap sesi.

Aturan:
- Jangan mengarang endpoint, field, atau aturan di luar dokumen. Jika ada
  yang kurang jelas atau bertentangan, tanya dulu.
- Jangan mengubah prisma/schema.prisma tanpa izin saya.
- Format response sukses {success, statusCode, message, data}, error
  {success, statusCode, message, error}. Interceptor mengambil "message"
  dari objek yang dikembalikan controller. Kode error berbentuk ERR_XXX.
- Semua endpoint otomatis butuh token (guard global). Login memakai
  @Public(). Endpoint khusus role wajib @Roles(...).
- Import pakai alias @src/* dan @generated/*. Nama file DTO berakhiran
  .dto.ts. Setiap field DTO request wajib punya decorator class-validator
  (whitelist aktif).
- Jangan membaca atau mencetak isi .env. Jangan menjalankan perintah yang
  menghapus data (migrate reset, db push --force-reset, docker compose
  down -v) tanpa izin.
- Pakai pnpm. Jawab dalam Bahasa Indonesia.
- Jangan commit. Saya yang commit. Sarankan pesan commit Conventional
  Commits di akhir pekerjaan.
- Setelah selesai, jelaskan singkat setiap file yang dibuat atau diubah
  dan alasannya, supaya saya bisa menjelaskannya saat demo. Untuk logika
  inti (Haversine, window time, double presensi, state machine izin, EWS,
  scheduled job), jelaskan rumus atau alurnya dan beri contoh angka.

## Aturan commit dan kebersihan (berlaku setiap tahap)
- Satu tahap = satu atau beberapa commit kecil, selesai di sesi yang
  sama. Jangan memulai tahap baru dengan perubahan yang belum ter-commit.
- Sebelum commit: git status, pnpm build, pnpm lint, pnpm test. Jangan
  commit jika salah satu gagal.
- Dokumen yang terdampak (API_CONTRACT.md, FRONTEND_GUIDE.md, README.md,
  CODE_REVIEW.md) diperbarui di commit yang sama dengan kodenya.
- Data uji manual wajib berawalan "Tes" (contoh: "Masjid Tes Tahap 5")
  dan dibersihkan di akhir tahap dengan filter spesifik. Jangan
  meninggalkan device_id tes pada akun seed. Jangan memakai perintah
  yang menghapus semua data.
- Pesan commit Conventional Commits, subject bahasa Inggris, huruf kecil.
- Perbedaan antara kode dan dokumen yang ditemukan saat tes diperbaiki
  di tahap itu juga, atau dicatat di CODE_REVIEW.md. Tidak boleh dibiarkan
  diam-diam.
- Akhiri tiap tahap dengan git status yang bersih dan ringkasan: file
  berubah, tes yang dijalankan, data uji yang dibersihkan.