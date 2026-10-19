import {
  type AuthResponse,
  type LoginInput,
  loginInputSchema,
  type RegisterInput,
  registerInputSchema,
} from '@jobflow/shared';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body({ schema: registerInputSchema }) input: RegisterInput): Promise<AuthResponse> {
    return this.authService.register(input);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body({ schema: loginInputSchema }) input: LoginInput): Promise<AuthResponse> {
    return this.authService.login(input);
  }
}
