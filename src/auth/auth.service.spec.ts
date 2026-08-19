import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User, UserRole } from './entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: jest.Mocked<any>;
  let jwtService: jest.Mocked<any>;

  const passwordHash = bcrypt.hashSync('password123', 4);
  const adminUser = {
    id: 'user-1',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    passwordHash,
  };

  beforeEach(async () => {
    userRepo = { findOne: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('returns a token and the user for valid credentials', async () => {
    userRepo.findOne.mockResolvedValue(adminUser);

    const result = await service.login({
      email: 'admin@example.com',
      password: 'password123',
    });

    expect(result).toEqual({
      accessToken: 'signed.jwt.token',
      user: {
        id: 'user-1',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      },
    });
  });

  it('signs the role into the token so RolesGuard can read it', async () => {
    userRepo.findOne.mockResolvedValue(adminUser);

    await service.login({
      email: 'admin@example.com',
      password: 'password123',
    });

    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
    });
  });

  it('never returns the password hash', async () => {
    userRepo.findOne.mockResolvedValue(adminUser);

    const result = await service.login({
      email: 'admin@example.com',
      password: 'password123',
    });

    expect(JSON.stringify(result)).not.toContain(passwordHash);
  });

  it('rejects a wrong password', async () => {
    userRepo.findOne.mockResolvedValue(adminUser);

    await expect(
      service.login({ email: 'admin@example.com', password: 'wrongpassword' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('gives an unknown email the same error as a wrong password', async () => {
    userRepo.findOne.mockResolvedValue(null);

    // Identical message: the response must not confirm which emails exist.
    await expect(
      service.login({ email: 'nobody@example.com', password: 'password123' }),
    ).rejects.toThrow('Invalid email or password');
  });

  it('looks the user up case-insensitively and asks for the hash explicitly', async () => {
    userRepo.findOne.mockResolvedValue(adminUser);

    await service.login({
      email: 'ADMIN@Example.com',
      password: 'password123',
    });

    expect(userRepo.findOne).toHaveBeenCalledWith({
      where: { email: 'admin@example.com' },
      select: ['id', 'email', 'role', 'passwordHash'],
    });
  });
});
