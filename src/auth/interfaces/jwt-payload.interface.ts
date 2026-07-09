export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  isEmailVerified: boolean;
  isActive: boolean;
  roles: string[];
  permissions: string[];
}
