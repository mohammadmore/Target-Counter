import { isLang, LANGS } from '../lib/format';
import { createDefaultConfig, createKiyanConfig, FONTS } from './presets';
import { VIZ_TYPES, type GoalConfig, type Palette } from './types';

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const MAX_TEXT = 400;

type Plain = Record<string, unknown>;
const isPlain = (v: unknown): v is Plain => !!v && typeof v === 'object' && !Array.isArray(v);

/** Copies values from `raw` into a clone of `base` only where the type matches. */
function mergeShape<T>(base: T, raw: unknown): T {
  if (!isPlain(base) || !isPlain(raw)) return base;
  const out: Plain = { ...base };
  for (const key of Object.keys(base)) {
    const b = (base as Plain)[key];
    const r = raw[key];
    if (r === undefined) continue;
    if (isPlain(b)) out[key] = mergeShape(b, r);
    else if (Array.isArray(b)) out[key] = Array.isArray(r) ? r : b;
    else if (typeof b === typeof r) out[key] = typeof r === 'string' ? (r as string).slice(0, MAX_TEXT) : r;
  }
  return out as T;
}

/** Only allow images we host or https URLs (no javascript:, data:, css injection). */
export function safeAssetUrl(value: string): string {
  if (!value) return '';
  // Dev-only: uploads are kept as in-memory blobs when PHP isn't running.
  if (import.meta.env.DEV && /^blob:[^\s"'()<>\\]+$/.test(value)) return value;
  if (/^builtin:[a-z0-9-]+$/.test(value)) return value;
  if (/^uploads\/[A-Za-z0-9._-]+$/.test(value)) return value;
  if (/^https:\/\/[^\s"'()<>\\]+$/.test(value)) return value;
  return '';
}

/**
 * Turns whatever the server stored into a complete, safe GoalConfig.
 * `null` means the legacy single-page install → the original Kiyan design.
 */
export function normalizeConfig(raw: unknown): GoalConfig {
  const base = raw === null || raw === undefined ? createKiyanConfig() : createDefaultConfig();
  const cfg = mergeShape(base, raw);

  cfg.version = 1;
  cfg.languages = Array.from(new Set(cfg.languages.filter(isLang)));
  if (cfg.languages.length === 0) cfg.languages = ['fa'];
  if (!cfg.languages.includes(cfg.defaultLang)) cfg.defaultLang = cfg.languages[0];
  for (const lang of LANGS) cfg.texts[lang] = mergeShape(base.texts[lang], cfg.texts[lang]);

  if (!VIZ_TYPES.includes(cfg.visualization.type)) cfg.visualization.type = 'gauge';
  cfg.visualization.milestones = Math.min(10, Math.max(2, Math.round(cfg.visualization.milestones) || 4));
  if (cfg.visualization.counterMode !== 'score') cfg.visualization.counterMode = 'remaining';

  for (const key of Object.keys(base.theme.palette) as (keyof Palette)[]) {
    if (!HEX.test(cfg.theme.palette[key])) cfg.theme.palette[key] = base.theme.palette[key];
  }
  if (!FONTS.some((f) => f.id === cfg.theme.font.id)) cfg.theme.font.id = 'vazirmatn';
  cfg.theme.font.customUrl = safeAssetUrl(cfg.theme.font.customUrl);
  if (!['sharp', 'soft', 'round'].includes(cfg.theme.radius)) cfg.theme.radius = 'round';

  if (!['glow', 'solid', 'gradient', 'image'].includes(cfg.background.type)) cfg.background.type = 'glow';
  cfg.background.image = safeAssetUrl(cfg.background.image);
  if (cfg.background.type === 'image' && !cfg.background.image) cfg.background.type = 'glow';
  cfg.background.overlay = Math.min(1, Math.max(0, Number(cfg.background.overlay) || 0));
  cfg.logo = safeAssetUrl(cfg.logo);

  return cfg;
}
