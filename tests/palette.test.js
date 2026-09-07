import {
  parseColor,
  mix,
  flatten,
  luminance,
  contrastRatio,
  isDarkColor,
  saturation,
  derivePalette,
} from '../src/widget/theme/palette.js';

describe('parseColor', () => {
  it('parses the rgb/rgba strings getComputedStyle returns', () => {
    expect(parseColor('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    expect(parseColor('rgba(0, 128, 255, 0.5)')).toEqual({ r: 0, g: 128, b: 255, a: 0.5 });
  });

  it('parses hex in 3, 6 and 8 digit forms', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#0a2236')).toEqual({ r: 10, g: 34, b: 54, a: 1 });
    expect(parseColor('#0a223680').a).toBeCloseTo(0.502, 2);
  });

  it('returns null for values it cannot use', () => {
    expect(parseColor('transparent')).toBeNull();
    expect(parseColor('')).toBeNull();
    expect(parseColor(null)).toBeNull();
  });
});

describe('colour maths', () => {
  it('mixes linearly between two colours', () => {
    const grey = mix({ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 }, 0.5);
    expect(grey.r).toBeCloseTo(127.5);
  });

  it('composites a translucent colour onto its backdrop', () => {
    const white = { r: 255, g: 255, b: 255, a: 1 };
    expect(flatten({ r: 0, g: 0, b: 0, a: 0.5 }, white).r).toBeCloseTo(127.5);
    expect(flatten({ r: 1, g: 2, b: 3, a: 1 }, white)).toEqual({ r: 1, g: 2, b: 3, a: 1 });
  });

  it('reports luminance and contrast on the sRGB scale', () => {
    expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 3);
    expect(luminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 3);
    // Black on white is the maximum 21:1.
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 1);
  });

  it('separates dark surfaces from light ones at the white/black text crossover', () => {
    expect(isDarkColor({ r: 28, g: 28, b: 28 })).toBe(true);
    expect(isDarkColor({ r: 255, g: 255, b: 255 })).toBe(false);
    // Mid grey: black text beats white on it, so it must count as light.
    expect(isDarkColor({ r: 128, g: 128, b: 128 })).toBe(false);
  });

  it('scores greys as unsaturated and brand colours as saturated', () => {
    expect(saturation({ r: 128, g: 128, b: 128 })).toBe(0);
    expect(saturation({ r: 0, g: 122, b: 163 })).toBeGreaterThan(0.9);
  });
});

describe('derivePalette', () => {
  it('keeps the page background as the panel colour', () => {
    const { palette } = derivePalette({
      background: { r: 255, g: 255, b: 255, a: 1 },
      text: { r: 10, g: 34, b: 54, a: 1 },
      accent: { r: 0, g: 122, b: 163, a: 1 },
    });
    expect(palette['--panel']).toBe('rgb(255, 255, 255)');
    expect(palette['--accent']).toBe('rgb(0, 122, 163)');
  });

  it('detects a dark page and keeps text readable on it', () => {
    const { palette, isDark } = derivePalette({
      background: { r: 28, g: 28, b: 28, a: 1 },
      text: { r: 247, g: 247, b: 247, a: 1 },
      accent: null,
    });
    expect(isDark).toBe(true);
    expect(contrastRatio(parseColor(palette['--text']), parseColor(palette['--panel']))).toBeGreaterThan(4.5);
  });

  it('replaces page text that would be unreadable on its own background', () => {
    // Light grey text on a white page: the page may be fine, the widget is not.
    const { palette } = derivePalette({
      background: { r: 255, g: 255, b: 255, a: 1 },
      text: { r: 240, g: 240, b: 240, a: 1 },
      accent: null,
    });
    expect(contrastRatio(parseColor(palette['--text']), { r: 255, g: 255, b: 255 })).toBeGreaterThan(4.5);
  });

  it('falls back to a Momentum accent when the page accent vanishes into the panel', () => {
    const { palette } = derivePalette({
      background: { r: 255, g: 255, b: 255, a: 1 },
      text: { r: 10, g: 34, b: 54, a: 1 },
      accent: { r: 252, g: 252, b: 252, a: 1 },
    });
    expect(palette['--accent']).toBe('rgb(0, 122, 163)');
  });

  it('composites a translucent page background over white before using it', () => {
    const { palette, isDark } = derivePalette({
      background: { r: 0, g: 0, b: 0, a: 0.5 },
      text: null,
      accent: null,
    });
    expect(palette['--panel']).toBe('rgb(128, 128, 128)');
    expect(isDark).toBe(false);
  });

  it('always produces all seven custom properties', () => {
    const { palette } = derivePalette({ background: { r: 255, g: 255, b: 255, a: 1 }, text: null, accent: null });
    expect(Object.keys(palette).sort()).toEqual(
      ['--accent', '--active', '--bg', '--border', '--panel', '--text', '--text2'].sort()
    );
  });
});
