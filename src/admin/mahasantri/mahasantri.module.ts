import { Module } from '@nestjs/common';
import { PrismaModule } from '@src/prisma/prisma.module';
import { MahasantriController } from './mahasantri.controller';
import { MahasantriService } from './mahasantri.service';

@Module({
  imports: [PrismaModule],
  controllers: [MahasantriController],
  providers: [MahasantriService],
})
export class MahasantriModule {}
