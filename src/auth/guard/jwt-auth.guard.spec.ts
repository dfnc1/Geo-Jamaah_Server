import 'reflect-metadata';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Public } from '@src/auth/decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

// @nestjs/passport dikirim sebagai ESM; supaya suite bisa jalan dalam mode
// CJS Jest, package-nya dimock. Yang diuji di sini adalah handleRequest
// dan perilaku @Public() pada JwtAuthGuard, bukan passport sendiri.
jest.mock('@nestjs/passport', () => ({
  AuthGuard: () => class MockAuthGuard {},
}));

class TestController {
  @Public()
  publicEndpoint(): string {
    return 'public';
  }

  privateEndpoint(): string {
    return 'private';
  }
}

function contextMock(
  handler: (...args: unknown[]) => unknown,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => TestController,
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard(new Reflector());
  });

  describe('handleRequest', () => {
    it('melempar err dari strategy apa adanya (kode error tidak hilang)', () => {
      // Kasus nyata: JwtStrategy melempar UnauthorizedException
      // ERR_ACCOUNT_INACTIVE saat akun Mahasantri dinonaktifkan.
      const err = new UnauthorizedException({
        message: 'Akun Anda telah dinonaktifkan',
        error: 'ERR_ACCOUNT_INACTIVE',
      });

      expect(() =>
        guard.handleRequest(err, null),
      ).toThrow(err);

      let caught: unknown;
      try {
        guard.handleRequest(err, null);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(UnauthorizedException);
      expect((caught as UnauthorizedException).getResponse()).toMatchObject({
        message: 'Akun Anda telah dinonaktifkan',
        error: 'ERR_ACCOUNT_INACTIVE',
      });
    });

    it('tanpa err dan tanpa user → 401 ERR_UNAUTHORIZED', () => {
      let caught: unknown;
      try {
        guard.handleRequest(null, null);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(UnauthorizedException);
      expect((caught as UnauthorizedException).getStatus()).toBe(401);
      expect((caught as UnauthorizedException).getResponse()).toMatchObject({
        message: 'Token tidak valid atau tidak ada',
        error: 'ERR_UNAUTHORIZED',
      });
    });

    it('user false (token salah/kedaluwarsa) → 401 ERR_UNAUTHORIZED', () => {
      expect(() =>
        guard.handleRequest(null, false),
      ).toThrow(UnauthorizedException);
    });

    it('mengembalikan user apa adanya bila valid', () => {
      const user = { sub: 'id-1', username: 'mahasantri1', role: 'Mahasantri' };
      expect(guard.handleRequest(null, user)).toBe(
        user,
      );
    });
  });

  describe('@Public()', () => {
    it('melewatkan endpoint ber-@Public() tanpa validasi token', () => {
      const canActivate = guard.canActivate(
        contextMock(TestController.prototype.publicEndpoint),
      );
      expect(canActivate).toBe(true);
    });

    it('endpoint biasa tidak dianggap public', () => {
      // dipastikan lewat Reflector: handler tanpa @Public tidak mendapat
      // metadata IS_PUBLIC_KEY, jadi canActivate akan lanjut ke
      // super.canActivate() (validasi JWT) — di sini cukup dibuktikan
      // metadata-nya tidak ada.
      const reflector = new Reflector();
      const isPublic = reflector.getAllAndOverride<boolean>('isPublic', [
        TestController.prototype.privateEndpoint,
        TestController,
      ]);
      expect(isPublic).toBeUndefined();
    });
  });
});
