import type { ScheduledEventKind } from '@jobflow/shared';
import { CalendarClock, type LucideIcon, PhoneCall } from 'lucide-react';

export const SCHEDULED_EVENT_ICON: Record<ScheduledEventKind, LucideIcon> = {
  screening_call: PhoneCall,
  tech_interview: CalendarClock,
  final_interview: CalendarClock,
  offer_call: PhoneCall,
  other: CalendarClock,
};
