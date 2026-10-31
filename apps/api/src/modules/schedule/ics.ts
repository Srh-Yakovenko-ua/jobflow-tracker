import type { ScheduledEventKind } from '@jobflow/shared';

import { addMinutes } from '../../common/add-minutes.js';
import { scheduledEventTitle, type TimedEvent } from './scheduled-event-rules.js';

export type IcsEvent = TimedEvent & {
  id: string;
  kind: ScheduledEventKind;
  company: string;
  locationOrLink: string | null;
};

const ICS_FORMAT = { lineBreak: '\r\n', lineOctets: 75, uidDomain: 'jobflow-tracker' } as const;

const CALENDAR_HEAD = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//JobFlow Tracker//Scheduled events//UK',
  'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH',
  'BEGIN:VEVENT',
];

const CALENDAR_TAIL = ['END:VEVENT', 'END:VCALENDAR'];

const utcStamp = (at: Date) =>
  at
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replaceAll(/[-:]/g, '');

const escapeText = (text: string) =>
  text.replaceAll(/[\\;,]/g, (character) => `\\${character}`).replaceAll(/\r\n|\r|\n/g, '\\n');

function fold(line: string): string {
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character, 'utf8');
    if (octets + size > ICS_FORMAT.lineOctets) {
      parts.push(current);
      current = ' ';
      octets = 1;
    }
    current += character;
    octets += size;
  }
  return [...parts, current].join(ICS_FORMAT.lineBreak);
}

function eventLines(event: IcsEvent, now: Date): string[] {
  const { id, kind, company, startsAt, durationMin, locationOrLink } = event;
  return [
    `UID:${id}@${ICS_FORMAT.uidDomain}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(startsAt)}`,
    `DTEND:${utcStamp(addMinutes(startsAt, durationMin))}`,
    `SUMMARY:${escapeText(scheduledEventTitle(kind, company))}`,
    ...(locationOrLink === null ? [] : [`LOCATION:${escapeText(locationOrLink)}`]),
  ];
}

export function icsOf(event: IcsEvent, now: Date): string {
  const lines = [...CALENDAR_HEAD, ...eventLines(event, now), ...CALENDAR_TAIL];
  return lines.map(fold).join(ICS_FORMAT.lineBreak) + ICS_FORMAT.lineBreak;
}
