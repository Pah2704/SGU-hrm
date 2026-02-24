import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma';
import type { LoginDto } from './dto';
import { AuditService } from '../modules/audit/audit.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

interface AuthRolePermissionRow {
  permission: {
    code: string;
  };
}

interface AuthUserRoleRow {
  role: {
    name: string;
    permissions: AuthRolePermissionRow[];
  };
}

interface AuthUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  roles: AuthUserRoleRow[];
  employee: { unitId: string } | null;
}

interface ProfileRoleRow {
  role: {
    name: string;
    displayName: string;
  };
}

interface ProfileUserRecord {
  id: string;
  email: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  roles: ProfileRoleRow[];
  employee: {
    id: string;
    employeeCode: string;
    fullName: string;
    avatarUrl: string | null;
    unit: {
      id: string;
      name: string;
    };
  } | null;
}

type UserFindUniqueResult = AuthUserRecord | ProfileUserRecord | null;

interface PrismaMock {
  user: {
    findUnique: jest.Mock<Promise<UserFindUniqueResult>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
  };
}

interface JwtMock {
  sign: jest.Mock<string, [unknown, unknown?]>;
  verify: jest.Mock<{ sub: string; type: string }, [string, unknown]>;
}

const buildAuthUser = (
  overrides: Partial<AuthUserRecord> = {},
): AuthUserRecord => ({
  id: 'user-1',
  email: 'admin@sgu.edu.vn',
  passwordHash: 'hashed-password',
  isActive: true,
  roles: [
    {
      role: {
        name: 'SUPER_ADMIN',
        permissions: [
          { permission: { code: 'employees:read' } },
          { permission: { code: 'employees:write' } },
        ],
      },
    },
  ],
  employee: { unitId: 'unit-1' },
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaMock;
  let jwt: JwtMock;
  let configValues: Record<string, string>;
  let auditService: { record: jest.Mock };

  beforeEach(async () => {
    configValues = {
      JWT_SECRET: 'test-secret',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
    };

    prisma = {
      user: {
        findUnique: jest.fn<Promise<UserFindUniqueResult>, [unknown]>(),
        update: jest.fn<Promise<unknown>, [unknown]>(),
      },
    };

    jwt = {
      sign: jest.fn<string, [unknown, unknown?]>(),
      verify: jest.fn<{ sub: string; type: string }, [string, unknown]>(),
    };

    const configService = {
      get: jest.fn((key: string) => configValues[key]),
    };

    auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prisma as unknown as PrismaService,
        },
        {
          provide: JwtService,
          useValue: jwt as unknown as JwtService,
        },
        {
          provide: ConfigService,
          useValue: configService as unknown as ConfigService,
        },
        {
          provide: AuditService,
          useValue: auditService as unknown as AuditService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const dto: LoginDto = {
      email: 'admin@sgu.edu.vn',
      password: 'Admin@123',
    };

    it('throws when user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws when user is deactivated', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildAuthUser({ isActive: false }),
      );

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws when password is invalid', async () => {
      prisma.user.findUnique.mockResolvedValue(buildAuthUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('returns tokens and expiresIn when credentials are valid', async () => {
      prisma.user.findUnique.mockResolvedValue(buildAuthUser());
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({});
      jwt.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.login(dto);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
      });
      expect(prisma.user.update).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('returns new access token with valid refresh token', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1', type: 'refresh' });
      prisma.user.findUnique.mockResolvedValue(buildAuthUser());
      jwt.sign.mockReturnValue('new-access-token');

      const result = await service.refresh('valid-refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        expiresIn: 900,
      });
    });

    it('throws when token type is not refresh', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1', type: 'access' });

      await expect(service.refresh('invalid-type-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when user is inactive during refresh', async () => {
      jwt.verify.mockReturnValue({ sub: 'user-1', type: 'refresh' });
      prisma.user.findUnique.mockResolvedValue(
        buildAuthUser({ isActive: false }),
      );

      await expect(service.refresh('inactive-user-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when verify fails', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('token invalid');
      });

      await expect(service.refresh('broken-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getProfile', () => {
    it('throws when profile is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('missing-user')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns profile with mapped roles', async () => {
      const profileUser: ProfileUserRecord = {
        id: 'user-1',
        email: 'admin@sgu.edu.vn',
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        roles: [
          {
            role: {
              name: 'SUPER_ADMIN',
              displayName: 'Super Admin',
            },
          },
        ],
        employee: {
          id: 'emp-1',
          employeeCode: 'EMP001',
          fullName: 'Admin User',
          avatarUrl: null,
          unit: {
            id: 'unit-1',
            name: 'SGU',
          },
        },
      };

      prisma.user.findUnique.mockResolvedValue(profileUser);

      const result = await service.getProfile('user-1');

      expect(result.roles).toEqual([
        {
          name: 'SUPER_ADMIN',
          displayName: 'Super Admin',
        },
      ]);
      expect(result.email).toBe('admin@sgu.edu.vn');
    });
  });
});
