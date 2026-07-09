import { User } from '@prisma/client';
import { UserResponse } from '../types/user-response.types';

export type UserWithRoles = User & { roles: { name: string }[] };

export function toUserResponse(user: UserWithRoles): UserResponse {
  return {
    id: user.id,
    email: user.email,
    isEmailVerified: user.isEmailVerified,
    isActive: user.isActive,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    roles: user.roles.map((role) => role.name),
    createdAt: user.createdAt,
  };
}
