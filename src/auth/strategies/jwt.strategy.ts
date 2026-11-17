import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '@generated/prisma/enums';
import { PrismaService } from '@src/prisma/prisma.service';

interface JwtPayload {
  sub: string;
  username: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    configService: ConfigService,
    private prismaService: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prismaService.pengguna.findUnique({
      where: { id_pengguna: payload.sub },
      select: {
        id_pengguna: true,
        username: true,
        role: true,
        mahasantri: {
          select: { status_aktif: true },
        },
      },
    });

    if (!user) {
      this.logger.warn(
        `Token ditolak: pengguna ${payload.sub} tidak ditemukan di database`,
      );
      throw new UnauthorizedException({
        message: 'Token tidak valid atau akun tidak ditemukan',
        error: 'ERR_UNAUTHORIZED',
      });
    }

    if (user.role === Role.Mahasantri) {
      if (!user.mahasantri || !user.mahasantri.status_aktif) {
        this.logger.warn(
          `Token ditolak: akun Mahasantri ${payload.sub} tidak aktif atau profil tidak ditemukan`,
        );
        throw new UnauthorizedException({
          message: 'Akun Anda telah dinonaktifkan',
          error: 'ERR_ACCOUNT_INACTIVE',
        });
      }
    }

    return {
      sub: user.id_pengguna,
      username: user.username,
      role: user.role,
    };
  }
}
