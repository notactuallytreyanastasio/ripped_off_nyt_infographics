
import { MIN_TEXT, plotArea, textSizes, textWidth, wrapLines } from './size';
import { cssToken, palette, type PaletteKey } from './palette';

describe('textSizes', () => {
  it('never goes below 12px at any width, including a 390px phone', () => {
    for (let w = 280; w <= 2000; w += 10) {
      const t = textSizes({ width: w, height: 500 });
      for (const px of [t.tick, t.label, t.annotation, t.small]) expect(px).toBeGreaterThanOrEqual(MIN_TEXT);
    }
    const phone = textSizes({ width: 390, height: 600 });
    expect(phone.compact).toBe(true);
    expect(phone.ticks).toBeLessThan(textSizes({ width: 800, height: 600 }).ticks);
  });
});

describe('plotArea', () => {
  it('subtracts margins and never goes negative', () => {
    expect(plotArea({ width: 400, height: 300 }, { top: 10, right: 20, bottom: 30, left: 40 }))
      .toEqual({ x0: 40, y0: 10, x1: 380, y1: 270, width: 340, height: 260 });
    expect(plotArea({ width: 10, height: 10 }, { top: 10, right: 20, bottom: 30, left: 40 }).width).toBe(0);
  });
});

describe('textWidth and wrapLines', () => {
  it('grows with length and size', () => {
    expect(textWidth('Carmel', 12)).toBeLessThan(textWidth('Carmel, Ind.', 12));
    expect(textWidth('Carmel', 12)).toBeLessThan(textWidth('Carmel', 16));
    expect(textWidth('mmm', 12)).toBeGreaterThan(textWidth('iii', 12));
  });
  it('wraps greedily within the width', () => {
    const lines = wrapLines('The felt is a blend of wool and nylon needled onto a backing', 120, 13);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) if (l.includes(' ')) expect(textWidth(l, 13)).toBeLessThanOrEqual(120);
    expect(lines.join(' ')).toBe('The felt is a blend of wool and nylon needled onto a backing');
  });
  it('keeps an overlong word whole', () => expect(wrapLines('Polybutadiene', 20, 13)).toEqual(['Polybutadiene']));
});

describe('palette', () => {
  it('matches the CSS tokens in src/styles/base.css', async () => {
    const fs = (await import(/* @vite-ignore */ 'node:fs' as string)) as { readFileSync(p: string, enc: 'utf8'): string };
    const css = fs.readFileSync('src/styles/base.css', 'utf8') // vitest runs from the project root;
    const norm = (hex: string) => (hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex).toLowerCase();
    for (const key of Object.keys(cssToken) as PaletteKey[]) {
      const m = new RegExp(`${cssToken[key]}:\\s*(#[0-9a-fA-F]{3,6})`).exec(css);
      expect(m, `token ${cssToken[key]}`).not.toBeNull();
      expect(palette[key]).toBe(norm(m?.[1] ?? ''));
    }
  });
});
