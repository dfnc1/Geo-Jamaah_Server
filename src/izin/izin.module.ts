import { Module } from '@nestjs/common';
import { PrismaModule } from '@src/prisma/prisma.module';
import { IzinController } from './izin.controller';
import { MusyrifIzinController } from './musyrif-izin.controller';
import { IzinService } from './izin.service';

/**
 * Modul izin (tahap 7): pengajuan & daftar oleh Mahasantri, filter &
 * verifikasi oleh Musyrif pembina. Satu service untuk kedua peran karena
 * berbagi data dan aturan state machine yang sama.
 */
@Module({
  imports: [PrismaModule],
  controllers: [IzinController, MusyrifIzinController],
  providers: [IzinService],
})
export class IzinModule {}
