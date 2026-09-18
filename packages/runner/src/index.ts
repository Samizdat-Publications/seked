/**
 * The Node entry: the browser-safe runner plus the parts that touch the disk,
 * which is how `@seked/claims` is split as well. A proposed claim written from
 * here goes under `build/claims/` and never under `data/claims/`.
 */
export * from './browser';
