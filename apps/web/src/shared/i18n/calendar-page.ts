export const calendarPage = {
  title: 'Календар',
  views: { month: 'Місяць', week: 'Тиждень', list: 'Список' },
  viewsLabel: 'Вигляд календаря',
  previous: 'Попередній період',
  next: 'Наступний період',
  allDay: 'весь день',
  timed: 'за годинами',
  more: (count: number) => `ще ${String(count)}`,
  emptyWeek: {
    current: 'Цього тижня співбесід немає',
    other: 'На вибраному тижні співбесід немає',
  },
  toReminders: 'До нагадувань',
  toSilentCards: 'Показати тихі картки',
  legendLabel: 'Позначення подій',
  legend: {
    interview: 'співбесіда',
    call: 'дзвінок',
    followup: 'фоллоу-ап',
    offer: 'офер',
    archive: 'архів',
  },
} as const;
