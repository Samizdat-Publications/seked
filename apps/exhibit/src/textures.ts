/**
 * Panoramas and patches, fetched, decoded and put on the GPU on demand, and let go again oldest-used first.
 * A 4096 by 2048 panorama with its mipmaps is about 45 MB of GPU memory, so only a few are kept.
 */
import type { PanoramaViewer, Texture } from './viewer';

export type Status = 'loading' | 'ready' | 'missing' | 'error';

interface Entry { url: string; status: Status; tex: Texture | null; used: number; readyAt: number; wrap: boolean }

export class TextureCache {
  private entries = new Map<string, Entry>();
  private clock = 0;

  constructor(private viewer: PanoramaViewer, private onChange: () => void, private keep = 6) {}

  /** The texture for a url once it is on the GPU; asking starts the fetch. */
  get(url: string, wrap = true): Texture | null {
    let e = this.entries.get(url);
    if (!e) {
      e = { url, status: 'loading', tex: null, used: 0, readyAt: 0, wrap };
      this.entries.set(url, e);
      void this.load(e);
    }
    e.used = ++this.clock;
    return e.tex;
  }

  status(url: string): Status | null { return this.entries.get(url)?.status ?? null; }

  /** 0 to 1 over `ms` from when the texture arrived, so a picture eases in rather than snapping. */
  presence(url: string, now: number, ms: number): number {
    const e = this.entries.get(url);
    if (!e?.tex) return 0;
    return ms <= 0 ? 1 : Math.min(1, Math.max(0, (now - e.readyAt) / ms));
  }

  /** Start fetching a url without showing it, so the next leaf does not wait. */
  prefetch(url: string, wrap = true): void { if (!this.entries.has(url)) this.get(url, wrap); }

  /** After a lost GPU context: everything is fetched again when next asked for. */
  forgetAll(): void { this.entries.clear(); }

  private async load(e: Entry): Promise<void> {
    try {
      const r = await fetch(e.url);
      if (!r.ok) { e.status = r.status === 404 ? 'missing' : 'error'; this.onChange(); return; }
      // a server that answers a missing file with its index page (a single-page fallback) has not got the picture
      if (!(r.headers.get('content-type') ?? 'image/').startsWith('image/')) { e.status = 'missing'; this.onChange(); return; }
      const blob = await r.blob();
      const img = await decode(blob, this.viewer.maxTexture);
      if (this.entries.get(e.url) !== e) { img.close(); return; }
      e.tex = this.viewer.upload(img, e.wrap);
      img.close();
      e.status = 'ready';
      e.readyAt = performance.now();
      this.evict();
    } catch (err) {
      console.warn(`${e.url} did not load`, err);
      e.status = 'error';
    }
    this.onChange();
  }

  private evict(): void {
    const ready = [...this.entries.values()].filter((e) => e.tex).sort((a, b) => a.used - b.used);
    while (ready.length > this.keep) {
      const e = ready.shift()!;
      this.viewer.release(e.tex!);
      this.entries.delete(e.url);
    }
  }
}

/** Decode a picture, scaled down to what the GPU takes when it is larger. */
async function decode(blob: Blob, max: number): Promise<ImageBitmap> {
  const img = await createImageBitmap(blob);
  if (img.width <= max && img.height <= max) return img;
  const k = max / Math.max(img.width, img.height);
  const out = await createImageBitmap(img, { resizeWidth: Math.floor(img.width * k), resizeHeight: Math.floor(img.height * k), resizeQuality: 'high' });
  img.close();
  return out;
}
