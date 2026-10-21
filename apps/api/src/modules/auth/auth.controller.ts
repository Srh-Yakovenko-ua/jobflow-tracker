import {
  type AuthResponse,
  type AuthUser,
  type ChangePasswordInput,
  changePasswordInputSchema,
  type LoginInput,
  loginInputSchema,
  type MeResponse,
  type RefreshTokenBody,
  refreshTokenBodySchema,
  type RegisterInput,
  registerInputSchema,
  type SessionTokens,
} from '@jobflow/shared';
import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';

import { AccessTokenGuard } from './access-token.guard.js';
import type { AccessUser } from './access-tokens.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import {
  clearRefreshCookie,
  type HttpExchange,
  readRefreshToken,
  sendSession,
} from './refresh-cookie.js';
import { SessionService } from './session.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Post('register')
  async register(
    @Body({ schema: registerInputSchema }) input: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.signedIn(await this.authService.register(input), { req, res });
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body({ schema: loginInputSchema }) input: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.signedIn(await this.authService.login(input), { req, res });
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body({ schema: refreshTokenBodySchema }) body: RefreshTokenBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionTokens> {
    const session = await this.sessions.refresh(readRefreshToken(req, body));
    return sendSession({ req, res, session });
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Body({ schema: refreshTokenBodySchema }) body: RefreshTokenBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.sessions.logout(readRefreshToken(req, body));
    clearRefreshCookie(res);
  }

  @Post('logout-all')
  @HttpCode(204)
  @UseGuards(AccessTokenGuard)
  async logoutAll(
    @CurrentUser() user: AccessUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.sessions.logoutAll(user.id);
    clearRefreshCookie(res);
  }

  @Post('change-password')
  @HttpCode(204)
  @UseGuards(AccessTokenGuard)
  async changePassword(
    @CurrentUser() user: AccessUser,
    @Body({ schema: changePasswordInputSchema }) input: ChangePasswordInput,
    @Req() req: Request,
  ): Promise<void> {
    const refreshToken = readRefreshToken(req);
    const keepFamilyId = await this.sessions.familyOf({ userId: user.id, refreshToken });
    await this.authService.changePassword({ userId: user.id, input, keepFamilyId });
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  me(@CurrentUser() user: AccessUser): Promise<MeResponse> {
    return this.authService.me(user.id);
  }

  private async signedIn(user: AuthUser, http: HttpExchange): Promise<AuthResponse> {
    const session = await this.sessions.start(user.id);
    return { user, ...sendSession({ ...http, session }) };
  }
}
