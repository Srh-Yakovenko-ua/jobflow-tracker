import type { ResumeVersion } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';

import { buildResumeVersions } from '@/test/resume-fixtures';

import { splitVersions } from './split-versions';

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
    expect(splitVersions({ versions: [], activeId: null })).toEqual({
      visible: [],
      archive: [],
      activeId: null,
    });
  });

  it('three versions all stay in the table with the active one first and the rest newest first', () => {
    const versions = buildResumeVersions(3);

    const split = splitVersions({ versions, activeId: idOfNumber({ versions, number: 1 }) });

    expect(numbersOf(split.visible)).toEqual([1, 3, 2]);
    expect(split.archive).toEqual([]);
    expect(split.activeId).toBe(idOfNumber({ versions, number: 1 }));
  });

  it('twenty versions show the active one and the four newest, and fold the other fifteen into the archive', () => {
    const versions = buildResumeVersions(20);

    const split = splitVersions({ versions, activeId: idOfNumber({ versions, number: 3 }) });

    expect(numbersOf(split.visible)).toEqual([3, 20, 19, 18, 17]);
    expect(numbersOf(split.archive)).toEqual([16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 2, 1]);
  });

  it('archived versions go to the archive even when they are among the newest', () => {
    const versions = archivedAt({ versions: buildResumeVersions(7), numbers: [7, 5] });

    const split = splitVersions({ versions, activeId: null });

    expect(numbersOf(split.visible)).toEqual([6, 4, 3, 2, 1]);
    expect(numbersOf(split.archive)).toEqual([7, 5]);
  });

  it('an active id pointing at an archived version marks nothing active and keeps it in the archive', () => {
    const versions = archivedAt({ versions: buildResumeVersions(3), numbers: [2] });

    const split = splitVersions({ versions, activeId: idOfNumber({ versions, number: 2 }) });

    expect(numbersOf(split.visible)).toEqual([3, 1]);
    expect(numbersOf(split.archive)).toEqual([2]);
    expect(split.activeId).toBeNull();
  });
});
