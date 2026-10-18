import { Module } from '@nestjs/common';
import { PrismaModule } from '@src/prisma/prisma.module';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogController } from './activity-log.controller';

/**
 * Modul activity log (BR-11, tahap 11). Menyediakan:
 * - `ActivityLogService` (fire-and-forget write + pencarian dengan filter
 *   + pagination, dipakai Admin melalui controller).
 * - `ActivityLogController` (GET /v1/admin/activity-logs, append-only).
 *
 * Interceptor global didaftarkan di `AppModule` sebagai APP_INTERCEPTOR.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ActivityLogController],
  providers: [ActivityLogService],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
