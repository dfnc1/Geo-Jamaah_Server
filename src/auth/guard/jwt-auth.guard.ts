import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@src/auth/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  /**
   * Menyeragamkan respons 401 dengan kontrak API:
   * - `err` dari strategy (mis. `ERR_ACCOUNT_INACTIVE` dari JwtStrategy
   *   saat akun dinonaktifkan) dilempar apa adanya agar kode errornya
   *   tidak hilang;
   * - tanpa `err` tetapi tanpa `user` (token hilang, tidak sah, atau
   *   kedaluwarsa) → 401 `ERR_UNAUTHORIZED`.
   */
  override handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false | null,
  ): TUser {
    if (err) throw err;

    if (!user) {
      throw new UnauthorizedException({
        message: 'Token tidak valid atau tidak ada',
        error: 'ERR_UNAUTHORIZED',
      });
    }

    return user;
  }
}
