import { Module } from '@nestjs/common';
import { PrismaModule } from '@src/prisma/prisma.module';
import { JobsController } from './jobs.controller';
import { TandaiTidakHadirService } from './tandai-tidak-hadir.service';

/**
 * Modul scheduled job (tahap 8): cron otomatis dan pemicu manual Admin
 * untuk menandai Mahasantri yang tidak presensi (BR-05).
 */
@Module({
  imports: [PrismaModule],
  controllers: [JobsController],
  providers: [TandaiTidakHadirService],
})
export class JobsModule {}
