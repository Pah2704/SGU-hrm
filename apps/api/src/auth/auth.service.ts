import {
  Logger,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { SignOptions } from 'jsonwebtoken';
import { PrismaService } from '../prisma';
import { LoginDto, TokenResponse } from './dto';
import type { JwtPayload } from './interfaces';
import { AuditService } from '../modules/audit/audit.service';

interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}

export interface LoginResult extends TokenResponse {
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private auditService: AuditService,
  ) {}

  /**
   * Authenticate user and generate tokens
   */
  async login(dto: LoginDto): Promise<LoginResult> {
    // 1. Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        employee: {
          select: { unitId: true },
        },
      },
    });

    if (!user) {
      this.logger.warn(`Login failed: user not found (${dto.email})`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // 2. Verify password
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      this.logger.warn(`Login failed: invalid password (${dto.email})`);
      throw new UnauthorizedException('Invalid credentials');
    }

    // 3. Extract roles and permissions
    const roles = user.roles.map((ur) => ur.role.name);
    const permissions = this.extractPermissions(user.roles);
    const unitId = user.employee?.unitId;

    // 4. Generate tokens
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles,
      permissions,
      unitId,
    };

    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.generateRefreshToken(user.id);

    // 5. Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.record(
      { userId: user.id, roles },
      'AUTH',
      user.id,
      'LOGIN',
      {
        email: user.email,
      },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.getExpiresInSeconds(),
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    // For MVP: simple token validation
    // In production: store refresh tokens in Redis/DB with expiry

    // Decode and verify refresh token (it's also a JWT for simplicity)
    try {
      const jwtSecret = this.config.get<string>('JWT_SECRET') ?? '';

      const decoded = this.jwt.verify<RefreshTokenPayload>(refreshToken, {
        secret: jwtSecret,
      });

      if (decoded.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Reload user with fresh permissions
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
          employee: {
            select: { unitId: true },
          },
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or deactivated');
      }

      const roles = user.roles.map((ur) => ur.role.name);
      const permissions = this.extractPermissions(user.roles);

      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        roles,
        permissions,
        unitId: user.employee?.unitId,
      };

      await this.auditService.record(
        { userId: user.id, roles },
        'AUTH',
        user.id,
        'REFRESH',
      );

      return {
        accessToken: this.jwt.sign(payload),
        expiresIn: this.getExpiresInSeconds(),
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Logout - invalidate refresh token
   * For MVP: client simply discards token
   * For production: implement token blacklist/revocation
   */
  logout(userId: string): { message: string } {
    void this.auditService.record({ userId }, 'AUTH', userId, 'LOGOUT');
    // TODO: Implement refresh token revocation in Redis/DB
    return { message: 'Logged out successfully' };
  }

  /**
   * Get current user profile with roles
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        roles: {
          select: {
            role: {
              select: {
                name: true,
                displayName: true,
              },
            },
          },
        },
        employee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            avatarUrl: true,
            unit: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    return {
      ...user,
      roles: user.roles.map((r) => r.role),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────

  private extractPermissions(
    userRoles: Array<{
      role: {
        permissions: Array<{
          permission: { code: string };
        }>;
      };
    }>,
  ): string[] {
    const permissionSet = new Set<string>();

    for (const ur of userRoles) {
      for (const rp of ur.role.permissions) {
        permissionSet.add(rp.permission.code);
      }
    }

    return Array.from(permissionSet);
  }

  private generateRefreshToken(userId: string): string {
    // Generate refresh token with longer expiry
    const expiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    return this.jwt.sign(
      { sub: userId, type: 'refresh' },
      { expiresIn: expiresIn as SignOptions['expiresIn'] },
    );
  }

  private getExpiresInSeconds(): number {
    const expiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    // Parse "15m" → 900 seconds
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 900;

    const [, valueText, unit] = match;
    const value = parseInt(valueText, 10);

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 900;
    }
  }
}
