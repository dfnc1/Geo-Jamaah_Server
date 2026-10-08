import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE, Roles } from '../decorators/roles.decorator';

export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredeRoles: ROLE = this.reflector.getAllAndOverride<ROLE>(Roles, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredeRoles) return true;
    const user = context.switchToHttp().getRequest();
    return requiredeRoles.includes(user.role);
  }
}
