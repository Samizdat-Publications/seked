import { useEffect, useRef } from 'react';
import type { MeshStandardMaterial } from 'three';
import { applyAtmosphere } from '../Atmosphere';
import { forgetCascades, receiveCascades } from './shadows';
import { applyStone, useStone, type StoneOptions, type StoneRole } from './stone';

/**
 * A standard material that takes a role's photographed stone once it has
 * loaded, flat colour until then, and a cascade of the sun's shadow map and
 * the air between it and the camera either way. Shared by the pyramids, the
 * plateau's lesser monuments and anything else built from our own geometry.
 */
export function useStoneMaterial(role: StoneRole | undefined, options: StoneOptions): React.RefObject<MeshStandardMaterial | null> {
  const ref = useRef<MeshStandardMaterial>(null);
  const stone = useStone(role ?? 'core');
  const key = JSON.stringify(options);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    if (ref.current && role) applyStone(ref.current, stone, JSON.parse(key) as StoneOptions);
  }, [stone, role, key]);
  useEffect(() => {
    const material = ref.current;
    if (!material) return;
    applyAtmosphere(material);
    receiveCascades(material);
    return () => forgetCascades(material);
  });
  return ref;
}
