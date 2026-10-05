import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Role } from '../../generated/prisma/client';
import {
  AuthResponseDto,
  LoginDto,
  MahasantriProfileDto,
  MusyrifProfileDto,
} from './dto/login.dto';
import * as bcrypt from 'bcrypt';

type UserWithProfil = Prisma.PenggunaGetPayload<{
  include: {
    mahasantri: {
      include: { musyrif: { select: { id_musyrif: true; nama: true } } };
    };
    musyrif: true;
  };
}>;

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prismaService: PrismaService,
  ) {}

  async validateUser(
    username: string,
    pass: string,
  ): Promise<UserWithProfil | null> {
    const user = await this.prismaService.pengguna.findUnique({
      where: { username },
      include: {
        mahasantri: {
          include: {
            musyrif: {
              select: {
                id_musyrif: true,
                nama: true,
              },
            },
          },
        },
        musyrif: true,
      },
    });

    if (!user) return null;

    const ok = await bcrypt.compare(pass, user.password);

    return ok ? user : null;
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.validateUser(dto.username, dto.password);
    if (!user) {
      throw new UnauthorizedException({
        message: 'Username atau password salah',
        error: 'ERR_INVALID_CREDENTIALS',
      });
    }

    if (user.role === Role.Mahasantri) {
      if (!user.mahasantri?.status_aktif) {
        throw new ForbiddenException({
          message: 'Akun tidak aktif',
          error: 'ERR_ACCOUNT_INACTIVE',
        });
      }
      await this.bindDevice(user.id_pengguna, user.device_id, dto.device_id);
    }

    const payload = {
      sub: user.id_pengguna,
      username: user.username,
      role: user.role,
    };

    return {
      token_type: 'Bearer',
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id_pengguna: user.id_pengguna,
        username: user.username,
        role: user.role,
        profil: this.buildProfil(user),
      },
    };
  }
  private async bindDevice(
    idPengguna: string,
    currentDeviceId: string | null,
    incomingDeviceId: string,
  ) {
    if (currentDeviceId === incomingDeviceId) return;

    if (currentDeviceId) {
      throw this.deviceMismatch();
    }

    try {
      await this.prismaService.pengguna.update({
        where: { id_pengguna: idPengguna },
        data: { device_id: incomingDeviceId },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw this.deviceMismatch();
      }
      throw e;
    }
  }

  private deviceMismatch() {
    return new UnauthorizedException({
      message: 'Akun atau perangkat ini sudah terikat ke perangkat/akun lain',
      error: 'ERR_DEVICE_MISMATCH',
    });
  }

  private buildProfil(
    user: UserWithProfil,
  ): MusyrifProfileDto | MahasantriProfileDto | null {
    if (user.role === Role.Mahasantri && user.mahasantri) {
      const m = user.mahasantri;
      return {
        nim: m.nim,
        nama: m.nama,
        kamar: m.kamar,
        status_aktif: m.status_aktif,
        musyrif: { id_musyrif: m.musyrif.id_musyrif, nama: m.musyrif.nama },
      };
    }

    if (user.role === Role.Musyrif && user.musyrif) {
      const s = user.musyrif;
      return {
        id_musyrif: s.id_musyrif,
        nama: s.nama,
        no_telepon: s.no_telepon,
      };
    }

    return null;
  }
}
