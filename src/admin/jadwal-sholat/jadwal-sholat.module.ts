import { Module } from '@nestjs/common';
import { PrismaModule } from '@src/prisma/prisma.module';
import { JadwalSholatController } from './jadwal-sholat.controller';
import { JadwalSholatService } from './jadwal-sholat.service';

@Module({
  imports: [PrismaModule],
  controllers: [JadwalSholatController],
  providers: [JadwalSholatService],
})
export class JadwalSholatModule {}
