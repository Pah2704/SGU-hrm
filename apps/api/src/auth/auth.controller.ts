import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { LoginResult } from './auth.service';
import { LoginDto, TokenResponse } from './dto';
import { Public, CurrentUser } from '../rbac';

const REFRESH_COOKIE_NAME = 'refreshToken';
type CookieRequest = Request & {
  cookies?: unknown;
};

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  /**
   * POST /auth/login
   * Authenticate user and return access token.
   * Refresh token is stored in httpOnly cookie.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenResponse> {
    const loginResult = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, loginResult.refreshToken);
    return this.toTokenResponse(loginResult);
  }

  /**
   * POST /auth/refresh
   * Get new access token using refresh token from cookie
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: CookieRequest): Promise<TokenResponse> {
    const refreshToken = this.getRefreshTokenFromCookie(req);
    return this.authService.refresh(refreshToken);
  }

  /**
   * POST /auth/logout
   * Invalidate refresh token cookie
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(
    @CurrentUser('userId') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): { message: string } {
    this.clearRefreshTokenCookie(res);
    return this.authService.logout(userId);
  }

  /**
   * GET /auth/me (alias for user profile)
   * Handled by UsersController /users/me
   */

  private toTokenResponse(loginResult: LoginResult): TokenResponse {
    return {
      accessToken: loginResult.accessToken,
      expiresIn: loginResult.expiresIn,
    };
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      ...this.getRefreshCookieOptions(),
      maxAge: this.getRefreshTokenMaxAgeMs(),
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE_NAME, this.getRefreshCookieOptions());
  }

  private getRefreshTokenFromCookie(req: CookieRequest): string {
    const cookies = this.parseCookies(req.cookies);
    const refreshTokenFromCookie = cookies?.[REFRESH_COOKIE_NAME];
    if (refreshTokenFromCookie) {
      return refreshTokenFromCookie;
    }

    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
      throw new UnauthorizedException('Missing refresh token cookie');
    }

    const cookie = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${REFRESH_COOKIE_NAME}=`));

    if (!cookie) {
      throw new UnauthorizedException('Missing refresh token cookie');
    }

    return decodeURIComponent(cookie.slice(REFRESH_COOKIE_NAME.length + 1));
  }

  private parseCookies(
    cookies: unknown,
  ): Record<string, string | undefined> | null {
    if (!cookies || typeof cookies !== 'object') {
      return null;
    }

    const parsedCookies = cookies as Record<string, unknown>;
    const normalizedCookies: Record<string, string | undefined> = {};

    for (const [key, value] of Object.entries(parsedCookies)) {
      normalizedCookies[key] = typeof value === 'string' ? value : undefined;
    }

    return normalizedCookies;
  }

  private getRefreshCookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax';
    path: string;
  } {
    return {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/auth',
    };
  }

  private getRefreshTokenMaxAgeMs(): number {
    const fallback = 7 * 24 * 60 * 60 * 1000;
    const refreshTtl =
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    return this.parseDurationToMs(refreshTtl, fallback);
  }

  private parseDurationToMs(value: string, fallback: number): number {
    const match = value.trim().match(/^(\d+)([smhd])$/);
    if (!match) {
      return fallback;
    }

    const amount = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return amount * 1000;
      case 'm':
        return amount * 60 * 1000;
      case 'h':
        return amount * 60 * 60 * 1000;
      case 'd':
        return amount * 24 * 60 * 60 * 1000;
      default:
        return fallback;
    }
  }
}
