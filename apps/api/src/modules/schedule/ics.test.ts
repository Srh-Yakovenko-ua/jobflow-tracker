import ICAL from 'ical.js';
import { describe, expect, it } from 'vitest';

import { icsEventFieldsOf, veventOf } from '../../test/ics.js';
import { SCHEDULED_EVENT_ID } from '../../test/service-fixtures.js';
import { NOW } from '../../test/time.js';
import { type IcsEvent, icsOf } from './ics.js';

const EVENT: IcsEvent = {
  id: SCHEDULED_EVENT_ID,
  kind: 'tech_interview',
  company: 'Acme',
  startsAt: new Date('2026-11-02T13:00:00.000Z'),
  durationMin: 90,
  locationOrLink: 'https://meet.example.test/abc',
};

const LONG_COMPANY =
  'Товариство з обмеженою відповідальністю «Київські програмні рішення та хмарний консалтинг» 🚀 філія Львів';

const LINE_BREAK = '\r\n';

const lineLengthsOf = (ics: string) =>
  ics.split(LINE_BREAK).map((line) => Buffer.byteLength(line, 'utf8'));

const unfolded = (ics: string) => ics.replaceAll(`${LINE_BREAK} `, '');

describe('icsOf', () => {
  it('writes one VEVENT in a published Gregorian calendar with UTC basic times and CRLF ends', () => {
    expect(icsOf(EVENT, NOW).split(LINE_BREAK)).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//JobFlow Tracker//Scheduled events//UK',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${SCHEDULED_EVENT_ID}@jobflow-tracker`,
      'DTSTAMP:20261022T090000Z',
      'DTSTART:20261102T130000Z',
      'DTEND:20261102T143000Z',
      "SUMMARY:Техінтерв'ю · Acme",
      'LOCATION:https://meet.example.test/abc',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ]);
  });

  it('parses in ical.js back to the uid, summary, location, start and end of the event', () => {
    expect(icsEventFieldsOf(icsOf(EVENT, NOW))).toEqual({
      uid: `${SCHEDULED_EVENT_ID}@jobflow-tracker`,
      summary: "Техінтерв'ю · Acme",
      location: 'https://meet.example.test/abc',
      start: '2026-11-02T13:00:00.000Z',
      end: '2026-11-02T14:30:00.000Z',
    });
  });

  it('leaves LOCATION out for an event with no place or link', () => {
    const ics = icsOf({ ...EVENT, locationOrLink: null }, NOW);

    expect(ics).not.toContain('LOCATION');
    expect(veventOf(ics).getAllProperties('location')).toEqual([]);
  });

  it('ends every line in CRLF and never leaves a bare CR or LF', () => {
    const ics = icsOf({ ...EVENT, company: LONG_COMPANY }, NOW);

    expect(ics.endsWith(LINE_BREAK)).toBe(true);
    expect(ics.replaceAll(LINE_BREAK, '')).not.toMatch(/[\r\n]/);
  });

  it('folds a long Ukrainian summary at 75 octets on whole code points, and unfolding restores it', () => {
    const ics = icsOf({ ...EVENT, company: LONG_COMPANY }, NOW);
    const summary = `Техінтерв'ю · ${LONG_COMPANY}`;

    expect(Math.max(...lineLengthsOf(ics))).toBeLessThanOrEqual(75);
    expect(lineLengthsOf(ics).filter((octets) => octets > 70).length).toBeGreaterThan(1);
    expect(ics.split(LINE_BREAK).every((line) => Buffer.from(line).toString() === line)).toBe(true);
    expect(unfolded(ics).split(LINE_BREAK)).toContain(`SUMMARY:${summary}`);
    expect(icsEventFieldsOf(ics).summary).toBe(summary);
  });

  it('escapes a backslash, semicolon, comma and a line break so a link cannot start a new property', () => {
    const locationOrLink = 'Офіс; поверх 3, кімн. 5 \\ вхід\r\nX-INJECTED:yes';
    const ics = icsOf({ ...EVENT, company: 'Acme, Inc; Ltd', locationOrLink }, NOW);
    const vevent = veventOf(ics);

    expect(unfolded(ics)).toContain(
      'LOCATION:Офіс\\; поверх 3\\, кімн. 5 \\\\ вхід\\nX-INJECTED:yes\r\n',
    );
    expect(vevent.getAllProperties('x-injected')).toEqual([]);
    expect(new ICAL.Event(vevent).location).toBe('Офіс; поверх 3, кімн. 5 \\ вхід\nX-INJECTED:yes');
    expect(new ICAL.Event(vevent).summary).toBe("Техінтерв'ю · Acme, Inc; Ltd");
  });
});
