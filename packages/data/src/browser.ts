/**
 * The browser entry: schemas, types and `resolve`, with no node:fs anywhere in
 * the import graph. The viewer fetches the bundle that scripts/bundle.ts
 * writes and resolves presets against it exactly as the Node tools do.
 */
export * from './core';
