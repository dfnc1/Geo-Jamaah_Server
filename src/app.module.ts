import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { PresensiModule } from './presensi/presensi.module';
import { IzinModule } from './izin/izin.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from '@src/auth/guard/jwt-auth.guard';
import { RolesGuard } from '@src/auth/guard/roles.guard';
import { APP_GUARD } from '@nestjs/core';
import { JobsModule } from './jobs/jobs.module';
import { parseThrottleLimit } from './common/throttle-limit';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Batas global longgar (env THROTTLE_GLOBAL_LIMIT, default 600/menit);
    // endpoint sensitif (login) memakai @Throttle yang lebih ketat.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60_000,
            limit: parseThrottleLimit(
              configService.get<string>('THROTTLE_GLOBAL_LIMIT'),
              600,
              'THROTTLE_GLOBAL_LIMIT',
            ),
          },
        ],
      }),
    }),
    PrismaModule,
    // Scheduler untuk job BR-05 (tandai Tidak_Hadir/Izin).
    ScheduleModule.forRoot(),
    AuthModule,
    AdminModule,
    PresensiModule,
    IzinModule,
    JobsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
