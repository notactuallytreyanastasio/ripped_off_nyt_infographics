import { activeStep, stepProgress } from './scroll';

// Rects are { top, bottom } in viewport pixels; the trigger line is a
// fraction of viewport height (NYT pieces typically fire around 0.5-0.66).

describe('activeStep', () => {
  const vh = 1000;

  it('returns -1 before the first step reaches the trigger line', () => {
    const rects = [
      { top: 900, bottom: 1500 },
      { top: 1500, bottom: 2100 },
    ];
    expect(activeStep(rects, vh, 0.6)).toBe(-1);
  });

  it('returns the last step whose top has crossed the trigger line', () => {
    const rects = [
      { top: -500, bottom: 100 },
      { top: 100, bottom: 700 },
      { top: 700, bottom: 1300 },
    ];
    expect(activeStep(rects, vh, 0.6)).toBe(1);
  });

  it('stays on the final step after scrolling past everything', () => {
    const rects = [
      { top: -2000, bottom: -1400 },
      { top: -1400, bottom: -800 },
    ];
    expect(activeStep(rects, vh, 0.6)).toBe(1);
  });

  it('handles no steps', () => {
    expect(activeStep([], vh, 0.5)).toBe(-1);
  });
});

describe('stepProgress', () => {
  it('is 0 when the step top is at the trigger line and 1 when its bottom is', () => {
    expect(stepProgress({ top: 600, bottom: 1200 }, 1000, 0.6)).toBe(0);
    expect(stepProgress({ top: 0, bottom: 600 }, 1000, 0.6)).toBe(1);
    expect(stepProgress({ top: 300, bottom: 900 }, 1000, 0.6)).toBeCloseTo(0.5);
  });

  it('clamps to [0, 1]', () => {
    expect(stepProgress({ top: 2000, bottom: 2600 }, 1000, 0.6)).toBe(0);
    expect(stepProgress({ top: -2000, bottom: -1400 }, 1000, 0.6)).toBe(1);
  });
});
