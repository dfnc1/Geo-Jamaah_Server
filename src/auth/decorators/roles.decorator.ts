import { ReflectableDecorator, Reflector } from '@nestjs/core';

export enum ROLE {
  MAHASANTRI = 'MAHASANTRI',
  MUSYRIF = 'MUSYR  IF',
}

export const Roles: ReflectableDecorator<ROLE> =
  Reflector.createDecorator<ROLE>();