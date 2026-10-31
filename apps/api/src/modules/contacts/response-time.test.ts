import { describe, expect, it } from 'vitest';

import { APPLIED_AT_NOW, moved, responseHistory as history } from '../../test/response-history.js';
import { averageResponseHours } from './response-time.js';

const TO_SCREENING = moved({ from: 'applied', to: 'screening', hours: 10 });

const TO_TECH_INTERVIEW = moved({ from: 'screening', to: 'tech_interview', hours: 28 });

describe('averageResponseHours', () => {
  it('averages a reply 10 h after applying and the next one 18 h after screening to 14', () => {
    expect(averageResponseHours([history([APPLIED_AT_NOW, TO_SCREENING, TO_TECH_INTERVIEW])])).toBe(
      14,
    );
  });

  it('reads the effective events in occurredAt order, whatever order they arrive in', () => {
    expect(averageResponseHours([history([TO_TECH_INTERVIEW, TO_SCREENING, APPLIED_AT_NOW])])).toBe(
      14,
    );
  });

  it('hides the average behind a single reply', () => {
    expect(averageResponseHours([history([APPLIED_AT_NOW, TO_SCREENING])])).toBeNull();
  });

  it('measures the next reply from a followup_sent written after the last stage event', () => {
    const screening = moved({ from: 'applied', to: 'screening', hours: 30 });
    const techInterview = moved({ from: 'screening', to: 'tech_interview', hours: 40 });

    expect(averageResponseHours([history([APPLIED_AT_NOW, screening, techInterview], [20])])).toBe(
      10,
    );
  });

  it('measures the next reply from an interview_done row', () => {
    const techInterview = moved({ from: 'screening', to: 'tech_interview', hours: 36 });

    expect(
      averageResponseHours([history([APPLIED_AT_NOW, TO_SCREENING, techInterview], [30])]),
    ).toBe(8);
  });

  it('measures a reply that revives a ghosted application from the event before ghosted', () => {
    const ghosted = moved({
      from: 'screening',
      to: 'ghosted',
      hours: 100,
      reasonCode: 'silence_timeout',
    });
    const revived = moved({ from: 'ghosted', to: 'screening', hours: 130 });

    expect(averageResponseHours([history([APPLIED_AT_NOW, TO_SCREENING, ghosted, revived])])).toBe(
      65,
    );
  });

  it.each([
    { case: 'a withdrawal', to: 'withdrawn', reasonCode: null, average: 14 },
    {
      case: 'a rejection the candidate gave (low_salary)',
      to: 'rejected',
      reasonCode: 'low_salary',
      average: 14,
    },
    {
      case: 'a rejection the company gave (skills_gap)',
      to: 'rejected',
      reasonCode: 'skills_gap',
      average: 19,
    },
  ] as const)(
    'counts $case after tech_interview into an average of $average',
    ({ to, reasonCode, average }) => {
      const last = moved({ from: 'tech_interview', to, hours: 58, reasonCode });

      expect(
        averageResponseHours([history([APPLIED_AT_NOW, TO_SCREENING, TO_TECH_INTERVIEW, last])]),
      ).toBe(average);
    },
  );

  it('pools one reply from each of two applications into one average', () => {
    const laterScreening = moved({ from: 'applied', to: 'screening', hours: 18 });

    expect(
      averageResponseHours([
        history([APPLIED_AT_NOW, TO_SCREENING]),
        history([APPLIED_AT_NOW, laterScreening]),
      ]),
    ).toBe(14);
  });
});
