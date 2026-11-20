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
import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';

import { RateLimit } from '../../rate-limit/rate-limit.decorator.js';
import type { AccessUser } from './access-tokens.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { Public } from './public.decorator.js';
import {
  clearRefreshCookie,
  readRefreshToken,
  type RefreshClient,
  sendSession,
  type SessionReply,
} from './refresh-cookie.js';
import { SessionService } from './session.service.js';
import { SessionClient } from './session-client.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Post('register')
  @Public()
  @RateLimit('register')
  async register(
    @Body({ schema: registerInputSchema }) input: RegisterInput,
    @SessionClient() client: RefreshClient,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.signedIn(await this.authService.register(input), { client, res });
  }

  @Post('login')
  @HttpCode(200)
  @Public()
  @RateLimit('login')
  async login(
    @Body({ schema: loginInputSchema }) input: LoginInput,
    @SessionClient() client: RefreshClient,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.signedIn(await this.authService.login(input), { client, res });
  }

  @Post('refresh')
  @HttpCode(200)
  @Public()
  async refresh(
    @Body({ schema: refreshTokenBodySchema }) body: RefreshTokenBody,
    @SessionClient() client: RefreshClient,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionTokens> {
    const session = await this.sessions.refresh(readRefreshToken(client, body));
    return sendSession({ client, res, session });
  }

  @Post('logout')
  @HttpCode(204)
  @Public()
  async logout(
    @Body({ schema: refreshTokenBodySchema }) body: RefreshTokenBody,
    @SessionClient() client: RefreshClient,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.sessions.logout(readRefreshToken(client, body));
    clearRefreshCookie(res);
  }

  @Post('logout-all')
  @HttpCode(204)
  async logoutAll(
    @CurrentUser() user: AccessUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.sessions.logoutAll(user.id);
    clearRefreshCookie(res);
  }

  @Post('change-password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: AccessUser,
    @Body({ schema: changePasswordInputSchema }) input: ChangePasswordInput,
    @SessionClient() client: RefreshClient,
  ): Promise<void> {
    const refreshToken = readRefreshToken(client);
    const keepFamilyId = await this.sessions.familyOf({ userId: user.id, refreshToken });
    await this.authService.changePassword({ userId: user.id, input, keepFamilyId });
  }

  @Get('me')
  me(@CurrentUser() user: AccessUser): Promise<MeResponse> {
    return this.authService.me(user.id);
  }

  private async signedIn(
    user: AuthUser,
    http: Omit<SessionReply, 'session'>,
  ): Promise<AuthResponse> {
    const session = await this.sessions.start(user.id);
    return { user, ...sendSession({ ...http, session }) };
  }
}
