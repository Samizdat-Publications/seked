import { describe, expect, it } from 'vitest';
import { HEAD_HOME, HEAD_INSET, HEAD_INSET_BELOW, type HeadsManifest, factorLine, headClip } from './objectview';

const m = (least: number | null): HeadsManifest => ({ centre: [0, 0, 0], objects: [], head_scale: { used: 1.17, least }, standin: 'Stand-ins.' });

describe("the object view's account of H1", () => {
  it('gives the least enlargement the fit found, labelled a proposal, with the renders own beside it', () => {
    const s = factorLine(m(1.1625));
    expect(s).toContain('1.16 times');
    expect(s).toContain('a proposal');
    expect(s).toContain('1.17');
  });
  it('says only the look choice when the fit was not run for the export', () => {
    const s = factorLine(m(null));
    expect(s).toContain('look choice');
    expect(s).not.toContain('proposal');
  });
});

describe("the head's clean cut", () => {
  // the export's own manifest (render/export_heads.py): centre and crop box in project metres
  const heads: HeadsManifest = { ...m(null), centre: [337.585, -432.9, -23.1],
    crop: { box: { x0: 324.74, x1: 346.43, y0: -444.61, y1: -421.5, z0: -30.6, z1: -8.6 } } };
  it('is the crop box in the glTF frame, each face moved in, the chin further', () => {
    const c = headClip(heads)!;
    // east stays +x, up is +y, north is -z
    expect(c.min[0]).toBeCloseTo(324.74 - 337.585 + HEAD_INSET, 6);
    expect(c.max[0]).toBeCloseTo(346.43 - 337.585 - HEAD_INSET, 6);
    expect(c.min[1]).toBeCloseTo(-30.6 + 23.1 + HEAD_INSET_BELOW, 6);
    expect(c.max[1]).toBeCloseTo(-8.6 + 23.1 - HEAD_INSET, 6);
    expect(c.min[2]).toBeCloseTo(-(-421.5 + 432.9) + HEAD_INSET, 6);
    expect(c.max[2]).toBeCloseTo(-(-444.61 + 432.9) - HEAD_INSET, 6);
    for (let k = 0; k < 3; k++) expect(c.min[k]!).toBeLessThan(c.max[k]!);
  });
  it('is absent when the export gives no crop', () => {
    expect(headClip(m(null))).toBeNull();
  });
  it('starts facing the visitor: a turn of -90 degrees brings east to the camera, the three-quarter is within 45 of it', () => {
    expect(Math.abs(HEAD_HOME.yaw + Math.PI / 2)).toBeLessThanOrEqual(Math.PI / 4);
  });
});
