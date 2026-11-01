import { DEFAULT_TEXTS, PALETTE_FIELDS } from './presets';
import type { GoalConfig, GoalTexts, Lang, Palette } from './types';

// ---------------------------------------------------------------------------
// Colour contrast (WCAG 2.x)
// ---------------------------------------------------------------------------
function rgb(hex: string): [number, number, number] {
  const h = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');

/** Moves `fg` towards white or black (whichever helps) until it reaches `min` contrast on `bg`. */
export function fixContrast(fg: string, bg: string, min: number) {
  const [r, g, b] = rgb(fg);
  const towards = luminance(bg) > 0.4 ? 0 : 255;
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const candidate = `#${toHex(r + (towards - r) * t)}${toHex(g + (towards - g) * t)}${toHex(b + (towards - b) * t)}`;
    if (contrastRatio(candidate, bg) >= min) return candidate;
  }
  return towards ? '#ffffff' : '#000000';
}

export interface ContrastIssue {
  key: keyof Palette;
  against: keyof Palette;
  ratio: number;
  min: number;
  message: string;
}

const CHECKS: { key: keyof Palette; against: keyof Palette; min: number; message: string }[] = [
  { key: 'text', against: 'bg', min: 4.5, message: 'متن اصلی روی پس‌زمینه به‌سختی خوانده می‌شود.' },
  { key: 'text', against: 'surface', min: 4.5, message: 'متن داخل کارت‌ها به‌سختی خوانده می‌شود.' },
  { key: 'textMuted', against: 'bg', min: 3, message: 'متن کم‌رنگ بیش از حد کم‌رنگ است.' },
  { key: 'primaryLight', against: 'bg', min: 3, message: 'تیترها و اعداد طلایی/رنگی روی پس‌زمینه دیده نمی‌شوند.' },
  { key: 'primary', against: 'track', min: 1.6, message: 'بخش پرشده‌ی نمودار از مسیر خالی قابل تشخیص نیست.' },
];

export function contrastIssues(p: Palette): ContrastIssue[] {
  return CHECKS.map((c) => ({ ...c, ratio: contrastRatio(p[c.key], p[c.against]) })).filter((c) => c.ratio < c.min);
}

export const paletteLabel = (key: keyof Palette) => PALETTE_FIELDS.find((f) => f.key === key)?.label ?? key;

// ---------------------------------------------------------------------------
// Untranslated texts
// ---------------------------------------------------------------------------
/**
 * Fields of `lang` that still hold the generic default text although the same
 * field was customised in another enabled language — almost always forgotten.
 */
export function untranslatedFields(config: GoalConfig, lang: Lang): (keyof GoalTexts)[] {
  if (config.languages.length < 2) return [];
  const others = config.languages.filter((l) => l !== lang);
  return (Object.keys(DEFAULT_TEXTS[lang]) as (keyof GoalTexts)[]).filter((key) => {
    const value = config.texts[lang][key];
    if (value !== DEFAULT_TEXTS[lang][key]) return false;
    return others.some((o) => config.texts[o][key] !== DEFAULT_TEXTS[o][key]);
  });
}

export function untranslatedSummary(config: GoalConfig) {
  return config.languages.map((lang) => ({ lang, fields: untranslatedFields(config, lang) })).filter((x) => x.fields.length > 0);
}
