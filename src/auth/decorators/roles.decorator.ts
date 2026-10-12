import { ReflectableDecorator, Reflector } from '@nestjs/core';

export enum ROLE {
  MAHASANTRI = 'MAHASANTRI',
  MUSYRIF = 'MUSYRIF',
}

export const Roles: ReflectableDecorator<ROLE> =
  Reflector.createDecorator<ROLE>();
