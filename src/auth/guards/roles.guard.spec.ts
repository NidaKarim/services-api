import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../entities/user.entity';

const contextWithUser = (user: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext);

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const requireRoles = (roles: UserRole[] | undefined) =>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);

  it('allows any authenticated user when the route declares no roles', () => {
    requireRoles(undefined);
    expect(guard.canActivate(contextWithUser({ role: UserRole.VIEWER }))).toBe(
      true,
    );
  });

  it('treats an empty roles array as no restriction', () => {
    requireRoles([]);
    expect(guard.canActivate(contextWithUser({ role: UserRole.VIEWER }))).toBe(
      true,
    );
  });

  it('allows a user holding the required role', () => {
    requireRoles([UserRole.ADMIN]);
    expect(guard.canActivate(contextWithUser({ role: UserRole.ADMIN }))).toBe(
      true,
    );
  });

  it('blocks a user without the required role', () => {
    requireRoles([UserRole.ADMIN]);
    expect(guard.canActivate(contextWithUser({ role: UserRole.VIEWER }))).toBe(
      false,
    );
  });

  it('blocks when no user is attached to the request', () => {
    requireRoles([UserRole.ADMIN]);
    expect(guard.canActivate(contextWithUser(undefined))).toBe(false);
  });
});
