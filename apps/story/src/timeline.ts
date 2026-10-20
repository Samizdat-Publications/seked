/**
 * Chapter 7's timeline (docs/script.md, chapter 7's beats): the end of the
 * last Ice Age in Greenland's ice, from the imported NGRIP record
 * (data/icecore/ngrip-d18o.json, written by scripts/icecore.ts; never drawn by
 * hand) and the Younger Dryas's boundaries as records (data/icecore/events.json).
 * Ages are years b2k, before 2000 CE; the claims' epochs are astronomical years.
 */
import events from '../../../data/icecore/events.json';
import ngrip from '../../../data/icecore/ngrip-d18o.json';

export interface IcePoint {
  ageB2k: number;
  d18o: number;
  /** The maximum counting error, years; the file reads it as 2 sigma. */
  mce: number;
}

export const ICE_SOURCE = ngrip.source;
export const ICE: IcePoint[] = (ngrip.rows as number[][]).map(([ageB2k, d18o, mce]) => ({ ageB2k: ageB2k!, d18o: d18o!, mce: mce! }));

const event = (key: string) => {
  const e = events.events.find((x) => x.key === key);
  if (!e) throw new Error(`data/icecore/events.json has no ${key}`);
  return e;
};
/** The Younger Dryas, as GICC05 bounds it: the start of GS-1 and the start of the Holocene. */
export const YOUNGER_DRYAS = { start: event('gs1.start'), end: event('holocene.start') };

/** An astronomical year (−10449 is 10,450 BCE) as years b2k, and back. */
export const toB2k = (epoch: number) => 2000 - epoch;
export const fromB2k = (b2k: number) => 2000 - b2k;

/** The record between two ages, oldest first, as the timeline runs left to right. */
export const iceBetween = (oldB2k: number, youngB2k: number) =>
  ICE.filter((p) => p.ageB2k <= oldB2k && p.ageB2k >= youngB2k).sort((a, b) => b.ageB2k - a.ageB2k);
