/**
 * Motion, as data.
 *
 * A shot is a stretch of time with a camera in it and, optionally, the sun
 * moving, the sky's epoch rolling, a star held on the meridian, and the
 * timeline changing stop part way through. A sequence is a list of shots
 * with a name. The tour is one sequence; the film presets are others.
 *
 * Nothing here is drawn. A shot is played by writing the view store's own
 * fields (`scene/Motion.tsx`), so a frame of motion is a view a reader could
 * have reached by hand, and the address bar keeps mirroring it.
 *
 * Every camera is a composition and not a measurement. Every epoch and
 * sidereal time in a shot is a claim's own and is named by the claim in a
 * comment where it is typed, or is computed from the sky package.
 *
 * This file is the contract between the stage 4 tracks. The engine track
 * implements the tweens; the tour track writes shots against it; the film
 * track steps it. Add a field with a comment and report it.
 */
import type { CameraView, LayerId, Moment, Section, SphinxVariant, StateId } from '../view';

/** How a value moves between two keys. `inOut` is the default. */
export type Ease = 'linear' | 'in' | 'out' | 'inOut';

/** A value at a second from the shot's start. The ease governs the move that arrives at this key. */
export interface Key<T> {
  at: number;
  value: T;
  ease?: Ease;
}

/**
 * A camera key. One key is a stand; two or more are a path. `lift` is how
 * high the path arcs between this key and the one before it, as a fraction
 * of the distance between them, which is what keeps a move across the
 * plateau from flying through a pyramid. Absent, the engine chooses.
 */
export interface CameraKey extends Key<CameraView> {
  lift?: number;
}

/**
 * A change of the timeline's stop inside a shot: the stop arrived at and the
 * second the dissolve starts. `dissolveSeconds` lengthens the dissolve for
 * this change only; absent takes the default.
 */
export interface StateChange {
  to: StateId;
  at: number;
  dissolveSeconds?: number;
}

export interface Shot {
  id: string;
  /** How long the shot runs, in seconds. */
  seconds: number;
  /** The camera along the shot. Never empty. */
  camera: CameraKey[];
  /** The timeline stop the shot arrives at. Absent leaves the timeline where it was. */
  state?: StateChange;
  /** Further changes of stop in the same shot. */
  states?: StateChange[];
  /** The sun: the day and hour tweened between keys. Absent leaves the moment alone. */
  moment?: Key<Moment>[];
  /**
   * The sky's epoch, tweened between keys. Absent leaves the epoch where
   * the view has it (the stop's own, or the open claim's). A shot that
   * rolls the sky to an epoch and wants to hand it back afterwards ends
   * its keys at the stop's own epoch.
   */
  epoch?: Key<number>[];
  /**
   * Local apparent sidereal time in degrees, tweened the short way round;
   * or a star, by its id in `data/stars/named.json`, held on the meridian
   * at whatever epoch the sky is at, which is how the rollback film keeps
   * Alnitak still while the ages turn.
   */
  lst?: Key<number>[] | { meridian: string };
  /** The claim to open at the shot's start, null for none, absent to leave it. */
  claim?: string | null;
  /** Layers the shot needs. Any it does not name are left alone. */
  layers?: Partial<Record<LayerId, boolean>>;
  /** The cut at the shot's start. Absent is no cut. */
  section?: Partial<Section>;
  /** A claim's Sphinx, null for the stop's own, absent to leave it. */
  sphinx?: SphinxVariant | null;
  /** Narration, shown over the stage while the shot runs. */
  title?: string;
  text?: string;
}

export interface Sequence {
  id: string;
  label: string;
  /** What the sequence is for, in a sentence, for the drawers that list it. */
  note: string;
  shots: Shot[];
}

/** The whole length of a sequence, in seconds. */
export const sequenceSeconds = (sequence: Sequence): number => sequence.shots.reduce((sum, shot) => sum + shot.seconds, 0);
