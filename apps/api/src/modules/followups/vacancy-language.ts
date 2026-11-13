import type { FollowupLanguage } from '@jobflow/shared';

const CYRILLIC_LETTER = /\p{Script=Cyrillic}/gu;

const LATIN_LETTER = /\p{Script=Latin}/gu;

const lettersIn = (text: string, letter: RegExp) => text.match(letter)?.length ?? 0;

export const vacancyLanguageOf = (text: string): FollowupLanguage =>
  lettersIn(text, CYRILLIC_LETTER) > lettersIn(text, LATIN_LETTER) ? 'uk' : 'en';
