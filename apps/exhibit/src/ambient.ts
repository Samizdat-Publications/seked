/**
 * The ambient sound under the narration: one looping bed for each kind of place and hour (scripts/ambient.py made them
 * with ElevenLabs' sound model, assets/narration/ambient-<bed>.mp3, served beside the narration), chosen by the leaf's
 * station, moment and era, crossfaded when the leaf changes it, and heard only while the exhibit plays. Web Audio loops
 * a decoded buffer without the gap an <audio> element leaves at each turn of an MP3.
 */
export const BEDS = ['today', 'built', 'green', 'night', 'inside'] as const;
export type Bed = (typeof BEDS)[number];

/** Where and when a leaf is decides what it sounds like: inside the pyramid, at night, in the green eras, as built, today. */
export function bedFor(L: { station: string; era: string; moment: string }): Bed {
  if (L.station === 'kings-chamber') return 'inside';
  if (L.moment.startsWith('night')) return 'night';
  if (L.era === 'first-time' || L.era === 'lion') return 'green';
  if (L.era === 'built') return 'built';
  return 'today';
}

const LEVEL = 0.5;                      // under the voice (the beds are normalised to -30 LUFS, the voice is near -16)
const GAIN: Partial<Record<Bed, number>> = { inside: 0.5 };   // the chamber's room tone reads louder than its level
const FADE_S = 1.6;

export class Ambient {
  private ctx: AudioContext | null = null;
  private buffers = new Map<Bed, Promise<AudioBuffer | null>>();
  private now: { bed: Bed; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wanted: Bed | null = null;

  /** Play the bed for this leaf, fading from whatever plays now (call from a click or after one: browsers start audio then). */
  play(bed: Bed): void {
    this.wanted = bed;
    if (this.now?.bed === bed) return;
    const ctx = this.context();
    if (!ctx) return;
    void this.buffer(bed).then((buf) => {
      if (!buf || this.wanted !== bed || this.now?.bed === bed) return;
      this.fadeOut();
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(LEVEL * (GAIN[bed] ?? 1), ctx.currentTime + FADE_S);
      src.connect(gain).connect(ctx.destination);
      src.start(0, Math.random() * buf.duration);        // not always from the same second
      this.now = { bed, src, gain };
    });
  }

  /** Fade the bed out (the exhibit paused). */
  stop(): void {
    this.wanted = null;
    this.fadeOut();
  }

  private fadeOut(): void {
    const n = this.now;
    if (!n || !this.ctx) return;
    const t = this.ctx.currentTime;
    n.gain.gain.cancelScheduledValues(t);
    n.gain.gain.setValueAtTime(n.gain.gain.value, t);
    n.gain.gain.linearRampToValueAtTime(0, t + FADE_S);
    n.src.stop(t + FADE_S + 0.05);
    this.now = null;
  }

  private context(): AudioContext | null {
    if (!this.ctx) {
      try { this.ctx = new AudioContext(); } catch { return null; }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private buffer(bed: Bed): Promise<AudioBuffer | null> {
    let p = this.buffers.get(bed);
    if (!p) {
      p = fetch(`narration/ambient-${bed}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((a) => this.ctx!.decodeAudioData(a))
        .catch(() => null);                                 // no bed is no sound, never a broken exhibit
      this.buffers.set(bed, p);
    }
    return p;
  }
}
