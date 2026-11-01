import type { CSSProperties } from 'react';
import kiyanBg from '../assets/kiyanbg.webp';
import { FONTS } from './presets';
import { contrastRatio } from './quality';
import type { GoalConfig } from './types';

const BUILTIN_IMAGES: Record<string, string> = { 'builtin:kiyan': kiyanBg };

export const BUILTIN_BACKGROUNDS = [{ id: 'builtin:kiyan', name: 'کیان (پیش‌فرض)', url: kiyanBg }];

/** Resolves a stored asset reference to a URL the browser can load. */
export function assetUrl(ref: string): string {
  if (!ref) return '';
  return BUILTIN_IMAGES[ref] ?? ref;
}

const RADIUS = { sharp: '4px', soft: '12px', round: '24px' } as const;

/** CSS variables consumed by the Tailwind theme tokens (bg-primary, text-text-muted …). */
/** Light backgrounds need darker error text and softer shadows than dark ones. */
export const isLightPalette = (bg: string) => contrastRatio(bg, '#000000') > contrastRatio(bg, '#ffffff');

export function themeStyle(config: GoalConfig): CSSProperties {
  const p = config.theme.palette;
  const light = isLightPalette(p.bg);
  const font = FONTS.find((f) => f.id === config.theme.font.id) ?? FONTS[0];
  return {
    '--color-bg': p.bg,
    '--color-surface': p.surface,
    '--color-primary': p.primary,
    '--color-primary-light': p.primaryLight,
    '--color-primary-dark': p.primaryDark,
    '--color-text': p.text,
    '--color-text-muted': p.textMuted,
    '--color-track': p.track,
    '--color-danger': light ? '#c81e1e' : '#fb7185',
    '--shade': light ? '0.14' : '0.6',
    '--font-goal': `${font.family}, 'Vazirmatn', Tahoma, sans-serif`,
    '--radius-goal': RADIUS[config.theme.radius],
  } as CSSProperties;
}

const loadedFonts = new Set<string>();

/** Downloads the chosen font on demand (bundled fonts or an uploaded file). */
export function ensureFont(config: GoalConfig) {
  const { id, customUrl } = config.theme.font;
  if (id === 'custom') {
    if (!customUrl || loadedFonts.has(customUrl)) return;
    loadedFonts.add(customUrl);
    const style = document.createElement('style');
    style.textContent = `@font-face{font-family:'GoalCustomFont';src:url(${JSON.stringify(assetUrl(customUrl))});font-display:swap;}`;
    document.head.appendChild(style);
    return;
  }
  loadFontById(id);
}

/** Downloads a bundled font by preset id (no-op for system/custom/already loaded). */
export function loadFontById(id: string) {
  if (loadedFonts.has(id)) return;
  loadedFonts.add(id);
  FONTS.find((f) => f.id === id)?.load?.().catch(() => loadedFonts.delete(id));
}
