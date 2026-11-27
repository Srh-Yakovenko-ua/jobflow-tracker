export const cvHints = {
  title: 'Як підсилити резюме під цю вакансію',
  idle: 'AI підкаже, які рядки резюме підсилити під цю вакансію, без вигаданого досвіду.',
  request: 'Підказати',
  waiting: 'Можеш закрити картку: підказки зʼявляться тут.',
  failed: {
    timeout: 'AI не відповів за 30 секунд.',
    other: 'Підказки не вийшли.',
  },
  impact: (points: number) => `до +${String(points)}`,
  evidence: (quote: string) => `у резюме: «${quote}»`,
  copy: (requirement: string) => `Скопіювати підказку про «${requirement}»`,
  hintsLabel: 'Підказки',
  empty: 'AI не знайшов рядків, які варто підсилити.',
  gapsTitle: 'Чого формулюванням не закрити',
  gap: (name: string) => `${name}: у резюме немає досвіду, не додавай того, чого не було`,
} as const;
