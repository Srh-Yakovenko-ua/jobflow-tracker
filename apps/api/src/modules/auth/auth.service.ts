import type { AuthResponse, AuthUser, LoginInput, RegisterInput } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { unauthorized } from '../../common/app-error.js';
import { AuthRepository } from './auth.repository.js';
import { PasswordHasher } from './password-hasher.js';

function toAuthUser({ id, email, displayName, locale }: AuthUser): AuthUser {
  return { id, email, displayName, locale };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async register({ password, ...profile }: RegisterInput): Promise<AuthResponse> {
    const passwordHash = await this.hasher.hash(password);
    const user = await this.repository.createUserWithDefaults({ ...profile, passwordHash });
    return { user };
  }

  async login({ email, password }: LoginInput): Promise<AuthResponse> {
    const credentials = await this.repository.findCredentialsByEmail(email);
    const digest = credentials?.passwordHash ?? this.hasher.dummyHash;
    const matches = await this.hasher.verify(digest, password);
    if (credentials?.passwordHash == null || !matches) {
      throw unauthorized('Invalid email or password');
    }
    return { user: toAuthUser(credentials) };
  }
}
