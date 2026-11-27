import type { Theme } from '@jobflow/shared';

import { add } from './add';
import { analytics } from './analytics';
import { application } from './application';
import { applicationPage } from './application-page';
import { applicationsTable } from './applications-table';
import { auth } from './auth';
import { board } from './board';
import { bookmarklet } from './bookmarklet';
import { calendar } from './calendar';
import { calendarPage } from './calendar-page';
import { contact } from './contact';
import { cvHints } from './cv-hints';
import { dataImport } from './data-import';
import { followup } from './followup';
import { ghosted } from './ghosted';
import { interviewPrep } from './interview-prep';
import { notifications } from './notifications';
import { offerCompare } from './offer-compare';
import { push } from './push';
import { reminders } from './reminders';
import { resumes } from './resumes';
import { rhythm } from './rhythm';
import { searches } from './searches';
import { settings } from './settings';
import { shareCard } from './share-card';
import { shell } from './shell';
import { states } from './states';
import { summary } from './summary';
import { timeline } from './timeline';
import { unsubscribe } from './unsubscribe';

export const uk = {
  locale: 'uk-UA',
  app: {
    brand: 'JobFlow',
    title: 'JobFlow · трекер пошуку роботи',
    notifications: 'Спливаючі повідомлення',
    close: 'Закрити',
  },
  ui: {
    clear: 'Скинути',
    clearAll: 'Скинути все',
    remove: 'Прибрати',
    addOption: (query: string) => `+ додати «${query}»`,
    noMatches: 'Немає збігів',
    loading: 'Завантаження…',
    decrease: 'Зменшити',
    increase: 'Збільшити',
    navigate: 'навігація',
    select: 'обрати',
    ofTotal: 'із',
    keys: { navigate: '↑↓', select: '↵', escape: 'Esc', ctrl: 'Ctrl', meta: '⌘' },
    theme: 'Тема',
    showPassword: 'Показати пароль',
    copied: 'Скопійовано',
    copyFailed: 'Не вдалося скопіювати',
    showTable: 'Показати таблицю',
    hideTable: 'Сховати таблицю',
    editor: {
      save: 'Зберегти',
      cancel: 'Скасувати',
      invalid: {
        title: 'Не вдалося зберегти',
        description: 'Перевір поля й спробуй ще раз.',
      },
    },
  },
  theme: { light: 'Світла', dark: 'Темна', system: 'Системна' } satisfies Record<Theme, string>,
  calendar,
  application,
  applicationPage,
  followup,
  cvHints,
  interviewPrep,
  contact,
  timeline,
  states,
  shell,
  notifications,
  push,
  reminders,
  errors: {
    saveFailed: {
      title: 'Не вдалося зберегти',
      description: 'Це збій на нашому боці, збережені дані на місці. Спробуй ще раз.',
    },
  },
  auth,
  add,
  board,
  rhythm,
  ghosted,
  bookmarklet,
  applicationsTable,
  calendarPage,
  resumes,
  settings,
  dataImport,
  analytics,
  searches,
  offerCompare,
  shareCard,
  summary,
  unsubscribe,
} as const;
