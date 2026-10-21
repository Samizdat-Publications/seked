import { describe, expect, it } from 'vitest';
import { labelScale, nudge, sideStep } from './overlay';

describe("the scene's labels", () => {
  it('keep their phone size on a phone and grow on a laptop, to a limit', () => {
    expect(labelScale(390)).toBe(1);
    expect(labelScale(1280)).toBeCloseTo(1.28, 6);
    expect(labelScale(2560)).toBe(1.4);
  });
  it('stay where they are when nothing is in the way', () => {
    const r = { x: 100, y: 100, w: 200, h: 40 };
    expect(nudge(r, [{ x: 400, y: 100, w: 100, h: 40 }], 720)).toEqual(r);
  });
  it('move below a plate they would cover, and past the next one too', () => {
    const placed = [{ x: 150, y: 110, w: 200, h: 40 }, { x: 150, y: 156, w: 200, h: 40 }];
    expect(nudge({ x: 100, y: 100, w: 200, h: 40 }, placed, 720).y).toBe(202);
  });
  it('move above when there is no room below', () => {
    const placed = [{ x: 100, y: 660, w: 200, h: 40 }];
    expect(nudge({ x: 100, y: 650, w: 200, h: 40 }, placed, 720).y).toBe(614);
  });
  it("step sideways off a panel the page lays over the stage, away from the panel's side", () => {
    const panel = { x: 20, y: 20, w: 330, h: 400 };
    expect(sideStep({ x: 300, y: 270, w: 200, h: 48 }, [panel], 1280).x).toBe(358);
    expect(sideStep({ x: 900, y: 270, w: 200, h: 48 }, [{ x: 950, y: 20, w: 300, h: 400 }], 1280).x).toBe(742);
    expect(sideStep({ x: 300, y: 500, w: 200, h: 48 }, [panel], 1280).x).toBe(300);
  });
});
