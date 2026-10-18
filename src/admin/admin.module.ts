import { Module } from '@nestjs/common';
import { MasjidModule } from './masjid/masjid.module';
import { JadwalSholatModule } from './jadwal-sholat/jadwal-sholat.module';
import { MahasantriModule } from './mahasantri/mahasantri.module';

/**
 * Master data Admin (tahap 4). Tiap resource punya module sendiri
 * (masjid, jadwal-sholat, mahasantri); module ini hanya menggabungkannya
 * supaya cukup diimpor sekali oleh AppModule.
 *
 * Semua endpoint di dalamnya memakai `@Roles(Role.Admin)` dan mengikuti
 * pola auth yang sama (guard global JwtAuthGuard + RolesGuard).
 */
@Module({
  imports: [MasjidModule, JadwalSholatModule, MahasantriModule],
})
export class AdminModule {}
