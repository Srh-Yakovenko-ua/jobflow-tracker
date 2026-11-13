import { RESUME_VERSION_LIMITS, type ResumeMime, type ResumeProfileStatus } from '@jobflow/shared';

import { applicationPage } from './application-page';
import { states } from './states';

const { status } = states.async;

const FILE_REFUSED = states.errors.fileTooBig.eyebrow;

const TITLE_MAX = String(RESUME_VERSION_LIMITS.titleMaxLength);

const percent = (value: number) => `${String(value)}%`;

export const resumes = {
  title: 'Версії резюме',
  lead: "Кожен відгук прив'язаний до версії. Саме тому аналітика вміє сказати, яке резюме працює, і саме тому варто прив'язувати чесно.",
  uploadAction: 'Завантажити версію',
  columns: {
    version: 'версія',
    applications: 'відгуків',
    screening: 'у скринінг',
    conversion: 'конв.',
    actions: 'дії',
  },
  active: 'активна',
  lowData: 'мало даних',
  needMore: (missing: number) => `потрібно ще ${String(missing)}`,
  percent,
  upload: {
    eyebrow: 'Завантаження версії',
    title: 'Перетягни PDF або DOCX сюди',
    hint: (limit: string) =>
      `До ${limit} МБ. Назву версії можна дати свою: «для продуктових», «для аутсорсу». Нові відгуки автоматично прив'язуються до активної версії.`,
    pick: 'Обрати файл',
    submit: 'Завантажити',
    progressLabel: 'Завантаження файлу',
    percent,
  },
  titleField: {
    label: 'Назва версії',
    error: `Назва потрібна, до ${TITLE_MAX} символів`,
  },
  actionsLabel: (version: string) => `Дії з версією ${version}`,
  previewLabel: (format: string, version: string) => `Відкрити ${format}: ${version}`,
  rename: { title: 'Перейменувати версію', save: 'Зберегти', cancel: 'Скасувати' },
  empty: {
    content: {
      eyebrow: 'Резюме · 0 версій',
      title: 'Завантаж перше резюме',
      hint: 'Без нього не буде Match Score і порівняння версій. Одного файлу достатньо, щоб почати.',
    },
    drop: 'перетягни PDF або DOCX',
  },
  archive: (count: number) => `архів · ${String(count)}`,
  menu: {
    activate: 'Зробити активною',
    rename: 'Перейменувати',
    archive: 'В архів',
    restore: 'Повернути з архіву',
  },
  aiProfile: {
    queued: status.queued,
    processing: status.processing,
    done: 'AI-профіль готовий',
    failed: 'AI-профіль не вдався',
    needs_text: 'потрібен текстовий PDF',
  } satisfies Record<ResumeProfileStatus, string>,
  errors: {
    unsupportedType: {
      eyebrow: FILE_REFUSED,
      title: 'Такий файл не підійде',
      body: 'Підходять лише PDF або DOCX. Нічого не втрачено.',
    },
    unreadable: {
      eyebrow: FILE_REFUSED,
      title: 'Файл не вдалося прочитати',
      body: 'Схоже, він пошкоджений. Збережи його ще раз як PDF або DOCX і спробуй знову.',
    },
    previewFailed: applicationPage.schedule.downloadFailed,
  },
  formats: {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  } satisfies Record<ResumeMime, string>,
  units: { kilobytes: 'КБ', megabytes: 'МБ' },
} as const;
