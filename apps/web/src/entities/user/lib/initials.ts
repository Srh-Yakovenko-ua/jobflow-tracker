import type { AuthUser } from '@jobflow/shared';

function firstLetterOf(word: string): string {
  return Array.from(word)[0] ?? '';
}

export function initialsOf(user: Pick<AuthUser, 'displayName' | 'email'>): string {
  const words = (user.displayName ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = words.length > 0 ? words.map(firstLetterOf).join('') : firstLetterOf(user.email);
  return letters.toLocaleUpperCase('uk');
}
