import ICAL from 'ical.js';

export function veventOf(ics: string) {
  const vevent = ICAL.Component.fromString(ics).getFirstSubcomponent('vevent');
  if (vevent === null) {
    throw new Error('The calendar holds no VEVENT');
  }
  return vevent;
}

export function icsEventFieldsOf(ics: string) {
  const event = new ICAL.Event(veventOf(ics));
  return {
    uid: event.uid,
    summary: event.summary,
    location: event.location,
    start: event.startDate.toJSDate().toISOString(),
    end: event.endDate.toJSDate().toISOString(),
  };
}
