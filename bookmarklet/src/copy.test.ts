import { STAGE_LABELS, STAGES } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { duplicateMessageOf, retryMessageOf } from './copy.js';
import { DUPLICATE } from './test/api.js';

const NOW = new Date('2026-11-10T12:00:00.000Z');
const DAY_MS = 86_400_000;

function appliedDaysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString();
}

describe('duplicateMessageOf', () => {
  it.each([
    [0, 'Ти вже відгукувався сюди сьогодні, етап: відмова'],
    [1, 'Ти вже відгукувався сюди учора, етап: відмова'],
    [5, 'Ти вже відгукувався сюди 5 днів тому, етап: відмова'],
    [21, 'Ти вже відгукувався сюди 21 день тому, етап: відмова'],
    [23, 'Ти вже відгукувався сюди 23 дні тому, етап: відмова'],
  ])('words an application made %i days ago', (days, message) => {
    const duplicate = { ...DUPLICATE, appliedAt: appliedDaysAgo(days) };

    expect(duplicateMessageOf(duplicate, NOW)).toBe(message);
  });

  it('counts whole days only', () => {
    const duplicate = { ...DUPLICATE, appliedAt: '2026-11-08T12:00:00.001Z' };

    expect(duplicateMessageOf(duplicate, NOW)).toBe(
      'Ти вже відгукувався сюди учора, етап: відмова',
    );
  });

  it('treats an application dated ahead of now as made today', () => {
    const duplicate = { ...DUPLICATE, appliedAt: appliedDaysAgo(-3) };

    expect(duplicateMessageOf(duplicate, NOW)).toBe(
      'Ти вже відгукувався сюди сьогодні, етап: відмова',
    );
  });

  it('takes the dateless line when the application has no applied date', () => {
    const duplicate = { ...DUPLICATE, appliedAt: null, stage: 'offer' as const };

    expect(duplicateMessageOf(duplicate, NOW)).toBe('Ця вакансія вже є в JobFlow, етап: офер');
  });

  it.each(STAGES)('names the stage %s by its shared label', (stage) => {
    const message = duplicateMessageOf({ ...DUPLICATE, appliedAt: null, stage }, NOW);

    expect(message).toBe(`Ця вакансія вже є в JobFlow, етап: ${STAGE_LABELS[stage].labelUk}`);
  });
});

describe('retryMessageOf', () => {
  it.each([
    [30, 'Забагато запитів, спробуй через 1 хвилину'],
    [90, 'Забагато запитів, спробуй через 2 хвилини'],
    [300, 'Забагато запитів, спробуй через 5 хвилин'],
  ])('rounds %i seconds up to whole minutes', (seconds, message) => {
    expect(retryMessageOf(seconds)).toBe(message);
  });
});
