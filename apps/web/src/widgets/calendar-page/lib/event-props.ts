import { type CalendarItem, calendarItemSchema } from '@jobflow/shared';

export type CalendarEventProps = CalendarItem['extendedProps'];

const extendedPropsSchema = calendarItemSchema.shape.extendedProps;

export function eventPropsOf(extendedProps: unknown): CalendarEventProps | null {
  const parsed = extendedPropsSchema.safeParse(extendedProps);
  return parsed.success ? parsed.data : null;
}
