import { type AuthUser, DEFAULT_SEARCH_TITLE, type RegisterInput } from '@jobflow/shared';
import { Injectable } from '@nestjs/common';

import { conflict } from '../../common/app-error.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export type NewUser = Omit<RegisterInput, 'password'> & { passwordHash: string };

export type UserCredentials = AuthUser & { passwordHash: string | null };

const AUTH_USER_SELECT = { id: true, email: true, displayName: true, locale: true } as const;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createUserWithDefaults({ email, displayName, passwordHash }: NewUser): Promise<AuthUser> {
    try {
      return await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          displayName: displayName ?? null,
          settings: { create: {} },
          searches: { create: { title: DEFAULT_SEARCH_TITLE } },
        },
        select: AUTH_USER_SELECT,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict('Email is already registered');
      }
      throw error;
    }
  }

  findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { ...AUTH_USER_SELECT, passwordHash: true },
    });
  }
}
