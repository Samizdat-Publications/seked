/**
 * Narrated play, the parts that are plain functions: the chapters of the script, how long words take to say
 * when there is no voice to time them, the swing of a turn, and the leaf in the address.
 */
import type { Leaf } from './leaves';
import { wrapAngle } from './projection';

export interface Chapter { n: number; title: string }

/** The chapters of docs/script.md, from its "## N. Title" headings. */
export function scriptChapters(script: string): Chapter[] {
  return [...script.matchAll(/^## (\d+)\. (.+?)\s*$/gm)].map((m) => ({ n: Number(m[1]), title: m[2] as string }));
}

/** One part of a chapter in docs/script.md: the text between its `**Name**` line and the next bold heading. */
export function scriptPart(script: string, chapter: number, name: string): string {
  const start = script.search(new RegExp(`^## ${chapter}\\. `, 'm'));
  if (start < 0) return '';
  const rest = script.slice(start);
  const end = rest.slice(3).search(/^## /m);
  const body = end < 0 ? rest : rest.slice(0, end + 3);
  const m = new RegExp(`^\\*\\*${name}\\*\\*:?(.*)$`, 'm').exec(body);
  if (!m) return '';
  const after = body.slice((m.index ?? 0) + m[0].length);
  const stop = after.search(/^\*\*[^*]+\*\*/m);
  return ((m[1] ?? '') + (stop < 0 ? after : after.slice(0, stop))).replace(/^---\s*$/m, '').trim();
}

/** The first leaf of each chapter the leaves cover, with its title. */
export function chapterStarts(leaves: readonly Leaf[], chapters: readonly Chapter[]): { chapter: Chapter; index: number }[] {
  const out: { chapter: Chapter; index: number }[] = [];
  leaves.forEach((L, i) => {
    if (i > 0 && leaves[i - 1]!.chapter === L.chapter) return;
    out.push({ chapter: chapters.find((c) => c.n === L.chapter) ?? { n: L.chapter, title: `Chapter ${L.chapter}` }, index: i });
  });
  return out;
}

/** Seconds to say some words at a narrator's pace, when no voice gives the timing: about 2.5 words a second. */
export function speakingTime(text: string, wordsPerSecond = 2.5): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  const stops = (text.match(/[.?!;:,]/g) ?? []).length;
  return words / wordsPerSecond + 0.18 * stops;
}

/** Each word's start, in seconds, spread by speakingTime: the timing until a voice reports its own. */
export function wordTimes(text: string, wordsPerSecond = 2.5): { word: string; at: number }[] {
  const out: { word: string; at: number }[] = [];
  let t = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    out.push({ word, at: t });
    t += speakingTime(word, wordsPerSecond);
  }
  return out;
}

export interface Aim { yaw: number; pitch: number; fov: number }

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Where a turn from one aim to another is at t (0 to 1), eased, the short way round. Radians. */
export function turnAt(from: Aim, to: Aim, t: number): Aim {
  const k = ease(Math.min(1, Math.max(0, t)));
  return {
    yaw: wrapAngle(from.yaw + wrapAngle(to.yaw - from.yaw) * k),
    pitch: from.pitch + (to.pitch - from.pitch) * k,
    fov: from.fov + (to.fov - from.fov) * k,
  };
}

/** How long a turn takes: longer for a wider swing, from 0.9 s to 2.4 s. */
export function turnSeconds(from: Aim, to: Aim): number {
  const swing = Math.hypot(wrapAngle(to.yaw - from.yaw), to.pitch - from.pitch, (to.fov - from.fov) * 0.5);
  return Math.min(2.4, 0.9 + swing * 1.1);
}

/** The leaf the address names, else the first. */
export function leafFromSearch(search: string, leaves: readonly Leaf[]): number {
  const id = new URLSearchParams(search).get('leaf');
  const i = leaves.findIndex((L) => L.id === id);
  return i < 0 ? 0 : i;
}

/** The address with this leaf in it, keeping anything else the address carries. */
export function searchWithLeaf(search: string, id: string): string {
  const q = new URLSearchParams(search);
  q.set('leaf', id);
  return `?${q.toString()}`;
}

/** How long a wipe takes to cross the screen. */
export const WIPE_SECONDS = 1.8;

/**
 * Where a wipe's edge stands at t (0 to 1), across the screen from -1 at the left to 1 at the right, eased; it
 * starts and ends just off screen so the slant of the edge clears the corners.
 */
export function wipeAt(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  return -1.12 + 2.24 * e;
}
