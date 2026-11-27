import { describe, expect, it } from 'vitest';

import {
  DESIGN_MATCH,
  DESIGN_VERSION,
  MATCH_JOB_ID,
  matchJob,
  NEXT_VERSION,
  NO_MATCH,
} from '@/test/match-fixtures';

import { type MatchViewInput, matchViewOf } from './match-view';

const LINKED: MatchViewInput = {
  resumeVersionId: DESIGN_VERSION.id,
  response: NO_MATCH,
  relinkedTo: null,
  versionProfileStatus: 'done',
  isDraft: false,
  vacancy: { rawText: null, stack: ['React'] },
};

const NO_VACANCY = { rawText: null, stack: [] };

const RELINKED: MatchViewInput = {
  ...LINKED,
  resumeVersionId: NEXT_VERSION.id,
  relinkedTo: NEXT_VERSION.id,
};

describe('matchViewOf', () => {
  it.for<{ name: string; input: MatchViewInput; kind: string }>([
    {
      name: 'no linked CV reads as no CV, whatever the response holds',
      input: { ...LINKED, resumeVersionId: null, response: DESIGN_MATCH },
      kind: 'no_cv',
    },
    {
      name: 'a breakdown for the linked version is scored',
      input: { ...LINKED, response: DESIGN_MATCH },
      kind: 'scored',
    },
    {
      name: 'a failed job after an older breakdown keeps the breakdown',
      input: {
        ...LINKED,
        response: { ...DESIGN_MATCH, job: { id: MATCH_JOB_ID, status: 'failed' } },
      },
      kind: 'scored',
    },
    {
      name: 'a failed job with no breakdown is failed',
      input: { ...LINKED, response: matchJob('failed') },
      kind: 'failed',
    },
    {
      name: 'a done job with no breakdown is unscored',
      input: { ...LINKED, response: matchJob('done') },
      kind: 'unscored',
    },
    { name: 'no job and no breakdown is unscored', input: LINKED, kind: 'unscored' },
    {
      name: 'a breakdown for another version is not shown for the linked one',
      input: { ...LINKED, resumeVersionId: NEXT_VERSION.id, response: DESIGN_MATCH },
      kind: 'unscored',
    },
  ])('$name', ({ input, kind }) => {
    expect(matchViewOf(input).kind).toBe(kind);
  });

  it.for(['queued', 'processing'] as const)(
    'a %s job is pending on that job, even beside an older breakdown',
    (status) => {
      const job = { id: MATCH_JOB_ID, status };

      expect(matchViewOf({ ...LINKED, response: { ...DESIGN_MATCH, job } })).toEqual({
        kind: 'pending',
        job,
      });
    },
  );

  it.for<{ name: string; input: MatchViewInput }>([
    { name: 'the relink gap before the job exists', input: RELINKED },
    {
      name: 'the relink gap while the old breakdown is still cached',
      input: { ...RELINKED, response: DESIGN_MATCH },
    },
    {
      name: 'a version whose AI profile is still read',
      input: { ...LINKED, versionProfileStatus: 'processing' },
    },
  ])('$name waits on the placeholder', ({ input }) => {
    expect(matchViewOf(input)).toEqual({ kind: 'pending', job: null });
  });

  it.for(['failed', 'needs_text'] as const)(
    'a relink to a version whose AI profile is %s reads unscored, since no job will come',
    (versionProfileStatus) => {
      expect(matchViewOf({ ...RELINKED, versionProfileStatus }).kind).toBe('unscored');
    },
  );

  it('a relink on a draft to a read CV reads unscored, since a draft gets no match job', () => {
    expect(matchViewOf({ ...RELINKED, isDraft: true }).kind).toBe('unscored');
  });

  it.for<{ name: string; input: MatchViewInput }>([
    { name: 'a card with no vacancy text and no stack', input: { ...LINKED, vacancy: NO_VACANCY } },
    {
      name: 'a relink on a card with no vacancy text, since no job will come',
      input: { ...RELINKED, vacancy: NO_VACANCY },
    },
    {
      name: 'a done job on a card whose text was blank',
      input: { ...LINKED, vacancy: { rawText: '  ', stack: [] }, response: matchJob('done') },
    },
  ])('$name asks for the vacancy text', ({ input }) => {
    expect(matchViewOf(input).kind).toBe('no_vacancy');
  });

  it('a card with no vacancy text keeps a breakdown already counted for the linked version', () => {
    expect(matchViewOf({ ...LINKED, vacancy: NO_VACANCY, response: DESIGN_MATCH }).kind).toBe(
      'scored',
    );
  });

  it('a card with vacancy text but no stack is not asked for the text', () => {
    const vacancy = { rawText: 'Senior React, remote', stack: [] };

    expect(matchViewOf({ ...LINKED, vacancy }).kind).toBe('unscored');
  });

  it('the relink marker of another version does not hold the linked one pending', () => {
    expect(matchViewOf({ ...LINKED, relinkedTo: NEXT_VERSION.id }).kind).toBe('unscored');
  });
});
