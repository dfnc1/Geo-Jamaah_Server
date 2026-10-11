import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE, Roles } from '../decorators/roles.decorator';

export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles: ROLE = this.reflector.getAllAndOverride<ROLE>(Roles, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    const user = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}
