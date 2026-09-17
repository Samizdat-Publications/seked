/**
 * Which materials the cascaded shadow maps are wired into.
 *
 * `CSM.setupMaterial` has to be called on every material that is to receive a
 * cascade, and the materials are created all over the scene by components
 * that know nothing about the renderer. The alternative to this small
 * register is threading a CSM instance through every component as a prop or
 * a context, for a viewer that has exactly one canvas and exactly one sun.
 *
 * The register is a set of live materials and the current CSM. Either can
 * arrive first: a material that registers before the sun is set up is wired
 * when it is, and a CSM that replaces another rewires everything already
 * registered.
 */
import type { CSM } from 'three/examples/jsm/csm/CSM.js';
import type { Material } from 'three';
import { dropForeign, readoptPatches } from './patch';

let cascades: CSM | undefined;
const materials = new Set<Material>();
/**
 * Which materials are already wired to the current cascades. A component that
 * re-renders asks again every time, and setting a material up twice would
 * mark it for recompilation for nothing. Replaced whole when the cascades
 * change, so everything is wired again.
 */
let wired = new WeakSet<Material>();

function wire(material: Material): void {
  wired.add(material);
  if (!cascades) {
    // `CSM.dispose` deletes `onBeforeCompile` off every material it touched,
    // so the patches have to be put back once the sun has gone.
    dropForeign(material);
    return;
  }
  cascades.setupMaterial(material);
  // CSM assigns its own `onBeforeCompile`; take the hook back so the stone
  // and the air survive, with CSM's uniforms still running first.
  readoptPatches(material);
}

/** Give a material its cascades, now or as soon as there are any. */
export function receiveCascades(material: Material): void {
  materials.add(material);
  if (!wired.has(material)) wire(material);
}

/** Drop a material as its component unmounts, so the set does not hold it. */
export function forgetCascades(material: Material): void {
  materials.delete(material);
}

/** The scene's cascaded shadow maps, or undefined while there are none. */
export function setCascades(next: CSM | undefined): void {
  cascades = next;
  wired = new WeakSet();
  for (const material of materials) wire(material);
}
