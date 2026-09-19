/**
 * The survey grid, and the reason it is not a plain `gridHelper` any more.
 *
 * It is a reading aid: hundred-metre cells on the datum, so a reader can put a
 * length to what they are looking at. That is a job it does within a few
 * hundred metres of the monuments and nowhere else.
 *
 * Drawn plainly it does something much worse than being useless at range. Six
 * kilometres of lines seen from a stand a few tens of metres up fall edge-on
 * into one row of pixels, and because the lines are opaque and dark
 * (`#1d2630`) that row comes out a solid near-black band along the horizon,
 * with the city drawn over it. That band was logged on 2026-09-18 as "the
 * ground east of the plateau reads near black under a low sun", measured at
 * 17, 33, 47 at the panorama stand at 16:00, and hunted twice as a hole in the
 * terrain and as a fault in a shader patch. It was neither: it is this, and
 * the pixel at that stand reads 204, 178, 155 with the grid switched off
 * (found by raycasting through the dark pixel, 2026-09-19).
 *
 * So the grid fades out with distance from the camera and stops writing depth.
 * `FADE` is a LOOK CHOICE: full strength where the reader is measuring
 * something, gone before it can pile up at the horizon.
 */
import { useEffect, useMemo } from 'react';
import { GridHelper, type LineBasicMaterial } from 'three';
import { patchMaterial } from './materials/patch';

/** Metres from the camera at which the grid starts to fade, and where it is gone. */
const FADE = { from: 700, to: 2200 } as const;

/** The grid's own shape: six kilometres of hundred-metre cells on the datum. */
const GRID = { metres: 6000, divisions: 60, axis: '#38475a', line: '#1d2630' } as const;

export function SurveyGrid(): React.JSX.Element {
  const grid = useMemo(() => new GridHelper(GRID.metres, GRID.divisions, GRID.axis, GRID.line), []);

  useEffect(() => {
    const material = grid.material as LineBasicMaterial;
    material.transparent = true;
    material.depthWrite = false;
    patchMaterial(material, 'gridFade', 'v1', (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vGridRange;')
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\nvGridRange = -mvPosition.z;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vGridRange;')
        .replace(
          '#include <premultiplied_alpha_fragment>',
          `  gl_FragColor.a *= 1.0 - smoothstep(${FADE.from.toFixed(1)}, ${FADE.to.toFixed(1)}, vGridRange);\n#include <premultiplied_alpha_fragment>`,
        );
    });
    return () => {
      grid.geometry.dispose();
      material.dispose();
    };
  }, [grid]);

  return <primitive object={grid} />;
}
