/**
 * The file at the end: an mp4 if the browser can encode one, a directory of
 * PNGs if it cannot, and the narration as subtitles beside either.
 *
 * The frames come off the canvas the moment they are drawn, as `VideoFrame`s,
 * and go to a WebCodecs `VideoEncoder` whose chunks `mp4-muxer` writes into an
 * MP4. Nothing here touches the scene or the clock: the run hands this module
 * a frame number and it takes a picture. That division is what lets a film be
 * recorded at all, since the encoder runs behind the drawing and the run
 * waits for it rather than dropping what it cannot keep up with.
 *
 * The subtitles are not decoration. A film of the tour without its words is a
 * screensaver; with an `.srt` beside it every stand says what it is, in the
 * same sentences the drawer shows, and the times come from the shots
 * themselves so the two cannot drift apart.
 */
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import type { Sequence } from '../motion/types';

declare global {
  interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  }
}

export interface Resolution {
  id: string;
  label: string;
  width: number;
  height: number;
}

/** What the drawer offers. A 4k run costs seconds a frame, which for a film is fine. */
export const RESOLUTIONS: Resolution[] = [
  { id: '1080p', label: '1920 by 1080', width: 1920, height: 1080 },
  { id: '1440p', label: '2560 by 1440', width: 2560, height: 1440 },
  { id: '2160p', label: '3840 by 2160', width: 3840, height: 2160 },
];

/** Frames a second. Twenty-four is the film rate; thirty is the smoother one. */
export const RATES = [24, 30];

/**
 * How many bits a pixel the encoder is given. A look choice: the plateau is
 * stone and sand under a clean sky, which is cheap to encode, but a slow
 * camera move over a cased pyramid is exactly where a low rate shows as
 * banding on the faces.
 */
const BITS_PER_PIXEL = 0.12;

/** A keyframe every couple of seconds, so a reader can scrub the file. */
const KEYFRAME_SECONDS = 2;

/** How many frames the encoder may be behind before the run waits for it. */
const QUEUE_DEPTH = 6;

interface Candidate {
  /** The WebCodecs codec string. */
  codec: string;
  /** What `mp4-muxer` calls the same thing. */
  muxer: 'avc' | 'hevc' | 'vp9';
}

/**
 * The codecs to try, in order. H.264 High at level 5.1 carries 1440p and
 * below and plays everywhere; 4k needs level 5.2, and where a browser has
 * HEVC that is the better file at that size. VP9 in MP4 is the second choice
 * throughout, for a browser with no H.264 encoder at all.
 */
export function codecCandidates(width: number, height: number): Candidate[] {
  const uhd = width > 2560 || height > 1440;
  const first: Candidate[] = uhd
    ? [
        { codec: 'avc1.640034', muxer: 'avc' },
        { codec: 'hev1.1.6.L153.B0', muxer: 'hevc' },
      ]
    : [{ codec: 'avc1.640033', muxer: 'avc' }];
  return [...first, { codec: 'vp09.00.10.08', muxer: 'vp9' }];
}

/** The bit rate for a size and a rate. */
export function bitrateFor(width: number, height: number, fps: number): number {
  return Math.round(width * height * fps * BITS_PER_PIXEL);
}

/** A time in an `.srt`: hours, minutes, seconds, then a comma and milliseconds. */
export function srtClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const ms = Math.round((Math.max(0, seconds) - whole) * 1000);
  const pad = (n: number, width = 2): string => String(n).padStart(width, '0');
  return `${pad(Math.floor(whole / 3600))}:${pad(Math.floor(whole / 60) % 60)}:${pad(whole % 60)},${pad(ms, 3)}`;
}

/**
 * The narration as subtitles. One entry a shot that has words, running from
 * the second that shot starts to the second it ends, which are the shots' own
 * lengths added up and not a second typed anywhere.
 */
export function srtOf(sequence: Sequence): string {
  const lines: string[] = [];
  let at = 0;
  let index = 0;
  for (const shot of sequence.shots) {
    const start = at;
    at += shot.seconds;
    if (!shot.title && !shot.text) continue;
    index += 1;
    lines.push(String(index));
    lines.push(`${srtClock(start)} --> ${srtClock(at)}`);
    if (shot.title) lines.push(shot.title);
    if (shot.text) lines.push(shot.text);
    lines.push('');
  }
  return lines.join('\n');
}

/** The line that joins a directory of frames back into a film. */
export function ffmpegLine(fps: number, name: string): string {
  return `ffmpeg -framerate ${fps} -i frame-%06d.png -c:v libx264 -crf 16 -preset slow -pix_fmt yuv420p ${name}.mp4`;
}

/** Where a file ended up. */
export type Kept = 'saved' | 'downloaded' | 'cancelled';

export interface Saved {
  kind: 'mp4' | 'frames';
  kept: Kept;
  name: string;
  bytes: number;
}

export interface RecorderOptions {
  canvas: HTMLCanvasElement;
  sequence: Sequence;
  width: number;
  height: number;
  fps: number;
  /** The file's name, without an extension. */
  name: string;
}

export interface Recorder {
  kind: 'mp4' | 'frames';
  /** What the codec turned out to be, for the drawer to say. */
  how: string;
  /** Take the frame that has just been drawn. Awaited by the run. */
  onFrame: (frame: number, total: number) => Promise<void>;
  /** Close the file and put it somewhere. */
  finish: () => Promise<Saved>;
  /** Throw the run away. */
  abort: () => void;
}

/**
 * Wait until the encoder has caught up. On the task loop rather than the
 * animation loop, for the reason `run.ts` gives: a window behind another
 * window gets no animation frames, and a film should not stop for that.
 */
const drained = (encoder: VideoEncoder): Promise<void> =>
  new Promise<void>((resolve) => {
    const look = (): void => {
      if (encoder.encodeQueueSize <= QUEUE_DEPTH) resolve();
      else setTimeout(look, 4);
    };
    look();
  });

/**
 * Put a blob where the reader wants it. The File System Access API asks,
 * which is the good outcome; a browser without it, or one that will not open
 * the dialog outside a click, gets the download link instead. A reader who
 * cancels the dialog is not then surprised by a download.
 */
async function keep(blob: Blob, name: string, description: string, accept: Record<string, string[]>): Promise<Kept> {
  const picker = window.showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker.call(window, { suggestedName: name, types: [{ description, accept }] });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved';
    } catch (trouble) {
      if (trouble instanceof DOMException && trouble.name === 'AbortError') return 'cancelled';
      // Any other refusal, such as a dialog asked for outside a click, is the
      // download link's cue rather than the run's loss.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  // A turn of the loop is long enough for the download to have taken the
  // blob, and letting go keeps a 4k film out of memory afterwards.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return 'downloaded';
}

/** The head of the file, for the record: its bytes and the box it opens with. */
function firstBytes(buffer: ArrayBuffer): string {
  const head = new Uint8Array(buffer.slice(0, 12));
  const hex = Array.from(head, (b) => b.toString(16).padStart(2, '0')).join(' ');
  const text = Array.from(head, (b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
  return `${hex}  ${text}`;
}

/**
 * Open a recorder for a run. Called before the first frame and from the
 * reader's own click, because the directory picker the fallback uses may only
 * be opened from one.
 */
export async function startRecorder(options: RecorderOptions): Promise<Recorder> {
  const subtitles = srtOf(options.sequence);
  const chosen = await chooseCodec(options.width, options.height, options.fps);
  if (chosen) return mp4Recorder(options, chosen, subtitles);
  return framesRecorder(options, subtitles);
}

async function chooseCodec(width: number, height: number, fps: number): Promise<Candidate | null> {
  if (typeof VideoEncoder === 'undefined') return null;
  for (const candidate of codecCandidates(width, height)) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec: candidate.codec,
        width,
        height,
        bitrate: bitrateFor(width, height, fps),
        framerate: fps,
      });
      if (support.supported) return candidate;
    } catch {
      // A codec string the browser will not even parse is simply not it.
    }
  }
  return null;
}

function mp4Recorder(options: RecorderOptions, candidate: Candidate, subtitles: string): Recorder {
  const { canvas, width, height, fps, name } = options;
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: candidate.muxer, width, height, frameRate: fps },
    fastStart: 'in-memory',
  });
  let broke: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (trouble) => {
      broke = trouble;
    },
  });
  encoder.configure({
    codec: candidate.codec,
    width,
    height,
    bitrate: bitrateFor(width, height, fps),
    framerate: fps,
    latencyMode: 'quality',
  });
  const every = Math.max(1, Math.round(KEYFRAME_SECONDS * fps));

  return {
    kind: 'mp4',
    how: candidate.codec,
    onFrame: async (frame) => {
      if (broke) throw broke;
      // Cut before anything is awaited: the drawing buffer is not preserved,
      // so the picture is only there until the task that drew it ends.
      const picture = new VideoFrame(canvas, {
        timestamp: Math.round((frame * 1e6) / fps),
        duration: Math.round(1e6 / fps),
        alpha: 'discard',
      });
      try {
        encoder.encode(picture, { keyFrame: frame % every === 0 });
      } finally {
        picture.close();
      }
      if (encoder.encodeQueueSize > QUEUE_DEPTH) await drained(encoder);
    },
    finish: async () => {
      await encoder.flush();
      if (broke) throw broke;
      muxer.finalize();
      const buffer = muxer.target.buffer;
      const blob = new Blob([buffer], { type: 'video/mp4' });
      console.info(`[film] ${name}.mp4: ${blob.size} bytes, ${candidate.codec}, ${firstBytes(buffer)}`);
      const kept = await keep(blob, `${name}.mp4`, 'MPEG-4 video', { 'video/mp4': ['.mp4'] });
      if (subtitles) {
        await keep(new Blob([subtitles], { type: 'application/x-subrip' }), `${name}.srt`, 'SubRip subtitles', {
          'application/x-subrip': ['.srt'],
        });
      }
      return { kind: 'mp4', kept, name: `${name}.mp4`, bytes: blob.size };
    },
    abort: () => {
      if (encoder.state !== 'closed') encoder.close();
    },
  };
}

/**
 * No `VideoEncoder`: the frames go to a directory as PNGs, with the ffmpeg
 * line to join them and the subtitles beside them. Slower and far larger, and
 * the only path that does not need the browser to have an encoder at all.
 */
function framesRecorder(options: RecorderOptions, subtitles: string): Recorder {
  const { canvas, fps, name } = options;
  let directory: FileSystemDirectoryHandle | null = null;
  let bytes = 0;

  const open = async (): Promise<FileSystemDirectoryHandle> => {
    if (directory) return directory;
    const picker = window.showDirectoryPicker;
    if (!picker) throw new Error('This browser can neither encode video nor be given a directory to write frames into.');
    directory = await picker.call(window, { mode: 'readwrite' });
    return directory;
  };

  const write = async (into: FileSystemDirectoryHandle, file: string, blob: Blob): Promise<void> => {
    const handle = await into.getFileHandle(file, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    bytes += blob.size;
  };

  return {
    kind: 'frames',
    how: 'PNG frames',
    onFrame: async (frame) => {
      const into = await open();
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('The canvas gave no picture for this frame.');
      await write(into, `frame-${String(frame + 1).padStart(6, '0')}.png`, blob);
    },
    finish: async () => {
      const into = await open();
      await write(into, 'frames.txt', new Blob([`${ffmpegLine(fps, name)}\n`], { type: 'text/plain' }));
      if (subtitles) await write(into, `${name}.srt`, new Blob([subtitles], { type: 'application/x-subrip' }));
      return { kind: 'frames', kept: 'saved', name: `${name}/frame-000001.png`, bytes };
    },
    abort: () => {
      directory = null;
    },
  };
}
