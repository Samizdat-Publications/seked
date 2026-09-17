/**
 * One material, several patches.
 *
 * Three gives a material a single `onBeforeCompile`, and this scene wants
 * three things in it: the cascaded shadow maps' uniforms, the triplanar
 * stone, and the air between the camera and the monument. Each is written by
 * a different file and any of them may arrive first or not at all, so none
 * can own the hook. This module owns it, keeps the patches in a list on the
 * material itself, and runs them in the order they were added.
 *
 * A hook that came from outside, which in practice means `CSM.setupMaterial`
 * assigning its own, is adopted as the first of the list rather than
 * overwritten. That is the whole reason this exists: CSM hands out an
 * `onBeforeCompile` and would silently throw away the stone if it were
 * allowed to assign over it, or have its own uniforms thrown away if the
 * stone were assigned second.
 *
 * `customProgramCacheKey` is the joined keys of the patches, so two materials
 * patched differently do not share a compiled program and two patched alike
 * do.
 */
import type { Material, WebGLProgramParametersWithUniforms, WebGLRenderer } from 'three';

/** What a patch does to the shader three is about to compile. */
export type ShaderPatch = (shader: WebGLProgramParametersWithUniforms) => void;

type Hook = (this: Material, shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => void;

interface PatchState {
  /** An `onBeforeCompile` assigned by something that does not know about this module. */
  foreign: Hook | undefined;
  patches: Map<string, { run: ShaderPatch; key: string }>;
  /** The hook this module installed, so a later foreign one can be told apart from it. */
  hook: Hook | undefined;
}

const STATE = Symbol.for('seked.materialPatches');

type Patchable = Material & { [STATE]?: PatchState };

/**
 * The material's patch list, adopting anything that has assigned the hook
 * since the last look. Three's own prototype no-op is not adopted: it is not
 * an own property of the material.
 */
function stateOf(material: Material): PatchState {
  const owner = material as Patchable;
  let state = owner[STATE];
  if (!state) {
    state = { foreign: undefined, patches: new Map(), hook: undefined };
    owner[STATE] = state;
  }
  const current = Object.prototype.hasOwnProperty.call(material, 'onBeforeCompile')
    ? (material.onBeforeCompile as Hook)
    : undefined;
  if (current && current !== state.hook) state.foreign = current;
  return state;
}

function install(material: Material, state: PatchState): void {
  const hook: Hook = function hook(shader, renderer) {
    state.foreign?.call(material, shader, renderer);
    for (const patch of state.patches.values()) patch.run(shader);
  };
  state.hook = hook;
  material.onBeforeCompile = hook;
  material.customProgramCacheKey = () => [...state.patches].map(([name, patch]) => `${name}:${patch.key}`).join('|');
  material.needsUpdate = true;
}

/**
 * Add or replace a named patch on a material. `key` is what makes two
 * materials' programs different: anything a patch bakes into the shader text,
 * rather than passes as a uniform, belongs in it.
 */
export function patchMaterial(material: Material, name: string, key: string, run: ShaderPatch): void {
  const state = stateOf(material);
  state.patches.set(name, { run, key });
  install(material, state);
}

/**
 * Take back the hook after something else has assigned over it, keeping every
 * patch already on the material and running the newcomer first. This is what
 * a caller does immediately after `CSM.setupMaterial`.
 */
export function readoptPatches(material: Material): void {
  const state = stateOf(material);
  if (state.patches.size > 0) install(material, state);
}

/**
 * Forget the foreign hook and put this module's own back, which is what a
 * caller does after `CSM.dispose` has deleted the hook off the material: the
 * material's stone and air have to survive the sun being torn down.
 */
export function dropForeign(material: Material): void {
  const state = stateOf(material);
  state.foreign = undefined;
  if (state.patches.size > 0) install(material, state);
}

/**
 * Insert a chunk of GLSL before an include, keeping the include. Every patch
 * here works this way, and doing it in one place is what keeps a typo in a
 * chunk name from silently doing nothing.
 */
export function before(source: string, include: string, chunk: string): string {
  const marker = `#include <${include}>`;
  if (!source.includes(marker)) {
    console.warn(`seked: shader has no #include <${include}>`);
    return source;
  }
  return source.replace(marker, `${chunk}\n${marker}`);
}

/** Insert a chunk of GLSL after an include, keeping the include. */
export function after(source: string, include: string, chunk: string): string {
  const marker = `#include <${include}>`;
  if (!source.includes(marker)) {
    console.warn(`seked: shader has no #include <${include}>`);
    return source;
  }
  return source.replace(marker, `${marker}\n${chunk}`);
}
