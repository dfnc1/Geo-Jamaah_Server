import { UnauthorizedException } from '@nestjs/common';
import { Role } from '@generated/prisma/enums';

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

jest.mock('@nestjs/passport', () => ({
  PassportStrategy: () =>
    class MockPassportStrategy {
      constructor() {}
    },
}));

jest.mock('passport-jwt', () => ({
  ExtractJwt: {
    fromAuthHeaderAsBearerToken: jest.fn(),
  },
  Strategy: class MockStrategy {},
}));

import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@src/prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prismaMock: {
    pengguna: {
      findUnique: jest.Mock;
    };
  };
  let configMock: {
    getOrThrow: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      pengguna: {
        findUnique: jest.fn(),
      },
    };
    configMock = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    };

    strategy = new JwtStrategy(
      configMock as unknown as ConfigService,
      prismaMock as unknown as PrismaService,
    );
  });

  it('menolak token bila pengguna tidak ada di database (ERR_UNAUTHORIZED)', async () => {
    prismaMock.pengguna.findUnique.mockResolvedValue(null);

    await expect(
      strategy.validate({
        sub: 'uuid-1',
        username: 'musyrif1',
        role: Role.Musyrif,
      }),
    ).rejects.toThrow(UnauthorizedException);

    let caught: unknown;
    try {
      await strategy.validate({
        sub: 'uuid-1',
        username: 'musyrif1',
        role: Role.Musyrif,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(UnauthorizedException);
    expect((caught as UnauthorizedException).getResponse()).toMatchObject({
      message: 'Token tidak valid atau akun tidak ditemukan',
      error: 'ERR_UNAUTHORIZED',
    });
  });

  it('menolak token Mahasantri bila akun dinonaktifkan (ERR_ACCOUNT_INACTIVE)', async () => {
    prismaMock.pengguna.findUnique.mockResolvedValue({
      id_pengguna: 'uuid-santri',
      username: 'santri_nonaktif',
      role: Role.Mahasantri,
      mahasantri: { status_aktif: false },
    });

    await expect(
      strategy.validate({
        sub: 'uuid-santri',
        username: 'santri_nonaktif',
        role: Role.Mahasantri,
      }),
    ).rejects.toThrow(UnauthorizedException);

    let caught: unknown;
    try {
      await strategy.validate({
        sub: 'uuid-santri',
        username: 'santri_nonaktif',
        role: Role.Mahasantri,
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(UnauthorizedException);
    expect((caught as UnauthorizedException).getResponse()).toMatchObject({
      message: 'Akun Anda telah dinonaktifkan',
      error: 'ERR_ACCOUNT_INACTIVE',
    });
  });

  it('menerima token Mahasantri bila akun aktif', async () => {
    prismaMock.pengguna.findUnique.mockResolvedValue({
      id_pengguna: 'uuid-santri',
      username: 'santri_aktif',
      role: Role.Mahasantri,
      mahasantri: { status_aktif: true },
    });

    const result = await strategy.validate({
      sub: 'uuid-santri',
      username: 'santri_aktif',
      role: Role.Mahasantri,
    });

    expect(result).toEqual({
      sub: 'uuid-santri',
      username: 'santri_aktif',
      role: Role.Mahasantri,
    });
  });

  it('menerima token Musyrif / Admin bila akun ada di database', async () => {
    prismaMock.pengguna.findUnique.mockResolvedValue({
      id_pengguna: 'uuid-admin',
      username: 'admin',
      role: Role.Admin,
      mahasantri: null,
    });

    const result = await strategy.validate({
      sub: 'uuid-admin',
      username: 'admin',
      role: Role.Admin,
    });

    expect(result).toEqual({
      sub: 'uuid-admin',
      username: 'admin',
      role: Role.Admin,
    });
  });
});
