import { useEffect, useRef } from 'react';
import type { MeshStandardMaterial } from 'three';
import { applyAtmosphere } from '../Atmosphere';
import { forgetCascades, receiveCascades } from './shadows';
import { applyStone, useStone, type Stone, type StoneOptions, type StoneRole } from './stone';

/** What the stone was last applied to, so the same work is not redone every frame. */
interface Applied {
  material: MeshStandardMaterial;
  key: string;
  stone: Stone | undefined;
}

/**
 * A standard material that takes a role's photographed stone once it has
 * loaded, flat colour until then, and a cascade of the sun's shadow map and
 * the air between it and the camera either way. Shared by the pyramids, the
 * plateau's lesser monuments and anything else built from our own geometry.
 *
 * The effect below deliberately has no dependency array, and that is the
 * whole of a fault found on 2026-09-20. It used to depend on
 * `[stone, role, key]`, none of which is the material: `Built.tsx` and the
 * others key their `<meshStandardMaterial>` on the timeline's state, so
 * moving the timeline unmounts the material and mounts a new one while the
 * stone, the role and the options all stay exactly as they were. The effect
 * therefore did not run, and the new material never got `applyStone` at all.
 * Its neighbour, which applies the air and the cascades, has never had a
 * dependency array, so those two were reapplied and the stone was not, and a
 * material in that condition carries the cache key `air:v3` and draws its
 * flat colour with no photograph, no relief and no joints.
 *
 * What that looked like: every structure built this way lost its stone the
 * first time a reader moved the timeline, or the walkthrough stepped between
 * states, and kept the flat colour until something unrelated forced the
 * effect. It is most of why the mastaba field read as a pale carpet, and it
 * is why the same field measured differently on a fresh load than it did
 * after stepping through the tour.
 *
 * Running on every render and guarding on identity is the cheap fix. The
 * guard matters: `applyStone` ends in `patchMaterial`, which sets
 * `needsUpdate`, and a material recompiled every frame would cost far more
 * than the patch.
 */
export function useStoneMaterial(role: StoneRole | undefined, options: StoneOptions): React.RefObject<MeshStandardMaterial | null> {
  const ref = useRef<MeshStandardMaterial>(null);
  const stone = useStone(role ?? 'core');
  const key = JSON.stringify(options);
  const applied = useRef<Applied | null>(null);
  useEffect(() => {
    const material = ref.current;
    if (!material || !role) return;
    const last = applied.current;
    if (last && last.material === material && last.key === key && last.stone === stone) return;
    applyStone(material, stone, JSON.parse(key) as StoneOptions);
    applied.current = { material, key, stone };
  });
  useEffect(() => {
    const material = ref.current;
    if (!material) return;
    applyAtmosphere(material);
    receiveCascades(material);
    return () => forgetCascades(material);
  });
  return ref;
}
