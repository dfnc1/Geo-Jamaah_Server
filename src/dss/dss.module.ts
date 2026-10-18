import { Module } from '@nestjs/common';
import { PrismaModule } from '@src/prisma/prisma.module';
import { MusyrifDssController } from './musyrif-dss.controller';
import { DssService } from './dss.service';

/** DSS & EWS: daftar santri kritis untuk Musyrif (BR-08). */
@Module({
  imports: [PrismaModule],
  controllers: [MusyrifDssController],
  providers: [DssService],
})
export class DssModule {}
