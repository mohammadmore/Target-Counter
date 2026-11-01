import type { Lang } from '../lib/format';

export type { Lang };

export const VIZ_TYPES = ['gauge', 'ring', 'bar', 'thermometer', 'liquid', 'journey', 'counter', 'waffle'] as const;
export type VizType = (typeof VIZ_TYPES)[number];

export interface Palette {
  bg: string;
  surface: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  text: string;
  textMuted: string;
  track: string;
}

/**
 * Every visible sentence on a goal page. Supports placeholders:
 * {target} {score} {remaining} {percent} {unit}
 */
export interface GoalTexts {
  pageTitle: string;
  title: string;
  subtitle: string;
  vizLabel: string;
  unit: string;
  remainingText: string;
  callToAction: string;
  celebrationTitle: string;
  celebrationBody: string;
  afterGoal: string;
  footer: string;
}

/** Which colour mode a page is rendered in. */
export type ColorMode = 'dark' | 'light';
/** Which modes a goal offers: one fixed mode, or both with a visitor toggle. */
export type ThemeMode = ColorMode | 'both';

export interface LogoPlacements {
  /** Above the page title. */
  header: boolean;
  /** In the score editor header. */
  editor: boolean;
  /** Corner of the downloadable poster. */
  poster: boolean;
  /** Browser tab icon. */
  favicon: boolean;
}

export type BackgroundType = 'glow' | 'solid' | 'gradient' | 'image';

export interface GoalFeatures {
  stats: boolean;
  celebration: boolean;
  confetti: boolean;
  poster: boolean;
  replay: boolean;
  /** Show the score button to every visitor (devices with a saved login always see it). */
  editorButton: boolean;
  languageSwitch: boolean;
  /** "Updated 2 hours ago" line under the numbers. */
  lastUpdated: boolean;
}

export interface GoalConfig {
  version: 1;
  /** Internal name shown in the studio dashboard. */
  name: string;
  languages: Lang[];
  defaultLang: Lang;
  texts: Record<Lang, GoalTexts>;
  visualization: {
    type: VizType;
    /** Number of labelled milestones on gauge / bar / thermometer / journey. */
    milestones: number;
    /** Text that circles the ring visualization. */
    ringText: string;
    /** What the counter visualization counts. */
    counterMode: 'remaining' | 'score';
  };
  theme: {
    /** dark / light only, or both with a visitor toggle (system preference first). */
    mode: ThemeMode;
    paletteId: string;
    palettes: Record<ColorMode, Palette>;
    font: { id: string; customUrl: string };
    radius: 'sharp' | 'soft' | 'round';
  };
  background: {
    type: BackgroundType;
    /** "builtin:<id>", "uploads/<file>" or an https URL. */
    image: string;
    /** 0..1 darkness of the overlay on top of the image. */
    overlay: number;
    particles: boolean;
  };
  /** Organisation logo: "uploads/<file>" or https URL. Used in both modes unless logoDark is set. */
  logo: string;
  /** Optional variant for dark backgrounds. */
  logoDark: string;
  logoPlacements: LogoPlacements;
  features: GoalFeatures;
}

export interface GoalData {
  slug: string;
  config: GoalConfig;
  score: number;
  target: number;
}
