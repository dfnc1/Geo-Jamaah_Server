import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '@generated/prisma/enums';

interface RequestWithUser {
  user?: { role: Role };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles: Role[] = this.reflector.getAllAndOverride<Role[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException({
        message: 'Akses ditolak: pengguna tidak memiliki role yang valid',
        error: 'ERR_FORBIDDEN_ROLE',
      });
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException({
        message: 'Anda tidak memiliki akses ke resource ini',
        error: 'ERR_FORBIDDEN_ROLE',
      });
    }
    return true;
  }
}
