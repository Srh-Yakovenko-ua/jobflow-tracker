import { Injectable } from '@nestjs/common';
import { type Duration, milliseconds, subMilliseconds } from 'date-fns';

export const before = (now: Date, duration: Duration) =>
  subMilliseconds(now, milliseconds(duration));

@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}
