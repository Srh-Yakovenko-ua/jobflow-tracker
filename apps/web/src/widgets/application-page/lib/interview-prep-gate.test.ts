import { describe, expect, it } from 'vitest';

import { ACME_APPLICATION } from '@/test/application-fixtures';
import { DESIGN_MATCH, NO_MATCH } from '@/test/match-fixtures';

import { type InterviewPrepGateInput, interviewPrepGateOf } from './interview-prep-gate';

const SETTLED = { pending: false, failed: false, retrying: false } as const;

const PENDING = { pending: true, failed: false, retrying: false } as const;

const FAILED = { pending: false, failed: true, retrying: false } as const;

const RETRYING = { pending: false, failed: true, retrying: true } as const;

const PLANNED: InterviewPrepGateInput['schedule'] = { load: SETTLED, upcoming: true };

const BARE_VACANCY = { ...ACME_APPLICATION, stack: [], aiParsed: null };

function gateOf(input: Partial<InterviewPrepGateInput>) {
  return interviewPrepGateOf({
    application: ACME_APPLICATION,
    schedule: PLANNED,
    match: { load: SETTLED, response: NO_MATCH },
    ...input,
  });
}

describe('interviewPrepGateOf', () => {
  it('waits for the schedule before it says whether an interview is planned', () => {
    expect(
      gateOf({
        application: { ...ACME_APPLICATION, currentStage: 'screening' },
        schedule: { load: PENDING, upcoming: false },
      }),
    ).toEqual({ shown: true, settling: true, requestable: false });
  });

  it('a schedule that fails to load still offers the request, and the API answers', () => {
    expect(
      gateOf({
        application: { ...ACME_APPLICATION, currentStage: 'screening' },
        schedule: { load: FAILED, upcoming: false },
      }),
    ).toEqual({ shown: true, settling: false, requestable: true });
  });

  it.each([
    ['schedule', { schedule: { load: RETRYING, upcoming: false } }],
    ['Match Score', { application: BARE_VACANCY, match: { load: RETRYING, response: undefined } }],
  ])('a failed %s asked again still counts as settling', (_section, input) => {
    expect(gateOf(input).settling).toBe(true);
  });

  it('a planned interview for a vacancy with no stack, requirements or Match Score gaps offers no request', () => {
    expect(gateOf({ application: BARE_VACANCY })).toEqual({
      shown: true,
      settling: false,
      requestable: false,
    });
  });

  it('Match Score gaps alone are enough to prepare from', () => {
    expect(
      gateOf({ application: BARE_VACANCY, match: { load: SETTLED, response: DESIGN_MATCH } })
        .requestable,
    ).toBe(true);
  });

  it('a bare vacancy waits for the Match Score before it offers or refuses the request', () => {
    expect(
      gateOf({ application: BARE_VACANCY, match: { load: PENDING, response: undefined } }),
    ).toEqual({ shown: true, settling: true, requestable: false });
  });

  it('a vacancy with a stack does not wait for the Match Score', () => {
    expect(gateOf({ match: { load: PENDING, response: undefined } })).toEqual({
      shown: true,
      settling: false,
      requestable: true,
    });
  });

  it('a Match Score that fails to load still offers the request, and the API answers', () => {
    expect(
      gateOf({ application: BARE_VACANCY, match: { load: FAILED, response: undefined } })
        .requestable,
    ).toBe(true);
  });

  it('at screening with no interview ahead the section shows without the request', () => {
    expect(
      gateOf({
        application: { ...ACME_APPLICATION, currentStage: 'screening' },
        schedule: { load: SETTLED, upcoming: false },
      }),
    ).toEqual({ shown: true, settling: false, requestable: false });
  });

  it('at applied with no interview ahead the section stays hidden', () => {
    expect(
      gateOf({
        application: { ...ACME_APPLICATION, currentStage: 'applied' },
        schedule: { load: SETTLED, upcoming: false },
      }).shown,
    ).toBe(false);
  });
});
