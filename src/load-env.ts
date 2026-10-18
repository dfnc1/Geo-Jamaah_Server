import { existsSync } from 'node:fs';

/**
 * Muat `.env` ke process.env SEBELUM modul lain dievaluasi.
 *
 * Dibutuhkan karena ada kode yang membaca process.env pada WAKTU IMPORT —
 * `@Throttle` di auth.controller membaca THROTTLE_LOGIN_LIMIT saat kelas
 * didefinisikan — sedangkan ConfigModule.forRoot baru memuat .env saat
 * body @Module app.module dievaluasi (setelah semua import-nya), yang
 * terlambat untuk dekorator.
 *
 * `process.loadEnvFile` (Node >= 20.12) tidak menimpa env yang sudah ada
 * (sama seperti dotenv), jadi nilai dari shell/container tetap menang.
 * Idempoten: boleh diimpor dari lebih dari satu tempat.
 */
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}
