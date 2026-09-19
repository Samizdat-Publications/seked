/**
 * The green's two rules that a picture cannot check for itself.
 *
 * The first is that the stop's green reaches the shader after the material has
 * already been compiled, which is every time but the first: three only calls
 * `onBeforeCompile` when it has to build a program, so a patch that makes a
 * fresh uniform object on each call writes into something nothing will read
 * and the ground keeps the stop it compiled under. That fault was live in the
 * viewer from stage 3 to 2026-09-19 and no frame rate or screenshot named it.
 *
 * The second is that `greenAt` on the CPU and `sekedGreen` in GLSL are the
 * same function: the grass cards stand where the tint is.
 */
import { MeshStandardMaterial, Vector3, type WebGLProgramParametersWithUniforms } from 'three';
import { describe, expect, it } from 'vitest';
import { applyGreen, buildGreenMask, GREEN, greenAt, greenFor, type GreenMask } from './ground';

/** A mask over a square kilometre with nothing built on it. */
function mask(): GreenMask {
  return buildGreenMask([], { x0: -500, y0: -500, size: 1000 });
}

/** What three hands a patch, cut down to the parts these patches touch. */
function shaderStub(): WebGLProgramParametersWithUniforms {
  return {
    uniforms: {},
    vertexShader: '#include <common>\nvoid main() {\n#include <worldpos_vertex>\n}',
    fragmentShader: '#include <common>\nvoid main() {\n#include <alphamap_fragment>\n}',
  } as unknown as WebGLProgramParametersWithUniforms;
}

/** Compile the material once, the way three would, and keep what it was given. */
function compile(material: MeshStandardMaterial): WebGLProgramParametersWithUniforms {
  const shader = shaderStub();
  material.onBeforeCompile(shader, null as never);
  return shader;
}

describe('applyGreen', () => {
  it('reaches a shader that was compiled before the stop changed', () => {
    const material = new MeshStandardMaterial();
    const m = mask();
    applyGreen(material, { mask: m, level: -46.2, ...greenFor('today') });
    const shader = compile(material);
    expect(shader.uniforms.greenStrength?.value).toBe(GREEN.valley.strength);
    expect(shader.uniforms.greenUpland?.value).toBe(0);

    // The timeline moves to the First Time. Three has a program for this
    // material already and will not call the patch again, so the write has to
    // land in the objects that program is holding.
    applyGreen(material, { mask: m, level: undefined, ...greenFor('ancient') });
    expect(shader.uniforms.greenStrength?.value).toBe(GREEN.strength.ancient);
    expect(shader.uniforms.greenUpland?.value).toBe(GREEN.uplandShare);
    expect(shader.uniforms.greenHasWater?.value).toBe(0);
    expect(shader.uniforms.greenColour?.value).toBe(GREEN.colour);
  });

  it('gives two materials their own uniforms', () => {
    const plateau = new MeshStandardMaterial();
    const ring = new MeshStandardMaterial();
    const m = mask();
    applyGreen(plateau, { mask: m, level: -46.2, ...greenFor('ancient') });
    applyGreen(ring, { mask: m, level: -46.2, ...greenFor('today') });
    const a = compile(plateau);
    const b = compile(ring);
    expect(a.uniforms.greenStrength?.value).toBe(GREEN.strength.ancient);
    expect(b.uniforms.greenStrength?.value).toBe(GREEN.valley.strength);
  });

  it('declares every uniform the chunk reads', () => {
    const material = new MeshStandardMaterial();
    applyGreen(material, { mask: mask(), level: 0, ...greenFor('ancient') });
    const shader = compile(material);
    for (const name of shader.fragmentShader.matchAll(/uniform \w+ (green\w+);/g)) {
      expect(shader.uniforms[name[1] as string], `${name[1]} has no value`).toBeDefined();
    }
  });
});

describe('greenAt', () => {
  it('is nothing where the stop has no green', () => {
    const m = mask();
    expect(greenAt(m, 0, 0, 20, 1, -46.2, GREEN.strength.today)).toBe(0);
  });

  it('stops above the valley band, which is what the shader takes its early way out on', () => {
    const m = mask();
    const bands = { upland: GREEN.valley.upland, wetMetres: GREEN.valley.wetMetres, dryMetres: GREEN.valley.dryMetres };
    const level = -46.2;
    const low = greenAt(m, 0, 0, level + 2, 1, level, GREEN.valley.strength, bands);
    const high = greenAt(m, 0, 0, level + GREEN.valley.dryMetres, 1, level, GREEN.valley.strength, bands);
    expect(low).toBeGreaterThan(0);
    expect(high).toBe(0);
  });

  it('keeps the First Time green off a cliff', () => {
    const m = mask();
    // Somewhere the noise put a patch: away from the water the mottle is the
    // only term, and most of the square is between patches.
    let patch: [number, number] | undefined;
    for (let x = -480; x < 480 && !patch; x += 20) {
      for (let y = -480; y < 480 && !patch; y += 20) {
        if (greenAt(m, x, y, 60, 1, undefined, GREEN.strength.ancient) > 0.1) patch = [x, y];
      }
    }
    expect(patch, 'no green anywhere on a mask with nothing built on it').toBeDefined();
    const [x, y] = patch as [number, number];
    const flat = greenAt(m, x, y, 60, 1, undefined, GREEN.strength.ancient);
    const wall = greenAt(m, x, y, 60, 0.2, undefined, GREEN.strength.ancient);
    expect(flat).toBeGreaterThan(wall);
    expect(wall).toBe(0);
  });
});

describe('greenFor', () => {
  it('gives the modern stops the valley and the ancient ones the plateau', () => {
    expect(greenFor('today')).toMatchObject({ upland: 0, strength: GREEN.valley.strength });
    expect(greenFor('stripped')).toMatchObject({ upland: 0 });
    expect(greenFor('ancient')).toMatchObject({ strength: GREEN.strength.ancient, colour: GREEN.colour });
    expect(greenFor('built')).toMatchObject({ strength: GREEN.strength.built, colour: GREEN.dry });
    expect(greenFor('ancient').upland).toBeUndefined();
  });
});

describe('the mask', () => {
  it('keeps a margin round a footprint clear', () => {
    const ring: [number, number][] = [
      [-20, -20],
      [20, -20],
      [20, 20],
      [-20, 20],
    ];
    const built = buildGreenMask([{ id: 'x', kind: 'mastaba', ring, area: 1600 } as never], {
      x0: -500,
      y0: -500,
      size: 1000,
    });
    const green = greenAt(built, 0, 0, 60, 1, undefined, 1);
    expect(green).toBe(0);
    expect(new Vector3(0, 0, 0).length()).toBe(0);
  });
});
