/**
 * Fly the camera: WASD over the plateau, the mouse to look, Q and E or space
 * and shift for up and down, at whatever the speed slider says. It is a plain
 * first-person control rather than drei's FlyControls because the passages
 * want pointer-lock mouse-look and a speed the panel owns and the URL keeps.
 *
 * Orientation is held as yaw and pitch rather than read back off the camera,
 * so looking straight up or down cannot roll the horizon; the camera's
 * quaternion is rebuilt from them every frame in YXZ order, which is the order
 * yaw-then-pitch is applied in.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Euler, Vector3 } from 'three';
import { useView } from '../store';

/** Radians of look per pixel of mouse travel. */
const LOOK = 0.0022;
/** Just short of straight up and straight down, so the frame never flips. */
const PITCH_LIMIT = Math.PI / 2 - 0.01;
/** How far ahead the orbit pivot is left when the reader goes back to orbiting. */
const PIVOT = 150;

/** Each key's push along (right, up, forward) in the camera's own terms. */
const KEYS: Record<string, [number, number, number]> = {
  KeyW: [0, 0, 1],
  KeyS: [0, 0, -1],
  KeyA: [-1, 0, 0],
  KeyD: [1, 0, 0],
  ArrowUp: [0, 0, 1],
  ArrowDown: [0, 0, -1],
  ArrowLeft: [-1, 0, 0],
  ArrowRight: [1, 0, 0],
  KeyE: [0, 1, 0],
  Space: [0, 1, 0],
  KeyQ: [0, -1, 0],
  ShiftLeft: [0, -1, 0],
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Keys belong to the panel while a reader is in a field of it. */
function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  const tag = el?.tagName;
  return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON';
}

export function FlyCamera(): null {
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const speed = useView((s) => s.speed);
  const setCamera = useView((s) => s.setCamera);

  const held = useRef(new Set<string>()).current;
  const yaw = useRef(0);
  const pitch = useRef(0);
  /** Yaw, pitch and position as last published, so a still camera is silent. */
  const published = useRef<string>('');
  const vectors = useMemo(
    () => ({ euler: new Euler(0, 0, 0, 'YXZ'), forward: new Vector3(), right: new Vector3(), up: new Vector3(0, 1, 0), move: new Vector3() }),
    [],
  );

  // Start looking wherever the orbit camera was looking. This has to be a
  // layout effect: a passive one can be flushed after the render loop's next
  // frame, by which time the frame below has already put the camera straight.
  useLayoutEffect(() => {
    const dir = new Vector3();
    camera.getWorldDirection(dir);
    yaw.current = Math.atan2(-dir.x, -dir.z);
    pitch.current = Math.asin(clamp(dir.y, -1, 1));
    published.current = '';
  }, [camera]);

  useEffect(() => {
    const locked = (): boolean => document.pointerLockElement === dom;
    const onClick = (): void => {
      if (!locked()) void dom.requestPointerLock();
    };
    const onMouseMove = (e: MouseEvent): void => {
      if (!locked()) return;
      yaw.current -= e.movementX * LOOK;
      pitch.current = clamp(pitch.current - e.movementY * LOOK, -PITCH_LIMIT, PITCH_LIMIT);
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (typing(e.target) || !(e.code in KEYS)) return;
      held.add(e.code);
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      held.delete(e.code);
    };
    const onBlur = (): void => held.clear();

    dom.addEventListener('click', onClick);
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      dom.removeEventListener('click', onClick);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      held.clear();
      if (locked()) document.exitPointerLock();
    };
  }, [dom, held]);

  useFrame((_, delta) => {
    const { euler, forward, right, up, move } = vectors;
    camera.quaternion.setFromEuler(euler.set(pitch.current, yaw.current, 0, 'YXZ'));

    move.set(0, 0, 0);
    if (held.size > 0) {
      forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      for (const code of held) {
        const [r, u, f] = KEYS[code] as [number, number, number];
        move.addScaledVector(right, r).addScaledVector(up, u).addScaledVector(forward, f);
      }
      // A step of at most one second's travel, whatever the frame rate did.
      if (move.lengthSq() > 0) camera.position.addScaledVector(move.normalize(), speed * Math.min(delta, 1));
    }

    // The pivot is left ahead of the camera, so going back to orbiting turns
    // around what the reader was looking at rather than around the origin. A
    // camera that has not moved says nothing, so a still view stops writing.
    const p = camera.position;
    const state = `${p.x},${p.y},${p.z},${yaw.current},${pitch.current}`;
    if (state === published.current) return;
    published.current = state;
    forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    setCamera({
      position: [p.x, p.y, p.z],
      target: [p.x + forward.x * PIVOT, p.y + forward.y * PIVOT, p.z + forward.z * PIVOT],
    });
  });

  return null;
}
