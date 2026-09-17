/**
 * Reading a moment and an epoch out loud. These are captions, not astronomy:
 * the sun's real place for a day and an hour is the sky package's business,
 * and nothing here is ever used as a number by anything downstream.
 */
import { DAY_MAX, DAY_MIN, type Moment } from '../view';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Days in each month of a common year. The 366th day reads as 31 December. */
const LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/**
 * The day of the year as a date, on a common year's calendar, so that the
 * preset days read as the dates they were chosen for: day 79 is 20 March and
 * day 355 is 21 December. A leap year would move both by a day, which is the
 * kind of precision a preset does not have and the caption should not claim.
 */
export function dateWords(day: number): string {
  const n = Math.min(Math.max(Math.round(day), DAY_MIN), DAY_MAX);
  let left = Math.min(n, 365);
  for (let m = 0; m < LENGTHS.length; m += 1) {
    const length = LENGTHS[m] as number;
    if (left <= length) return `${left} ${MONTHS[m] as string}`;
    left -= length;
  }
  return '31 December';
}

/** Decimal hours as a clock reading, 24 hour, always four figures. */
export function clock(hour: number): string {
  const minutes = Math.round(((hour % 24) + 24) % 24 * 60) % 1440;
  return `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
}

/** "21 December, 16:00 local", the middle of the caption line. */
export const momentWords = (moment: Moment): string => `${dateWords(moment.day)}, ${clock(moment.hour)} local`;

/**
 * A year as a caption says it. Astronomical year numbering counts a year zero,
 * so -10499 is 10,500 BCE; a year of our own era is left as the bare number,
 * which is how the timeline's stops are written in the design.
 */
export function yearWords(epoch: number): string {
  const year = Math.round(epoch);
  if (year >= 1) return String(year);
  return `${(1 - year).toLocaleString('en-US')} BCE`;
}
