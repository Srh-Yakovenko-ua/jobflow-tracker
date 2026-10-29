import type { ScheduledEventKind } from '@jobflow/shared';

export const application = {
  score: {
    value: (score: number) => `Match Score ${String(score)}`,
    queued: 'Match Score у черзі',
    processing: 'AI рахує Match Score',
    failed: 'Match Score не пораховано',
    none: 'без CV',
    pending: '··',
    empty: '—',
  },
  salary: {
    unknown: 'вилка не вказана',
    from: (amount: string) => `від ${amount}`,
    to: (amount: string) => `до ${amount}`,
    range: (min: string, max: string) => `${min}–${max}`,
  },
  silence: (days: string) => `${days} тиші`,
  daysInStage: (days: string) => `${days} на етапі`,
  stageNorm: (days: number) => `· норма ${String(days)}`,
  stackMore: (count: number) => `+${String(count)}`,
  nextEvent: {
    today: 'сьогодні',
    tomorrow: 'завтра',
    relative: (day: string, time: string) => `${day}, ${time}`,
    phrase: (kind: string, when: string) => `${kind} ${when}`,
    kinds: {
      screening_call: 'дзвінок',
      tech_interview: "техінтерв'ю",
      final_interview: 'фінал',
      offer_call: 'дзвінок щодо оферу',
      other: 'зустріч',
    } satisfies Record<ScheduledEventKind, string>,
  },
} as const;
