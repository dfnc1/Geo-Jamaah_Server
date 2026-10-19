import { Module } from '@nestjs/common';
import { PrismaModule } from '@src/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DssModule } from '@src/dss/dss.module';

/**
 * Dashboard & Rekap (tahap 12).
 *
 * Endpoint:
 * - GET /v1/musyrif/dashboard/tren-kehadiran?hari=7  (Musyrif, binaan)
 * - GET /v1/admin/dashboard/tren-kehadiran?hari=7    (Admin, semua aktif)
 * - GET /v1/admin/rekap                              (Admin, rekap global)
 */
@Module({
  imports: [PrismaModule, ConfigModule, DssModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
