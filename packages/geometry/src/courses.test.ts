import { describe, expect, it } from 'vitest';
import { courseHeights, courseLevels, frustumVolume, meshVolume, steppedPyramidLandmarks, steppedPyramidMesh } from './index';

/**
 * A pyramid whose numbers can be checked in the head: a hundred metres on a
 * side, a hundred metres tall, and two courses, one ten metres thick and one
 * twenty. The face line takes a tenth off the half-width every ten metres of
 * height, so the first course is full width and the second is nine tenths of
 * it. Nothing here is a measurement of anything.
 */
const TOY = { base: 100, height: 100, courses: [10, 20] };

describe('the stepped profile', () => {
  it('stacks eight vertices a course, the base ring first, and puts them where the face line is', () => {
    const mesh = steppedPyramidMesh(TOY);
    expect(mesh.vertexCount).toBe(16);
    const at = (i: number): number[] => [...mesh.positions.slice(i * 3, i * 3 + 3)];
    // The bottom course: full half-width, bedded at 0 and ten metres thick.
    expect(at(0)).toEqual([50, 50, 0]);
    expect(at(1)).toEqual([-50, 50, 0]);
    expect(at(2)).toEqual([-50, -50, 0]);
    expect(at(3)).toEqual([50, -50, 0]);
    expect(at(4)).toEqual([50, 50, 10]);
    expect(at(7)).toEqual([50, -50, 10]);
    // The second course, bedded on the first and stepped in to the face line there.
    expect(at(8)).toEqual([45, 45, 10]);
    expect(at(11)).toEqual([45, -45, 10]);
    expect(at(12)).toEqual([45, 45, 30]);
    expect(at(15)).toEqual([45, -45, 30]);
  });

  it('closes into one outward-wound solid of the slab volumes added up', () => {
    const mesh = steppedPyramidMesh(TOY);
    // Four walls a course, the ledge between them, and the two caps.
    expect(mesh.triangleCount).toBe(2 * 4 * 2 + 4 * 2 + 2 * 2);
    expect(meshVolume(mesh)).toBeCloseTo(100 * 100 * 10 + 90 * 90 * 20, 6);
  });

  it('refuses a pyramid with no courses, and one the courses stand taller than', () => {
    expect(() => steppedPyramidMesh({ ...TOY, courses: [] })).toThrow(/at least one course/);
    expect(() => steppedPyramidMesh({ ...TOY, courses: [60, 60, 60] })).toThrow(/the whole 100 m/);
  });
});

/**
 * The Great Pyramid on Goyon's 201 courses, which is what the viewer and
 * Blender draw. The heights are not repeated here: they are read out of a
 * small environment the way the model reads them, and the only numbers stated
 * are the ones any 201-course stack has to satisfy.
 */
const G1 = { base: 230.33, height: 146.59 };
const values: Record<string, number> = {};
for (let n = 1; n <= 201; n++) values[`g1.course.${n}.height`] = 0.5 + (n % 7) * 0.05;
const courses = courseHeights(values, 'g1');
const total = courses.reduce((sum, h) => sum + h, 0);

describe('a stepped pyramid of many courses', () => {
  it('reads the courses in course order, not in the order the keys arrived in', () => {
    const shuffled = { 'g1.course.3.height': 3, 'g1.course.1.height': 1, 'g1.course.10.height': 10, 'g1.course.2.height': 2 };
    expect(courseHeights(shuffled, 'g1')).toEqual([1, 2, 3, 10]);
    expect(courseHeights(shuffled, 'g2')).toEqual([]);
    expect(courses).toHaveLength(201);
  });

  it('stands exactly as tall as its courses add up to', () => {
    const mesh = steppedPyramidMesh({ ...G1, courses });
    const top = mesh.positions[mesh.positions.length - 1] as number;
    // The positions are float32, so a height of 130 m is good to a hundredth of a millimetre.
    expect(top).toBeCloseTo(total, 4);
    expect(courseLevels(courses)).toHaveLength(202);
    expect(courseLevels(courses)[201]).toBeCloseTo(total, 9);
  });

  it('holds more than the smooth frustum it is cut to and less than the prism on its base', () => {
    const volume = meshVolume(steppedPyramidMesh({ ...G1, courses }));
    // Every slab is as wide as the pyramid is at its bed and no narrower higher
    // up, so the steps stand outside the face and the solid contains the frustum.
    expect(volume).toBeGreaterThan(frustumVolume(G1.base, G1.height, total));
    expect(volume).toBeLessThan(G1.base * G1.base * total);
    // And not by much: the ledges are what the difference is, under a fiftieth.
    expect(volume / frustumVolume(G1.base, G1.height, total)).toBeLessThan(1.02);
  });
});

describe('the landmarks on a stepped pyramid', () => {
  const landmarks = steppedPyramidLandmarks({ courses, prefix: 'g1' });

  it('names the summit platform and the beds of the thick courses', () => {
    expect(Object.keys(landmarks)).toEqual([
      'g1.top.centre',
      'g1.course.1.level',
      'g1.course.35.level',
      'g1.course.44.level',
      'g1.course.67.level',
      'g1.course.201.level',
    ]);
    expect(landmarks['g1.top.centre']?.[2]).toBeCloseTo(total, 9);
    // A course's level is its bed, so the bottom course is bedded on the base.
    expect(landmarks['g1.course.1.level']).toEqual([0, 0, 0]);
    expect(landmarks['g1.course.35.level']?.[2]).toBeCloseTo(courses.slice(0, 34).reduce((a, b) => a + b, 0), 9);
  });

  it('names no course a short pyramid does not have, and nothing at all with no courses', () => {
    expect(Object.keys(steppedPyramidLandmarks({ courses: [1, 2, 3] }))).toEqual(['top.centre', 'course.1.level', 'course.3.level']);
    expect(steppedPyramidLandmarks({ courses: [] })).toEqual({});
  });
});
