import { Module } from '@nestjs/common';
import { PrismaModule } from '@src/prisma/prisma.module';
import { MasjidController } from './masjid.controller';
import { MasjidService } from './masjid.service';

@Module({
  imports: [PrismaModule],
  controllers: [MasjidController],
  providers: [MasjidService],
})
export class MasjidModule {}
