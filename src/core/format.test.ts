import { fmtPct, fmtSignedPct, fmtInt, fmtFeet } from './format';

describe('formatters (NYT house style)', () => {
  it('fmtPct rounds to whole percent', () => {
    expect(fmtPct(0.4249)).toBe('42%');
    expect(fmtPct(1)).toBe('100%');
  });

  it('fmtSignedPct uses a true minus sign, and + for growth', () => {
    expect(fmtSignedPct(-12.4)).toBe('−12%');
    expect(fmtSignedPct(8)).toBe('+8%');
    expect(fmtSignedPct(0)).toBe('0%');
  });

  it('fmtInt adds thousands separators', () => {
    expect(fmtInt(1234567)).toBe('1,234,567');
  });

  it('fmtFeet appends a unit once', () => {
    expect(fmtFeet(212.3)).toBe('212 ft.');
  });
});
