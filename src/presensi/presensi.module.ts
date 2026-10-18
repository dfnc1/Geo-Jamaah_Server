import { Module } from '@nestjs/common';
import { PrismaModule } from '@src/prisma/prisma.module';
import { PresensiController } from './presensi.controller';
import { PresensiService } from './presensi.service';
import { MusyrifPresensiController } from './musyrif-presensi.controller';
import { MusyrifPresensiService } from './musyrif-presensi.service';

@Module({
  imports: [PrismaModule],
  controllers: [PresensiController, MusyrifPresensiController],
  providers: [PresensiService, MusyrifPresensiService],
})
export class PresensiModule {}
