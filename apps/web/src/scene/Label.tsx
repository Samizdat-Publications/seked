/**
 * Text and markers in the scene, drawn on a canvas and hung on a sprite.
 *
 * A label in the scene is the same object as the tag beside the pointer, and
 * it is built to look like one: `ui/HoverTag.tsx`'s glass, its hairline, its
 * rounded corner and its ink, with the overlay's own colour as a rule down
 * the left edge and as a leader running back to the point the label names.
 * That leader is the whole reason for the plate. A ray drawn across twenty
 * kilometres and a diagonal drawn across five metres used to push their text
 * away by a number of metres chosen by hand, which meant the same label sat
 * on top of the thing in one overlay and out of the frame in another. Here
 * the offset and the leader are in pixels on the screen, so every label in
 * every overlay stands the same distance from what it names.
 *
 * A label has to work with no network, so it is drawn with whatever face the
 * browser has: `Inter` when the stylesheet's fonts have arrived and the
 * system sans until then, which is why the texture is rebuilt once
 * `document.fonts` reports ready. That rules out an SDF text library and
 * makes a canvas texture the simple answer: one texture per string, disposed
 * with the component.
 *
 * Figures are drawn on a fixed pitch. Canvas 2D has no
 * `font-variant-numeric`, and an overlay's numbers change with the sky every
 * frame the reader drags the clock, so proportional digits would make the
 * whole line breathe. Setting every digit on the widest digit's advance is
 * what tabular numerals are, and it is a dozen lines here.
 *
 * **A label is in a film, and that is why it is a sprite.** A film is cut
 * from the canvas's own drawing buffer, so anything drawn as HTML over the
 * canvas, the way `ui/HoverTag.tsx` is, is simply not in the file. A label
 * here is a canvas texture on a sprite inside the scene, so it goes through
 * the post chain and into every recorded frame with everything else, and the
 * stepped clock has nothing to do for it. Checked by recording the tour's
 * fourth and fifth shots at 1280 by 720 and reading the frames: A4's three
 * diagonals and C2's four shafts come out named, at the size the screen
 * gives them, with their leaders. Nothing is drawn twice for a film.
 *
 * That check is also why the offsets are pixels. A sprite's size here is a
 * fixed number of CSS pixels of `state.size`, which the film's own sizing in
 * `film/size.ts` sets to the stage's box; at 720p in a 1600 by 900 window
 * that comes out near one for one, so a label reads in the file as it reads
 * on the screen. Were the offsets metres, as they were, a label would sit
 * where the last camera that framed it happened to want it, which is how
 * C2's four labels came to be five hundred metres up their rays and out of
 * the top of the frame.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CanvasTexture, LinearFilter, PerspectiveCamera, SRGBColorSpace, Sprite, Vector3, type Texture } from 'three';

/**
 * The plate's own measurements, in CSS pixels on the screen, taken from
 * `.hover-tag` in `styles.css`: its padding, its 0.6rem corner, its hairline
 * and its two type sizes. The one addition is the rule down the left edge,
 * which carries the colour the tag gets from its tier word.
 */
const PLATE = {
  text: 11.5,
  tag: 8,
  padX: 6,
  padY: 4,
  gap: 5,
  radius: 5,
  rule: 2.5,
  dot: 2.6,
  /** Room around the whole drawing, so the stroke and the dot are not clipped. */
  margin: 4,
};

/** Drawn this many times over and scaled back down, so the type is crisp at any distance. */
const SUPERSAMPLE = 3;

/** The glass, the hairline and the ink, which are `--glass-raised`, `--hairline` and `--ink`. */
const GLASS = 'rgba(18, 21, 26, 0.86)';
const HAIRLINE = 'rgba(236, 230, 216, 0.16)';
const INK = '#ece6d8';

const SANS = "'Inter', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * The stylesheet's faces arrive over the network, and a texture drawn before
 * they land is drawn in the fallback and stays that way. One promise for the
 * whole app, and every label rebuilds its texture once.
 */
let fontsAreReady = false;
const waitingForFonts = new Set<() => void>();
if (typeof document !== 'undefined' && document.fonts) {
  void document.fonts.ready.then(() => {
    fontsAreReady = true;
    for (const wake of waitingForFonts) wake();
    waitingForFonts.clear();
  });
}

function useFontsReady(): boolean {
  const [ready, setReady] = useState(fontsAreReady);
  useEffect(() => {
    if (ready) return;
    const wake = (): void => setReady(true);
    waitingForFonts.add(wake);
    return () => {
      waitingForFonts.delete(wake);
    };
  }, [ready]);
  return ready;
}

const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9';

/** The widest digit's advance, which every digit is then set on. */
function digitPitch(ctx: CanvasRenderingContext2D): number {
  let pitch = 0;
  for (const d of '0123456789') pitch = Math.max(pitch, ctx.measureText(d).width);
  return pitch;
}

function tabularWidth(ctx: CanvasRenderingContext2D, text: string, pitch: number): number {
  let width = 0;
  for (const ch of text) width += isDigit(ch) ? pitch : ctx.measureText(ch).width;
  return width;
}

/** Left-aligned text with the figures on a fixed pitch, each centred in its cell. */
function fillTabular(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, pitch: number): number {
  let at = x;
  for (const ch of text) {
    const own = ctx.measureText(ch).width;
    if (isDigit(ch)) {
      ctx.fillText(ch, at + (pitch - own) / 2, y);
      at += pitch;
    } else {
      ctx.fillText(ch, at, y);
      at += own;
    }
  }
  return at - x;
}

/**
 * `letterSpacing` is Chromium's, which is what the viewer runs in, and it is
 * not in every DOM typing; a browser without it simply sets the tag tight.
 */
function spaceLetters(ctx: CanvasRenderingContext2D, px: number): void {
  (ctx as unknown as { letterSpacing?: string }).letterSpacing = `${px}px`;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

interface Plate {
  texture: Texture;
  /** The sprite's size on screen, in CSS pixels. */
  widthPx: number;
  heightPx: number;
  /**
   * Where in the sprite the point it names falls, as `Sprite.center` wants
   * it: 0 to 1 from the bottom left. Putting the anchor here rather than
   * moving the sprite is what keeps the offset a screen offset at any
   * distance and under any camera.
   */
  centre: [number, number];
}

/**
 * The plate, its leader and the dot at the end of it, all in one canvas, laid
 * out about the point the label names. The point sits at the origin; the
 * plate's centre sits at `offset` pixels from it; the canvas is whatever box
 * holds both.
 */
function drawPlate(text: string, tag: string | undefined, colour: string, offset: readonly [number, number]): Plate {
  const s = SUPERSAMPLE;
  const canvas = document.createElement('canvas');
  const measure = canvas.getContext('2d') as CanvasRenderingContext2D;

  const textFont = `500 ${PLATE.text * s}px ${SANS}`;
  const tagFont = `600 ${PLATE.tag * s}px ${SANS}`;
  measure.font = textFont;
  const pitch = digitPitch(measure);
  const textWidth = tabularWidth(measure, text, pitch);
  // The `proposed` word is set the way `.hover-tier` sets a tier: small,
  // upper case, wide, and in the line's own colour rather than the ink.
  const tagLetter = PLATE.tag * s * 0.16;
  let tagWidth = 0;
  if (tag !== undefined) {
    measure.font = tagFont;
    spaceLetters(measure, tagLetter);
    tagWidth = measure.measureText(tag.toUpperCase()).width + PLATE.gap * s;
    spaceLetters(measure, 0);
  }

  const plateW = PLATE.rule * s + PLATE.padX * s * 2 + tagWidth + textWidth;
  const plateH = PLATE.text * s + PLATE.padY * s * 2;
  const [dx, dy] = [offset[0] * s, offset[1] * s];
  const m = PLATE.margin * s;

  // The box that holds the anchor at the origin and the plate at the offset,
  // in a frame with y upwards; the canvas is then drawn with y downwards.
  const left = Math.min(0, dx - plateW / 2) - m;
  const right = Math.max(0, dx + plateW / 2) + m;
  const bottom = Math.min(0, dy - plateH / 2) - m;
  const top = Math.max(0, dy + plateH / 2) + m;
  const width = Math.ceil(right - left);
  const height = Math.ceil(top - bottom);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const cx = (x: number): number => x - left;
  const cy = (y: number): number => top - y;

  // The leader, from the point to the middle of the plate. The plate is
  // drawn over it, so what shows is the run between the two.
  ctx.strokeStyle = colour;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = Math.max(1, s * 0.9);
  ctx.beginPath();
  ctx.moveTo(cx(0), cy(0));
  ctx.lineTo(cx(dx), cy(dy));
  ctx.stroke();

  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(cx(0), cy(0), PLATE.dot * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const px = cx(dx - plateW / 2);
  const py = cy(dy + plateH / 2);
  roundedRect(ctx, px, py, plateW, plateH, PLATE.radius * s);
  ctx.fillStyle = GLASS;
  ctx.fill();
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = Math.max(1, s);
  ctx.stroke();

  // The rule down the left edge, which is where the line's colour lives once
  // the words are ink. It is clipped to the plate so it keeps the corner.
  ctx.save();
  roundedRect(ctx, px, py, plateW, plateH, PLATE.radius * s);
  ctx.clip();
  ctx.fillStyle = colour;
  ctx.fillRect(px, py, PLATE.rule * s, plateH);
  ctx.restore();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  let at = px + PLATE.rule * s + PLATE.padX * s;
  const middle = py + plateH / 2;
  if (tag !== undefined) {
    ctx.font = tagFont;
    spaceLetters(ctx, tagLetter);
    ctx.fillStyle = colour;
    ctx.fillText(tag.toUpperCase(), at, middle);
    spaceLetters(ctx, 0);
    at += tagWidth;
  }
  ctx.font = textFont;
  ctx.fillStyle = INK;
  fillTabular(ctx, text, at, middle, pitch);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return {
    texture,
    widthPx: width / s,
    heightPx: height / s,
    centre: [-left / width, -bottom / height],
  };
}

export interface LabelProps {
  text: string;
  /** The point the label names, in the data frame. `position` is the older name for it. */
  at?: [number, number, number];
  position?: [number, number, number];
  /** Where the plate sits from that point, in CSS pixels: east and up on the screen. */
  offset?: [number, number];
  /** A short word before the text, set the way the hover tag sets an evidence tier. */
  tag?: string;
  colour?: string;
  opacity?: number;
}

/**
 * Keep a sprite the same size on screen: each frame, scale it to the world
 * size that its own pixel size covers at its distance from the camera. A
 * label in a chamber and one on the dome then read the same.
 */
/** One scratch vector for every label: `useFrame` runs them one after another. */
const SCRATCH = new Vector3();

function useScreenSize(ref: React.RefObject<Sprite | null>, widthPx: number, heightPx: number): void {
  const viewport = useThree((state) => state.size);
  useFrame(({ camera }) => {
    const sprite = ref.current;
    if (!sprite) return;
    const world = sprite.getWorldPosition(SCRATCH);
    const distance = world.distanceTo(camera.position);
    const fov = camera instanceof PerspectiveCamera ? camera.fov : 50;
    const worldPerPixel = (2 * distance * Math.tan((fov * Math.PI) / 360)) / viewport.height;
    sprite.scale.set(widthPx * worldPerPixel, heightPx * worldPerPixel, 1);
  });
}

/** One line of glass, facing the camera, with a leader back to the point it names. */
export function Label({
  text,
  at,
  position,
  offset = [0, 26],
  tag,
  colour = INK,
  opacity = 1,
}: LabelProps): React.JSX.Element {
  const ready = useFontsReady();
  const plate = useMemo(
    () => drawPlate(text, tag, colour, offset),
    // The offset is a pair and would be a new array on every render; its two
    // numbers are what the drawing depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, tag, colour, offset[0], offset[1], ready],
  );
  useEffect(() => () => plate.texture.dispose(), [plate]);
  const ref = useRef<Sprite>(null);
  useScreenSize(ref, plate.widthPx, plate.heightPx);
  const point = at ?? position ?? [0, 0, 0];
  return (
    <sprite ref={ref} position={point} center={plate.centre} renderOrder={20}>
      <spriteMaterial
        map={plate.texture}
        transparent
        opacity={opacity}
        depthTest={false}
        depthWrite={false}
        fog={false}
        toneMapped={false}
      />
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
  px = 22,
  colour = INK,
}: {
  position: [number, number, number];
  /** Diameter on screen, in CSS pixels. */
  px?: number;
  colour?: string;
}): React.JSX.Element {
  const texture = useMemo(() => ringTexture(colour), [colour]);
  useEffect(() => () => texture.dispose(), [texture]);
  const ref = useRef<Sprite>(null);
  useScreenSize(ref, px, px);
  return (
    <sprite ref={ref} position={position} renderOrder={19}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} fog={false} toneMapped={false} />
    </sprite>
  );
}
