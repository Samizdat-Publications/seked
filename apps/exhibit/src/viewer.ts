/**
 * The panorama on the GPU: a full-screen triangle whose fragment shader casts a ray per pixel and samples the
 * equirectangular panorama (and a detail patch over it where the view is close enough). Two layers, a and b,
 * so a change of era can show both; `mix` is how much of b shows.
 *
 * The sums are projection.ts's, written again in GLSL; projection.test.ts pins the TypeScript side.
 */
import { lodFor, type Patch, type View } from './projection';

const VS = '#version 300 es\nin vec2 p; out vec2 v; void main() { v = p; gl_Position = vec4(p, 0.0, 1.0); }';
const FS = `#version 300 es
precision highp float;
uniform sampler2D ta, tb, pa, pb;
uniform vec3 has;          // panorama a is loaded, panorama b is loaded, how much of b shows
uniform vec2 lods;
uniform vec4 qa, qb;       // each layer's detail patch: yaw, pitch, tan(half its vertical field), aspect
uniform vec2 pon, plods;   // how far each patch is faded in, and its mip level
uniform float yaw, pitch, tanh, aspect;
in vec2 v; out vec4 o;
const float PI = 3.141592653589793;
// what stands for a panorama still loading: a dark sky, a dark ground and a faint horizon
vec3 blank(float el) {
  vec3 sky = mix(vec3(0.085, 0.09, 0.105), vec3(0.035, 0.04, 0.055), clamp(el * 1.6, 0.0, 1.0));
  vec3 ground = mix(vec3(0.095, 0.083, 0.068), vec3(0.05, 0.045, 0.04), clamp(-el * 1.6, 0.0, 1.0));
  return (el >= 0.0 ? sky : ground) + vec3(0.075, 0.066, 0.052) * exp(-abs(el) * 90.0);
}
vec3 patched(sampler2D t, vec4 q, float lod, float on, vec3 w, vec3 c) {
  if (on <= 0.0) return c;
  float cy = cos(q.x), sy = sin(q.x), cp = cos(q.y), sp = sin(q.y);
  vec3 a = vec3(w.x * cy - w.y * sy, w.z, w.x * sy + w.y * cy);
  vec3 r = vec3(a.x, cp * a.y - sp * a.z, sp * a.y + cp * a.z);
  if (r.z <= 0.0) return c;
  vec2 p = vec2(r.x / (r.z * q.z * q.w), r.y / (r.z * q.z));
  vec2 e = 1.0 - smoothstep(0.86, 1.0, abs(p));
  float m = on * e.x * e.y;
  if (m <= 0.0) return c;
  return mix(c, textureLod(t, vec2(0.5 + 0.5 * p.x, 0.5 - 0.5 * p.y), lod).rgb, m);
}
void main() {
  vec3 r = normalize(vec3(v.x * tanh * aspect, v.y * tanh, 1.0));
  float cp = cos(pitch), sp = sin(pitch);
  r = vec3(r.x, r.y * cp + r.z * sp, -r.y * sp + r.z * cp);
  float cy = cos(yaw), sy = sin(yaw);
  vec3 w = vec3(r.x * cy + r.z * sy, -r.x * sy + r.z * cy, r.y);
  float az = atan(w.x, w.y);
  float el = asin(clamp(w.z, -1.0, 1.0));
  vec2 uv = vec2(0.5 + az / (2.0 * PI), 0.5 - el / PI);
  vec3 bl = blank(el);
  vec3 a = has.x > 0.0 ? patched(pa, qa, plods.x, pon.x, w, textureLod(ta, uv, lods.x).rgb) : bl;
  vec3 c = a;
  if (has.z > 0.0) {
    vec3 b = has.y > 0.0 ? patched(pb, qb, plods.y, pon.y, w, textureLod(tb, uv, lods.y).rgb) : bl;
    c = mix(a, b, has.z);
  }
  o = vec4(c, 1.0);
}`;

/** A picture on the GPU, with the size it was uploaded at. */
export interface Texture { tex: WebGLTexture; width: number; height: number }

/** What one layer shows: a panorama, and the detail patch for it with how far that has faded in. */
export interface Layer { pano: Texture | null; patch: { tex: Texture; q: Patch; on: number } | null }

export class PanoramaViewer {
  readonly gl: WebGL2RenderingContext;
  readonly maxTexture: number;
  private prog: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private dummy: WebGLTexture;
  private aniso: EXT_texture_filter_anisotropic | null;
  private u: Record<string, WebGLUniformLocation | null> = {};

  /** Throws when WebGL2 or the shader is unavailable; the caller shows the flat picture instead. */
  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'the shader did not compile');
      return s;
    };
    this.prog = gl.createProgram()!;
    gl.attachShader(this.prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(this.prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(this.prog);
    if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.prog) || 'the program did not link');
    gl.useProgram(this.prog);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['ta', 'tb', 'pa', 'pb', 'has', 'lods', 'qa', 'qb', 'pon', 'plods', 'yaw', 'pitch', 'tanh', 'aspect']) this.u[n] = gl.getUniformLocation(this.prog, n);
    gl.uniform1i(this.u.ta!, 0);
    gl.uniform1i(this.u.tb!, 1);
    gl.uniform1i(this.u.pa!, 2);
    gl.uniform1i(this.u.pb!, 3);
    // a 1 x 1 texture for a unit with nothing in it, so the samplers are always complete
    this.dummy = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.dummy);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([15, 14, 12, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    this.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
  }

  /** Put a decoded picture on the GPU, mipmapped; the panorama wraps across its left and right edges. */
  upload(img: TexImageSource & { width: number; height: number }, wrap: boolean): Texture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return { tex, width: img.width, height: img.height };
  }

  release(t: Texture): void { this.gl.deleteTexture(t.tex); }

  /** Draw the view: layer a, and layer b over it by `mix` (0 shows a alone). */
  draw(view: View, fov: number, a: Layer, b: Layer | null, mix: number): void {
    const gl = this.gl, c = this.canvas, u = this.u;
    gl.viewport(0, 0, c.width, c.height);
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    const layers: [Layer | null, number, number, WebGLUniformLocation | null][] = [[a, 0, 2, u.qa!], [b, 1, 3, u.qb!]];
    const lods = [0, 0], pon = [0, 0], plods = [0, 0];
    layers.forEach(([L, unit, punit, uq], k) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, L?.pano ? L.pano.tex : this.dummy);
      if (L?.pano) lods[k] = lodFor(L.pano.width, c.height, fov);
      gl.activeTexture(gl.TEXTURE0 + punit);
      const p = L?.patch;
      gl.bindTexture(gl.TEXTURE_2D, p ? p.tex.tex : this.dummy);
      if (!p) { gl.uniform4f(uq, 0, 0, 1, 1); return; }
      const tq = Math.tan(p.q.fov / 2);
      gl.uniform4f(uq, p.q.yaw, p.q.pitch, tq, p.q.aspect);
      pon[k] = p.on;
      plods[k] = Math.max(0, Math.log2(Math.max(p.tex.height * Math.tan(fov / 2) / (tq * c.height), 1e-3)));
    });
    gl.uniform3f(u.has!, a.pano ? 1 : 0, b?.pano ? 1 : 0, b ? mix : 0);
    gl.uniform2f(u.lods!, lods[0]!, lods[1]!);
    gl.uniform2f(u.pon!, pon[0]!, pon[1]!);
    gl.uniform2f(u.plods!, plods[0]!, plods[1]!);
    gl.uniform1f(u.yaw!, view.yaw);
    gl.uniform1f(u.pitch!, view.pitch);
    gl.uniform1f(u.tanh!, Math.tan(fov / 2));
    gl.uniform1f(u.aspect!, c.width / c.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
