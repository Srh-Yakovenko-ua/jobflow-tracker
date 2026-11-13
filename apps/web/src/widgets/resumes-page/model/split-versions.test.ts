import type { ResumeVersion } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { DESIGN_RESUME_AB } from '@/test/resume-ab-fixtures';
import { buildResumeVersions, resumeVersionIdOf } from '@/test/resume-fixtures';

import { conversionsById, splitVersions } from './split-versions';

const NO_CONVERSIONS = conversionsById([]);

const LOW_DATA = { status: 'insufficient_data', have: 2, need: 3, message: 'x' } as const;

function ratedAt(rows: readonly { number: number; value: number }[]) {
  return conversionsById(
    rows.map(({ number, value }) => ({
      resumeVersionId: resumeVersionIdOf(number),
      number,
      title: 'x',
      applications: 10,
      screenings: 5,
      conversion: { status: 'ok', value, low: 0, high: 1, successes: 5, trials: 10 },
    })),
  );
}

function numbersOf(versions: readonly ResumeVersion[]): number[] {
  return versions.map((version) => version.number);
}

function idOfNumber({ versions, number }: { versions: readonly ResumeVersion[]; number: number }) {
  const found = versions.find((version) => version.number === number);
  if (found === undefined) throw new Error(`no version ${String(number)}`);
  return found.id;
}

function archivedAt({ versions, numbers }: { versions: ResumeVersion[]; numbers: number[] }) {
  return versions.map((version) =>
    numbers.includes(version.number) ? { ...version, isArchived: true } : version,
  );
}

describe('splitVersions', () => {
  it('no versions leave both the table and the archive empty', () => {
    expect(splitVersions({ versions: [], activeId: null, conversions: NO_CONVERSIONS })).toEqual({
      visible: [],
      archive: [],
      activeId: null,
    });
  });

  it('three versions all stay in the table with the active one first and the rest newest first', () => {
    const versions = buildResumeVersions(3);

    const split = splitVersions({
      versions,
      activeId: idOfNumber({ versions, number: 1 }),
      conversions: NO_CONVERSIONS,
    });

    expect(numbersOf(split.visible)).toEqual([1, 3, 2]);
    expect(split.archive).toEqual([]);
    expect(split.activeId).toBe(idOfNumber({ versions, number: 1 }));
  });

  it('twenty versions show the active one and the four newest, and fold the other fifteen into the archive', () => {
    const versions = buildResumeVersions(20);

    const split = splitVersions({
      versions,
      activeId: idOfNumber({ versions, number: 3 }),
      conversions: NO_CONVERSIONS,
    });

    expect(numbersOf(split.visible)).toEqual([3, 20, 19, 18, 17]);
    expect(numbersOf(split.archive)).toEqual([16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 2, 1]);
  });

  it('archived versions go to the archive even when they are among the newest', () => {
    const versions = archivedAt({ versions: buildResumeVersions(7), numbers: [7, 5] });

    const split = splitVersions({ versions, activeId: null, conversions: NO_CONVERSIONS });

    expect(numbersOf(split.visible)).toEqual([6, 4, 3, 2, 1]);
    expect(numbersOf(split.archive)).toEqual([7, 5]);
  });

  it('an active id pointing at an archived version marks nothing active and keeps it in the archive', () => {
    const versions = archivedAt({ versions: buildResumeVersions(3), numbers: [2] });

    const split = splitVersions({
      versions,
      activeId: idOfNumber({ versions, number: 2 }),
      conversions: NO_CONVERSIONS,
    });

    expect(numbersOf(split.visible)).toEqual([3, 1]);
    expect(numbersOf(split.archive)).toEqual([2]);
    expect(split.activeId).toBeNull();
  });

  it('the design numbers put CV v1 at 24% ahead of CV v3 with too little data, the active CV v2 first', () => {
    const versions = buildResumeVersions(3);

    const split = splitVersions({
      versions,
      activeId: idOfNumber({ versions, number: 2 }),
      conversions: conversionsById(DESIGN_RESUME_AB.versions),
    });

    expect(numbersOf(split.visible)).toEqual([2, 1, 3]);
  });

  it('rated versions go by conversion, equal ones newest first, the unrated after them newest first', () => {
    const versions = buildResumeVersions(5);
    const conversions = ratedAt([
      { number: 1, value: 0.2 },
      { number: 2, value: 0.5 },
      { number: 4, value: 0.2 },
    ]);
    const split = splitVersions({
      versions,
      activeId: null,
      conversions: new Map([...conversions, [resumeVersionIdOf(3), LOW_DATA]]),
    });

    expect(numbersOf(split.visible)).toEqual([2, 4, 1, 5, 3]);
  });

  it('a fresh version with no conversion stays in the table while an older rated one goes to the archive', () => {
    const versions = buildResumeVersions(6);

    const split = splitVersions({
      versions,
      activeId: null,
      conversions: ratedAt([{ number: 1, value: 0.9 }]),
    });

    expect(numbersOf(split.visible)).toEqual([6, 5, 4, 3, 2]);
    expect(numbersOf(split.archive)).toEqual([1]);
  });
});
