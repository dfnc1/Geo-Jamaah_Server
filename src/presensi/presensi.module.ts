import { Module } from '@nestjs/common';
import { PrismaModule } from '@src/prisma/prisma.module';
import { PresensiController } from './presensi.controller';
import { PresensiService } from './presensi.service';

@Module({
  imports: [PrismaModule],
  controllers: [PresensiController],
  providers: [PresensiService],
})
export class PresensiModule {}
