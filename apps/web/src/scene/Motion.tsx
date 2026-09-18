/**
 * The player. Runs inside the Canvas, reads the motion store each frame and
 * writes the view store so the scene follows.
 *
 * This is the trunk's player: it cuts. At the start of each shot it applies
 * the shot's claim, layers, cut, Sphinx and state, and puts the camera on the
 * shot's first key; then it waits for the clock. Track M replaces it with
 * one that eases the camera along the keys and tweens the sun, the epoch and
 * the sidereal time. Nothing else in the scene should notice the swap.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { useMotion } from '../motion/store';
import type { Shot } from '../motion/types';
import { useView, type ViewStore } from '../store';
import type { LayerId } from '../view';

/** What the old tour's `applyStep` did, for the fields a shot shares with a step. */
export function cutToShot(shot: Shot, store: ViewStore): void {
  if (shot.claim !== undefined && store.claim !== shot.claim) store.setClaim(shot.claim);
  for (const [id, on] of Object.entries(shot.layers ?? {}) as [LayerId, boolean][]) {
    if (store.layers[id] !== on) store.toggleLayer(id);
  }
  store.setSection({ on: false, ...shot.section });
  if (shot.sphinx !== undefined) store.setSphinx(shot.sphinx);
  if (shot.state && shot.state.at <= 0) store.setState(shot.state.to);
  if (shot.epoch && shot.epoch.length > 0) store.setEpoch(shot.epoch[0]!.value);
  if (Array.isArray(shot.lst) && shot.lst.length > 0) store.setLst(shot.lst[0]!.value);
  if (shot.moment && shot.moment.length > 0) store.setMoment(shot.moment[0]!.value);
  const first = shot.camera[0];
  if (first) store.showCamera(first.value);
  store.setMode('orbit');
}

export function Motion(): null {
  /** The shot last cut to, as `sequence.id:index`, so a shot is cut to once. */
  const seen = useRef<string>('');
  const stateDone = useRef<string>('');

  useFrame((_, delta) => {
    const motion = useMotion.getState();
    if (motion.clock === 'wall' && motion.playing) motion.advance(delta);
    const { sequence, shot: index, time } = useMotion.getState();
    if (!sequence) {
      seen.current = '';
      return;
    }
    const shot = sequence.shots[index];
    if (!shot) return;
    const id = `${sequence.id}:${index}`;
    const view = useView.getState();
    if (seen.current !== id) {
      seen.current = id;
      stateDone.current = '';
      cutToShot(shot, view);
    }
    if (shot.state && shot.state.at > 0 && time >= shot.state.at && stateDone.current !== id) {
      stateDone.current = id;
      view.setState(shot.state.to);
    }
  });

  return null;
}
