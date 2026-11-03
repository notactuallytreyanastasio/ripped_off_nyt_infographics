import { EN_DASH, MINUS, fmtMoney, fmtNum, fmtRange, fmtShort, fmtTons, fmtUnit } from './format';

describe('fmtNum', () => {
  it('uses thousands separators and a true minus', () => {
    expect(fmtNum(1234567)).toBe('1,234,567');
    expect(fmtNum(-1234.56, 1)).toBe(`${MINUS}1,234.6`);
  });
  it('never prints a minus zero', () => expect(fmtNum(-0.004, 2)).toBe('0.00'));
  it('throws on NaN and Infinity', () => {
    expect(() => fmtNum(NaN)).toThrow(/finite/);
    expect(() => fmtNum(Infinity)).toThrow(/finite/);
  });
});

describe('fmtShort', () => {
  it('scales to million, billion, trillion and drops trailing zeros', () => {
    expect(fmtShort(4_210_000)).toBe('4.2 million');
    expect(fmtShort(4_000_000)).toBe('4 million');
    expect(fmtShort(1_300_000_000)).toBe('1.3 billion');
    expect(fmtShort(2.5e12)).toBe('2.5 trillion');
  });
  it('carries 999.97 million up to 1 billion', () => expect(fmtShort(999_970_000)).toBe('1 billion'));
  it('leaves numbers under a million in full', () => expect(fmtShort(850_000)).toBe('850,000'));
  it('signs negatives', () => expect(fmtShort(-4_200_000)).toBe(`${MINUS}4.2 million`));
});

describe('fmtMoney', () => {
  it('auto: short form from a million, full below', () => {
    expect(fmtMoney(4_200_000)).toBe('$4.2 million');
    expect(fmtMoney(850_000)).toBe('$850,000');
    expect(fmtMoney(12)).toBe('$12');
  });
  it('puts the minus before the dollar sign', () => {
    expect(fmtMoney(-850_000)).toBe(`${MINUS}$850,000`);
    expect(fmtMoney(-4_200_000)).toBe(`${MINUS}$4.2 million`);
  });
  it('full and cents', () => {
    expect(fmtMoney(4_200_000, { style: 'full' })).toBe('$4,200,000');
    expect(fmtMoney(3.5, { style: 'full', digits: 2 })).toBe('$3.50');
  });
  it('abbr for tick labels', () => {
    expect(fmtMoney(4_200_000, { style: 'abbr' })).toBe('$4.2M');
    expect(fmtMoney(850_000, { style: 'abbr' })).toBe('$850K');
    expect(fmtMoney(2e9, { style: 'abbr' })).toBe('$2B');
    expect(fmtMoney(400, { style: 'abbr' })).toBe('$400');
  });
  it('digits in short form', () => expect(fmtMoney(4_256_000, { digits: 2 })).toBe('$4.26 million'));
});

describe('fmtUnit and fmtTons', () => {
  it('spaces word units, not symbols', () => {
    expect(fmtUnit(2.5, 'in.', 1)).toBe('2.5 in.');
    expect(fmtUnit(-4, '°F')).toBe(`${MINUS}4°F`);
    expect(fmtUnit(55, '%')).toBe('55%');
  });
  it('tons: singular for one, metric when asked, short above a million', () => {
    expect(fmtTons(1)).toBe('1 ton');
    expect(fmtTons(1200)).toBe('1,200 tons');
    expect(fmtTons(4_200_000, { metric: true })).toBe('4.2 million metric tons');
  });
});

describe('fmtRange', () => {
  it('shares a common unit with an en dash', () => {
    expect(fmtRange(4e6, 6e6, (n) => fmtMoney(n))).toBe(`$4${EN_DASH}6 million`);
    expect(fmtRange(40, 60, (n) => fmtUnit(n, '%'))).toBe(`40${EN_DASH}60%`);
    expect(fmtRange(1200, 1500, (n) => fmtTons(n))).toBe(`1,200${EN_DASH}1,500 tons`);
    expect(fmtRange(400, 600, (n) => fmtMoney(n))).toBe(`$400${EN_DASH}600`);
  });
  it('keeps both units when they differ', () => {
    expect(fmtRange(850_000, 1_200_000, (n) => fmtMoney(n))).toBe(`$850,000${EN_DASH}$1.2 million`);
  });
  it('uses "to" across zero', () => expect(fmtRange(-5, 5)).toBe(`${MINUS}5 to 5`));
  it('rejects reversed ranges', () => expect(() => fmtRange(5, 1)).toThrow());
});
