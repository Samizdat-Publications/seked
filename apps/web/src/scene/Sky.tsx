/**
 * The sun of the moment, for everything that needs to know where it is.
 *
 * The sky mesh, the environment map and the stars arrive in the next task.
 * What is here is the one number the rest of the scene cannot be built
 * without: the direction of the sun for the epoch the reader is looking at,
 * the day and the hour on the timeline, and the observer the database puts
 * the Great Pyramid at.
 *
 * Nothing in this file computes an astronomical quantity. `sunAt` in
 * `@seked/sky` does that, checked against the bake the Blender renders are
 * lit by, and this turns its altitude and azimuth into a vector in three's
 * world frame.
 */
import { enuDirection, sunAt, type SunPosition } from '@seked/sky/browser';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import { useView } from '../store';
import { sceneEpoch } from '../view';

/** Where the plateau is, which is the Great Pyramid's own centre. */
export interface Observer {
  latitudeDeg: number;
  longitudeDeg: number;
}

export interface Sun extends SunPosition {
  /**
   * A unit vector toward the sun in three's world frame, which is the data
   * frame turned Y-up: +X east, +Y up, +Z south.
   */
  direction: Vector3;
  /** Above the horizon on the same convention as a published sunrise. */
  up: boolean;
}

/**
 * The data frame's east, north and up as three's world frame reads them. The
 * one rotation in `Scene.tsx` turns the scene's geometry this way, and a
 * direction that is not in the scene graph has to be turned by hand.
 */
export function worldDirection(altitudeDeg: number, azimuthDeg: number): Vector3 {
  const [east, north, up] = enuDirection(altitudeDeg, azimuthDeg);
  return new Vector3(east, up, -north);
}

/**
 * The sun for the store's epoch and moment, memoised on the four numbers it
 * depends on so a camera drag does not recompute it.
 *
 * The epoch is the reader's override, or the viewer's default. It cannot see
 * the epoch of a selected claim, which `App.tsx` computes and does not pass
 * down: with a dated claim open and no override, the star dome follows that
 * claim and the sun keeps the default. Closing that gap means passing the
 * scene's epoch into `Scene`, which is another track's file.
 */
export function useSun({ latitudeDeg, longitudeDeg }: Observer): Sun {
  const override = useView((s) => s.epoch);
  const day = useView((s) => s.moment.day);
  const hour = useView((s) => s.moment.hour);
  const epoch = sceneEpoch(override, undefined);
  return useMemo(() => {
    const at = sunAt({ epoch, day, hour, latitudeDeg, longitudeDeg });
    return {
      ...at,
      direction: worldDirection(at.altitudeDeg, at.azimuthDeg),
      up: at.apparentAltitudeDeg !== undefined,
    };
  }, [epoch, day, hour, latitudeDeg, longitudeDeg]);
}
