import { UserRole } from './entities/user.entity';

export interface JwtPayload {
  /** Subject — the user id. */
  sub: string;
  email: string;
  role: UserRole;
}

/** Shape attached to `request.user` once the JWT strategy has validated. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}
