/**
 * The casing as it was finished: polished Tura limestone, laid in the courses
 * the database carries, with joints Petrie measured in fiftieths of an inch.
 *
 * This is `wire_pristine_casing` in blender/render_materials.py carried into
 * the browser, and it is built the same way: the course tops are the only
 * numbers in it that are not look choices, and they are the database's own.
 * Blender packs them into a one-pixel-wide image a centimetre a pixel and
 * looks them up by height; a fragment shader cannot afford fourteen thousand
 * texels a pyramid, so here they go into a float texture one texel a course
 * and a fragment finds its course by binary search. Same numbers, same
 * joints, a different way of reaching them.
 *
 * Everything else is a look choice and says so: the near-white the limestone
 * is tinted to, how dark a joint is drawn, how long a block is along a course,
 * how far the tone wanders block to block, the polish, and the distance the
 * joints fade out over. Nothing here is a measurement and nothing here is
 * written down anywhere else.
 */
import {
  ClampToEdgeWrapping,
  DataTexture,
  FloatType,
  NearestFilter,
  RedFormat,
  type MeshPhysicalMaterial,
} from 'three';
import { after, patchMaterial } from './patch';

/**
 * Tura limestone as the render tints it: `pristine_material` multiplies the
 * photograph by the linear RGB (0.84, 0.79, 0.69), which is this in sRGB. The
 * material's colour is a tint over the photographed stone, exactly as there.
 */
export const CASING_COLOUR = '#ece6d9';

/**
 * Look choices, all of them, set against the panorama in
 * docs/progress/0026-blender-panorama-as-built.png.
 *
 * The joint is drawn two centimetres wide, which is Blender's `JOINT_WIDTH`
 * and is already far wider than the real thing; a fragment widens it to a
 * pixel where a pixel is wider still, or a line no pixel can hold would be no
 * line at all. Against that, the joints are faded out with distance: a course
 * is 0.7 m high and by a kilometre off every one of them would fall inside a
 * pixel and the face would go grey. `fade` is where they begin to go and where
 * they are gone, in metres.
 *
 * `built` is a dressed face; `ancient` is the polish the spec asks for, where
 * the sun glints off the faces and the sky shows in them at a grazing angle.
 * Blender's coat is 0.12 at 0.06 roughness, which is a still frame with a full
 * path trace behind it. The viewer's first try (roughness 0.12, a full coat)
 * turned the faces to blue steel: a coat attenuates the diffuse under it by
 * its own Fresnel, and the environment map is the sky alone with no warm
 * ground in it, so at a grazing angle the cream went and the sky stayed. Half
 * a coat keeps the limestone under the shine (director, 2026-09-17).
 *
 * The second retune pulls it further off the mirror still (director,
 * 2026-09-17, against a restored-pyramid reference under a high sun). A cased
 * face there is matte to satin white with the faintest cream, the lit and the
 * shaded faces separating by shade alone, and no sky in it: the polish reads
 * as a sun highlight and a soft lift near the arrises, not as a reflection.
 * So the coat comes down to a quarter and the roughness goes up, which widens
 * the sun's own highlight and narrows what the sky can do; and `Sky.tsx` now
 * puts a warm ground in the lower half of the environment, so what does get in
 * at a grazing angle is sand and not blue.
 */
const LOOK = {
  joint: 0.02,
  jointDarkening: 0.45,
  blockLength: 1.7,
  blockTone: 0.07,
  fade: [140, 340] as const,
  built: { roughness: 0.32, clearcoat: 0.18, clearcoatRoughness: 0.14 },
  ancient: { roughness: 0.26, clearcoat: 0.25, clearcoatRoughness: 0.07 },
} as const;

export interface CasingOptions {
  /**
   * The height above the base each course tops out at, bottom up, in metres.
   * The database's own, never a number chosen here; an empty list draws a face
   * with no joints on it rather than a face with invented ones.
   */
  courses: number[];
  /** The First Time's polish, against the dressed casing of the as-built state. */
  pristine: boolean;
}

/**
 * One float texture per course list, made once and kept. A list is a couple of
 * hundred floats and the three pyramids share two or three of them, so there
 * is nothing here worth disposing and a great deal worth not rebuilding on
 * every store change.
 */
const TEXTURES = new Map<string, DataTexture>();

function courseTexture(levels: number[]): DataTexture {
  const key = levels.join(' ');
  let texture = TEXTURES.get(key);
  if (!texture) {
    texture = new DataTexture(Float32Array.from(levels), 1, levels.length, RedFormat, FloatType);
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    TEXTURES.set(key, texture);
  }
  return texture;
}

/**
 * Dress a material as finished casing: the polish on the material itself, the
 * joints and the block tone in its shader. Composes with the triplanar stone
 * and with the air through `patchMaterial`, which owns the one
 * `onBeforeCompile` a material has.
 */
export function applyCasing(material: MeshPhysicalMaterial, { courses, pristine }: CasingOptions): void {
  const polish = pristine ? LOOK.ancient : LOOK.built;
  material.roughness = polish.roughness;
  material.clearcoat = polish.clearcoat;
  material.clearcoatRoughness = polish.clearcoatRoughness;
  material.metalness = 0;

  const jointed = courses.length > 0;
  patchMaterial(material, 'casing', jointed ? 'jointed' : 'plain', (shader) => {
    if (!jointed) return;
    shader.uniforms.casingCourses = { value: courseTexture(courses) };
    shader.uniforms.casingCourseCount = { value: courses.length };
    shader.uniforms.casingJointWidth = { value: LOOK.joint };
    shader.uniforms.casingJointDark = { value: LOOK.jointDarkening };
    shader.uniforms.casingBlockLength = { value: LOOK.blockLength };
    shader.uniforms.casingBlockTone = { value: LOOK.blockTone };
    shader.uniforms.casingFade = { value: [LOOK.fade[0], LOOK.fade[1]] };

    shader.vertexShader = after(shader.vertexShader, 'common', CASING_VARYINGS);
    shader.vertexShader = after(
      shader.vertexShader,
      'begin_vertex',
      '  vCasingObject = transformed;\n  vCasingWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    );
    shader.fragmentShader = after(shader.fragmentShader, 'common', `${CASING_VARYINGS}\n${CASING_CHUNK}`);
    shader.fragmentShader = after(shader.fragmentShader, 'map_fragment', '  diffuseColor.rgb = sekedCasing(diffuseColor.rgb);');
  });
}

/**
 * The object frame, which for a pyramid is the base centre with +Z up its
 * axis, so a fragment's own height above the base is one component of it and
 * needs no arithmetic. The world position comes along for the distance fade.
 */
const CASING_VARYINGS = `
varying vec3 vCasingObject;
varying vec3 vCasingWorld;
`;

/**
 * The joints and the block tone, in GLSL.
 *
 * `sekedCasingCourse` is the binary search: twelve steps covers four thousand
 * courses, which is five times what the Great Pyramid has. It comes back with
 * the index of the first course whose top is at or above the fragment, so its
 * own top and the one below it are the two joints a fragment can be near, and
 * it doubles as the cell a block's tone and its stagger are hashed on, the way
 * the render hashes the course index out of the blue channel of its image.
 */
const CASING_CHUNK = `
uniform sampler2D casingCourses;
uniform float casingCourseCount;
uniform float casingJointWidth;
uniform float casingJointDark;
uniform float casingBlockLength;
uniform float casingBlockTone;
uniform vec2 casingFade;

float sekedCasingLevel(float i) {
  return texture2D(casingCourses, vec2(0.5, (i + 0.5) / casingCourseCount)).r;
}

float sekedCasingCourse(float h) {
  float lo = 0.0;
  float hi = casingCourseCount - 1.0;
  for (int k = 0; k < 12; k++) {
    if (lo >= hi) break;
    float mid = floor((lo + hi) * 0.5);
    if (sekedCasingLevel(mid) < h) lo = mid + 1.0; else hi = mid;
  }
  return lo;
}

float sekedCasingHash(vec3 cell) {
  return fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

vec3 sekedCasing(vec3 colour) {
  float h = vCasingObject.z;
  float fade = 1.0 - smoothstep(casingFade.x, casingFade.y, length(vCasingWorld - cameraPosition));
  float course = sekedCasingCourse(h);
  float top = sekedCasingLevel(course);
  float bed = course > 0.5 ? sekedCasingLevel(course - 1.0) : 0.0;
  float half_ = casingJointWidth * 0.5;
  float horizontal = 1.0 - smoothstep(0.0, max(half_, fwidth(h)), min(abs(h - top), abs(h - bed)));
  // Along the course: x on the north and south faces, y on the east and west,
  // which is how wire_pristine_casing picks the axis, off the face's normal.
  vec3 face = normalize(cross(dFdx(vCasingObject), dFdy(vCasingObject)));
  float northSouth = step(abs(face.x), abs(face.y));
  float along = mix(vCasingObject.y, vCasingObject.x, northSouth);
  float t = (along + sekedCasingHash(vec3(course, 1.0, 1.0)) * 17.3) / casingBlockLength;
  float edge = min(fract(t), 1.0 - fract(t)) * casingBlockLength;
  float vertical = 1.0 - smoothstep(0.0, max(half_, fwidth(along)), edge);
  float joint = max(horizontal, vertical) * fade;
  float tone = sekedCasingHash(vec3(floor(t), course, northSouth));
  return colour * (1.0 - casingBlockTone * tone) * (1.0 - casingJointDark * joint);
}
`;
