export const userKeys = {
  all: ['user'] as const,
  me: () => [...userKeys.all, 'me'] as const,
  session: () => [...userKeys.all, 'session'] as const,
  cookieSession: () => [...userKeys.all, 'cookie-session'] as const,
};
