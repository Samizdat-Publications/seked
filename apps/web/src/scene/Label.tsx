/**
 * Text and markers in the scene, as sprites drawn on a canvas.
 *
 * A label has to be legible from anywhere, so it faces the camera, and it has
 * to work with no network, so it is drawn with the browser's own fonts rather
 * than fetched as a typeface. That rules out an SDF text library and makes a
 * canvas texture the simple answer: one texture per string, disposed with the
 * component.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CanvasTexture, LinearFilter, PerspectiveCamera, SRGBColorSpace, Sprite, type Texture, Vector3 } from 'three';

/** Pixels per line of drawn text on the canvas. The sprite is then scaled to a constant screen size. */
const FONT_PX = 64;
const PAD_PX = 18;

const FONT = `500 ${FONT_PX}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

function textTexture(text: string, colour: string): { texture: Texture; aspect: number } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.font = FONT;
  const width = Math.ceil(ctx.measureText(text).width) + PAD_PX * 2;
  const height = FONT_PX + PAD_PX * 2;
  canvas.width = width;
  canvas.height = height;
  const draw = canvas.getContext('2d') as CanvasRenderingContext2D;
  draw.font = FONT;
  draw.textBaseline = 'middle';
  draw.textAlign = 'center';
  // A dark rim under the glyphs, so a label stays readable over a bright
  // face of casing stone as well as over the night sky.
  draw.lineWidth = 8;
  draw.strokeStyle = 'rgba(4, 8, 14, 0.85)';
  draw.strokeText(text, width / 2, height / 2);
  draw.fillStyle = colour;
  draw.fillText(text, width / 2, height / 2);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return { texture, aspect: width / height };
}

export interface LabelProps {
  text: string;
  position: [number, number, number];
  /** Height of the text on screen, in CSS pixels, whatever the distance. */
  px?: number;
  colour?: string;
  opacity?: number;
}

/**
 * Keep a sprite the same size on screen: each frame, scale it to the world
 * height that `px` pixels cover at its distance from the camera. A label that
 * sits on the dome and one that sits in a chamber then read the same.
 */
function useScreenSize(ref: React.RefObject<Sprite | null>, px: number, aspect: number): void {
  const viewport = useThree((state) => state.size);
  const world = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    const sprite = ref.current;
    if (!sprite) return;
    sprite.getWorldPosition(world);
    const distance = world.distanceTo(camera.position);
    const fov = camera instanceof PerspectiveCamera ? camera.fov : 50;
    const worldPerPixel = (2 * distance * Math.tan((fov * Math.PI) / 360)) / viewport.height;
    const height = px * worldPerPixel;
    sprite.scale.set(height * aspect, height, 1);
  });
}

/** One line of text, facing the camera, drawn over whatever is behind it. */
export function Label({ text, position, px = 14, colour = '#e8eef6', opacity = 1 }: LabelProps): React.JSX.Element {
  const { texture, aspect } = useMemo(() => textTexture(text, colour), [text, colour]);
  useEffect(() => () => texture.dispose(), [texture]);
  const ref = useRef<Sprite>(null);
  useScreenSize(ref, px, aspect);
  return (
    <sprite ref={ref} position={position} renderOrder={20}>
      <spriteMaterial map={texture} transparent opacity={opacity} depthTest={false} depthWrite={false} fog={false} toneMapped={false} />
    </sprite>
  );
}

function ringTexture(colour: string): Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
  ctx.stroke();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

/** A ring around something the overlay is pointing at, such as a claim's target star. */
export function Marker({
  position,
  px = 24,
  colour = '#ffcf70',
}: {
  position: [number, number, number];
  /** Diameter on screen, in CSS pixels. */
  px?: number;
  colour?: string;
}): React.JSX.Element {
  const texture = useMemo(() => ringTexture(colour), [colour]);
  useEffect(() => () => texture.dispose(), [texture]);
  const ref = useRef<Sprite>(null);
  useScreenSize(ref, px, 1);
  return (
    <sprite ref={ref} position={position} renderOrder={19}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} fog={false} toneMapped={false} />
    </sprite>
  );
}
