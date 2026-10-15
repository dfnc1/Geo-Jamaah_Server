import { Injectable, UnauthorizedException } from '@nestjs/common';
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
    if (payload.role === Role.Mahasantri) {
      const santri = await this.prismaService.mahasantri.findUnique({
        where: { id_pengguna: payload.sub },
        select: { status_aktif: true },
      });

      if (!santri || !santri.status_aktif) {
        throw new UnauthorizedException({
          message: 'Akun Anda telah dinonaktifkan',
          error: 'ERR_ACCOUNT_INACTIVE',
        });
      }
    }

    return {
      sub: payload.sub,
      username: payload.username,
      role: payload.role,
    };
  }
}
