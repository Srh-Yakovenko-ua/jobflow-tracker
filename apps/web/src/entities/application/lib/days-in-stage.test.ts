import { describe, expect, it } from 'vitest';

import { formatDaysInStage } from './days-in-stage';

describe('formatDaysInStage', () => {
  it.each([
    { input: { daysInStage: 13, stageNormDays: 17 }, text: '13 днів на етапі · зазвичай 17 дн' },
    { input: { daysInStage: 1, stageNormDays: 9 }, text: '1 день на етапі · зазвичай 9 дн' },
    { input: { daysInStage: 3, stageNormDays: 4 }, text: '3 дні на етапі · зазвичай 4 дн' },
    { input: { daysInStage: 0, stageNormDays: 5 }, text: '0 днів на етапі · зазвичай 5 дн' },
  ])('days in stage against the user norm read as "$text"', ({ input, text }) => {
    expect(formatDaysInStage(input)).toBe(text);
  });
});
