/**
 * What `Scene.tsx` still mounts, and where it went.
 *
 * The plateau's lesser monuments used to be drawn here as one set of OSM
 * massings, the same solid in every state. Stage 2 builds each group with the
 * builder `@seked/geometry` has for it, per stop on the timeline, in
 * `scene/Structures/`. The props have not changed, so this line is the whole
 * of what is left: the director may leave `Scene.tsx` alone, or import
 * `Structures` from `./Structures` and drop this file.
 */
export { Structures as Masses } from './Structures';
