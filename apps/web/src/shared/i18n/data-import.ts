import {
  APPLICATION_FORMS_UK,
  countedUk,
  type ImportField,
  type PluralForms,
} from '@jobflow/shared';

const ROW_FORMS = { one: 'рядок', few: 'рядки', other: 'рядків' } as const satisfies PluralForms;

const ROW_OF_FORMS = {
  one: 'рядка',
  few: 'рядків',
  other: 'рядків',
} as const satisfies PluralForms;

const rowsOf = (count: number) => countedUk(count, ROW_FORMS);

type PreviewSummary = Readonly<{ shown: number; total: number; invalid: number }>;

export const dataImport = {
  title: 'Імпорт з таблиці',
  lead: 'Перенеси відгуки з Google Sheets чи Excel. Збережи таблицю як CSV, зістав стовпці й перевір перші рядки.',
  step: (current: number, total: number) => `Крок ${String(current)} з ${String(total)}`,
  upload: {
    title: 'Файл CSV',
    hint: (rows: number, size: string) =>
      `До ${rowsOf(rows)} і ${size} МБ. Перший рядок містить назви стовпців.`,
    pick: 'Обрати файл',
    reading: 'Читаю файл…',
    template: 'Завантажити шаблон CSV',
    templateHint: 'У шаблоні є всі стовпці, які розуміє імпорт.',
    refusals: {
      type: 'Це не CSV. Збережи таблицю як CSV і обери файл ще раз.',
      size: (size: string) => `Файл більший за ${size} МБ. Розбий таблицю на кілька файлів.`,
      empty: 'У файлі немає рядків під назвами стовпців.',
      rows: (max: number) => `У файлі понад ${rowsOf(max)}. Розбий таблицю на кілька файлів.`,
      unreadable: 'Файл не вдалося прочитати. Обери його ще раз.',
    },
  },
  mapping: {
    title: 'Зістав стовпці',
    file: (name: string, rows: number) => `${name} · ${rowsOf(rows)}`,
    required: "Обов'язкове поле",
    optional: 'Можна пропустити',
    missing: 'Обери стовпець для цього поля',
    placeholder: 'Не імпортувати',
    column: (index: number) => `Стовпець ${String(index)}`,
    back: 'Інший файл',
    next: 'Перевірити рядки',
  },
  preview: {
    title: 'Перевір перші рядки',
    summary: ({ shown, total, invalid }: PreviewSummary) =>
      `Показано ${String(shown)} з ${countedUk(total, ROW_OF_FORMS)}, з помилками ${String(invalid)}. Рядки з помилками не імпортуються.`,
    caption: 'Перші рядки файлу',
    line: 'Рядок',
    check: 'Перевірка',
    ready: 'Готовий',
    back: 'Назад до стовпців',
    submit: ({ valid, total }: Readonly<{ valid: number; total: number }>) =>
      valid === total
        ? `Імпортувати ${rowsOf(total)}`
        : `Імпортувати ${String(valid)} з ${countedUk(total, ROW_OF_FORMS)}`,
  },
  futureDate: 'Дата не може бути в майбутньому',
  issues: {
    company: 'Компанія: вкажи назву одним коротким рядком',
    position: 'Посада: вкажи її одним коротким рядком',
    source: 'Джерело не читається',
    appliedAt: 'Дата відгуку: формат 2026-10-01 або 01.10.2026',
    stage: 'Етап не з тих, що знає JobFlow',
    salary: 'Зарплата: формат 1500-2500 USD',
    url: 'Посилання має починатися з http:// або https://',
    stageHistory: 'Історія етапів не складається в дозволені переходи',
  } satisfies Record<ImportField, string>,
  invalidRow: 'Рядок не пройшов перевірку',
  result: {
    title: (imported: number) => `Імпортовано ${countedUk(imported, APPLICATION_FORMS_UK)}`,
    errorsTitle: (count: number) => `Не імпортовано: ${rowsOf(count)}`,
    clean: 'Усі рядки на дошці.',
    line: (line: number) => `Рядок ${String(line)}`,
    board: 'Відкрити дошку',
    again: 'Імпортувати ще файл',
  },
} as const;
