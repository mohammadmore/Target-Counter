import { describe, expect, it } from 'vitest';
import { contrastIssues, contrastRatio, deriveCounterpart, fixContrast, isLight, untranslatedFields } from './quality';
import { createDefaultConfig, PALETTES } from './presets';

describe('contrast', () => {
  it('computes WCAG ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('all built-in palettes pass the readability checks', () => {
    for (const p of PALETTES) {
      expect(contrastIssues(p.dark), `${p.id} dark`).toEqual([]);
      expect(contrastIssues(p.light), `${p.id} light`).toEqual([]);
    }
  });

  it('flags and auto-fixes unreadable text', () => {
    const palette = { ...PALETTES[0].dark, text: '#111111' };
    expect(contrastIssues(palette).map((i) => i.key)).toContain('text');
    const fixed = fixContrast(palette.text, palette.bg, 4.5);
    expect(contrastRatio(fixed, palette.bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('untranslatedFields', () => {
  it('reports fields left at the generic default while customised elsewhere', () => {
    const cfg = createDefaultConfig();
    cfg.languages = ['fa', 'en'];
    cfg.texts.fa.title = 'فروش پاییز';
    expect(untranslatedFields(cfg, 'en')).toEqual(['title']);
    expect(untranslatedFields(cfg, 'fa')).toEqual([]);
    cfg.texts.en.title = 'Autumn sales';
    expect(untranslatedFields(cfg, 'en')).toEqual([]);
  });

  it('ignores single-language pages', () => {
    const cfg = createDefaultConfig();
    cfg.texts.fa.title = 'x';
    expect(untranslatedFields(cfg, 'fa')).toEqual([]);
  });
});

describe('deriveCounterpart', () => {
  it('builds readable light and dark versions of any palette', () => {
    for (const p of PALETTES) {
      const light = deriveCounterpart(p.dark, 'light');
      const dark = deriveCounterpart(p.light, 'dark');
      expect(isLight(light.bg), p.id).toBe(true);
      expect(isLight(dark.bg), p.id).toBe(false);
      expect(contrastIssues(light), `${p.id} → light`).toEqual([]);
      expect(contrastIssues(dark), `${p.id} → dark`).toEqual([]);
    }
  });
});
