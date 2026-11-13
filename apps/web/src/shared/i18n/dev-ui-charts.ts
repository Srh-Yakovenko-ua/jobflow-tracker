export const devUiCharts = {
  charts: {
    index: '14',
    title: 'Чарти · Chart.js 4',
    rejections: {
      header: { eyebrow: 'Причини відмов · bar' },
      series: 'відмов',
      label: (summary: string) => `Причини відмов: ${summary}`,
    },
    funnel: {
      header: { eyebrow: 'Воронка · sankey' },
      label: (summary: string) => `Воронка відгуків: ${summary}`,
    },
    states: {
      loading: {
        eyebrow: 'стан · завантаження',
        header: { eyebrow: 'Відгуки та скринінги', title: 'Темп пошуку' },
      },
      insufficient: {
        eyebrow: 'стан · мало даних',
        header: { eyebrow: 'Джерела', title: 'Конверсія джерел' },
        message: 'Перші висновки з 10 відгуків. Зараз 4.',
      },
      failed: {
        eyebrow: 'стан · помилка',
        header: { eyebrow: 'Виходи', title: 'Чим закінчуються відгуки' },
      },
    },
    note: 'Серії беруть драбину світлості 38→86, тому в ч/б лишаються різними. Ghost завжди сірий stone, офер sage, відмова clay.',
  },
} as const;
