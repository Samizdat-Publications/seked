/** The few parts of @mkkellogg/gaussian-splats-3d (no types of its own) that Explore's splat walk uses. */
declare module '@mkkellogg/gaussian-splats-3d' {
  export const SceneFormat: { Splat: number; Ply: number; KSplat: number };
  export class Viewer {
    constructor(options: Record<string, unknown>);
    addSplatScene(path: string, options?: Record<string, unknown>): Promise<void>;
    start(): void;
    dispose(): Promise<void>;
  }
}
