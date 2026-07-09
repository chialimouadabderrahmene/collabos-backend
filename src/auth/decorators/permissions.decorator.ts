import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../auth.constants';

export const RequirePermissions = (
  ...permissions: string[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);
