import type {
  AuthResponse,
  AuthUser,
  ChangePasswordInput,
  JwksResponse,
  LoginInput,
  MeResponse,
  RefreshTokenBody,
  RegisterInput,
  SessionTokens,
} from '@jobflow/shared';

const USER = {
  id: '0199f0b0-3c4d-7e5f-8a6b-7c8d9e0f1a2b',
  email: 'iryna.koval@example.com',
  displayName: 'Ірина',
  locale: 'uk',
} satisfies AuthUser;

const PASSWORD = 'kavun-pass-2026';

const SESSION = {
  accessToken: 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIwMTk5ZjBiMCJ9.c2lnbmF0dXJl',
} satisfies SessionTokens;

export const AUTH_EXAMPLES = {
  register: { email: USER.email, password: PASSWORD, displayName: 'Ірина' } satisfies RegisterInput,
  login: { email: USER.email, password: PASSWORD } satisfies LoginInput,
  changePassword: {
    currentPassword: PASSWORD,
    newPassword: 'kavun-pass-2027',
  } satisfies ChangePasswordInput,
  session: SESSION,
  authResponse: { ...SESSION, user: USER } satisfies AuthResponse,
  refreshBody: {
    refreshToken: 'q8Zr3VbX0nLw5Tf2Ky7Hc1Md9Pg4Rs6Ua_Ej-WoNxIb',
  } satisfies RefreshTokenBody,
  me: {
    user: USER,
    settings: {
      silenceDays: 10,
      autoGhostDays: 45,
      askRejectionReason: false,
      monthlySummaryEnabled: false,
      theme: 'dark',
      timezone: 'Europe/Kyiv',
      quietHoursStart: '23:00',
      quietHoursEnd: '07:30',
      notifyInApp: true,
      notifyPush: true,
      notifyEmail: false,
      analyticsOptOut: true,
      activeResumeVersionId: '0199f0b3-2b3c-7d4e-9f50-6b7c8d9e0f1a',
    },
  } satisfies MeResponse,
  jwks: {
    keys: [
      {
        kty: 'RSA',
        alg: 'RS256',
        use: 'sig',
        kid: 'Xk2Pq7Rt9Vw3Yz5Ab8Cd1Ef4Gh6Ij0Kl-Mn_OpQrStU',
        n: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuhDR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5hajrn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
        e: 'AQAB',
      },
    ],
  } satisfies JwksResponse,
};
