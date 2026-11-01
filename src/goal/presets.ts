import type { GoalConfig, GoalTexts, Lang, Palette } from './types';

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------
export interface PalettePreset {
  id: string;
  name: string;
  dark: Palette;
  light: Palette;
}

/** Every preset has a matching dark and light version (both pass the contrast checks). */
export const PALETTES: PalettePreset[] = [
  {
    id: 'gold',
    name: 'طلایی سلطنتی',
    dark: { bg: '#060605', surface: '#0c0b09', primary: '#d4af37', primaryLight: '#f6dd8e', primaryDark: '#8a6c1f', text: '#f3efe4', textMuted: '#a29d92', track: '#17150f' },
    light: { bg: '#faf6ec', surface: '#ffffff', primary: '#b8901f', primaryLight: '#8a6a12', primaryDark: '#5c470c', text: '#2b2414', textMuted: '#6f6656', track: '#ebe2c9' },
  },
  {
    id: 'ocean',
    name: 'اقیانوس',
    dark: { bg: '#03101d', surface: '#071b30', primary: '#22d3ee', primaryLight: '#a5f3fc', primaryDark: '#0e7490', text: '#e6f6ff', textMuted: '#8badc4', track: '#0b2840' },
    light: { bg: '#f0f9ff', surface: '#ffffff', primary: '#0891b2', primaryLight: '#0e7490', primaryDark: '#164e63', text: '#0c2433', textMuted: '#4b6b7d', track: '#d3ecf6' },
  },
  {
    id: 'emerald',
    name: 'زمردی',
    dark: { bg: '#03130d', surface: '#062117', primary: '#10b981', primaryLight: '#6ee7b7', primaryDark: '#047857', text: '#ecfdf5', textMuted: '#8fbfaf', track: '#0a3022' },
    light: { bg: '#f0fdf6', surface: '#ffffff', primary: '#059669', primaryLight: '#047857', primaryDark: '#064e3b', text: '#0b2a1f', textMuted: '#4d6b5f', track: '#d2efe1' },
  },
  {
    id: 'royal',
    name: 'بنفش شاهانه',
    dark: { bg: '#0b0516', surface: '#150b28', primary: '#a78bfa', primaryLight: '#ddd6fe', primaryDark: '#6d28d9', text: '#f5f3ff', textMuted: '#ab9fcf', track: '#21133b' },
    light: { bg: '#f7f5ff', surface: '#ffffff', primary: '#7c3aed', primaryLight: '#6d28d9', primaryDark: '#4c1d95', text: '#1e1537', textMuted: '#625a80', track: '#e6e0fa' },
  },
  {
    id: 'crimson',
    name: 'یاقوتی',
    dark: { bg: '#130409', surface: '#210a12', primary: '#f43f5e', primaryLight: '#fda4af', primaryDark: '#9f1239', text: '#fff1f2', textMuted: '#cf9ea7', track: '#33101b' },
    light: { bg: '#fff5f6', surface: '#ffffff', primary: '#e11d48', primaryLight: '#be123c', primaryDark: '#881337', text: '#2d0a14', textMuted: '#7a5560', track: '#f9dce2' },
  },
  {
    id: 'sunset',
    name: 'غروب',
    dark: { bg: '#170b04', surface: '#24130a', primary: '#fb923c', primaryLight: '#fed7aa', primaryDark: '#c2410c', text: '#fff7ed', textMuted: '#d1ab8f', track: '#3a1e0e' },
    light: { bg: '#fff8f1', surface: '#ffffff', primary: '#ea580c', primaryLight: '#c2410c', primaryDark: '#7c2d12', text: '#2d1606', textMuted: '#7c5d48', track: '#f8e1cc' },
  },
  {
    id: 'silver',
    name: 'نقره‌ای مینیمال',
    dark: { bg: '#0b0c0f', surface: '#14161b', primary: '#cbd5e1', primaryLight: '#f8fafc', primaryDark: '#64748b', text: '#f1f5f9', textMuted: '#94a3b8', track: '#1f232b' },
    light: { bg: '#f6f7f9', surface: '#ffffff', primary: '#475569', primaryLight: '#334155', primaryDark: '#0f172a', text: '#0f172a', textMuted: '#64748b', track: '#dfe4ea' },
  },
  {
    id: 'daylight',
    name: 'آبی آسمانی',
    dark: { bg: '#060b1a', surface: '#0c1428', primary: '#3b82f6', primaryLight: '#93c5fd', primaryDark: '#1d4ed8', text: '#e8eefc', textMuted: '#94a3c4', track: '#142040' },
    light: { bg: '#f6f4ef', surface: '#ffffff', primary: '#2563eb', primaryLight: '#2f74e6', primaryDark: '#1e3a8a', text: '#1f2937', textMuted: '#6b7280', track: '#e5e7eb' },
  },
];

export const PALETTE_FIELDS: { key: keyof Palette; label: string }[] = [
  { key: 'primary', label: 'رنگ اصلی' },
  { key: 'primaryLight', label: 'اصلی روشن' },
  { key: 'primaryDark', label: 'اصلی تیره' },
  { key: 'bg', label: 'پس‌زمینه' },
  { key: 'surface', label: 'کارت‌ها' },
  { key: 'track', label: 'مسیر خالی نمودار' },
  { key: 'text', label: 'متن' },
  { key: 'textMuted', label: 'متن کم‌رنگ' },
];

// ---------------------------------------------------------------------------
// Fonts (all self-hosted; only the chosen one is downloaded)
// ---------------------------------------------------------------------------
export interface FontPreset {
  id: string;
  name: string;
  family: string;
  load?: () => Promise<unknown>;
}

export const FONTS: FontPreset[] = [
  { id: 'vazirmatn', name: 'وزیرمتن', family: "'Vazirmatn'" },
  {
    id: 'noto-kufi',
    name: 'نوتو کوفی',
    family: "'Noto Kufi Arabic'",
    load: () => Promise.all([import('@fontsource/noto-kufi-arabic/400.css'), import('@fontsource/noto-kufi-arabic/700.css')]),
  },
  {
    id: 'noto-naskh',
    name: 'نوتو نسخ',
    family: "'Noto Naskh Arabic'",
    load: () => Promise.all([import('@fontsource/noto-naskh-arabic/400.css'), import('@fontsource/noto-naskh-arabic/700.css')]),
  },
  {
    id: 'rubik',
    name: 'روبیک',
    family: "'Rubik'",
    load: () => Promise.all([import('@fontsource/rubik/400.css'), import('@fontsource/rubik/700.css')]),
  },
  {
    id: 'cairo',
    name: 'قاهره',
    family: "'Cairo'",
    load: () => Promise.all([import('@fontsource/cairo/400.css'), import('@fontsource/cairo/700.css')]),
  },
  {
    id: 'el-messiri',
    name: 'المسیری',
    family: "'El Messiri'",
    load: () => Promise.all([import('@fontsource/el-messiri/400.css'), import('@fontsource/el-messiri/700.css')]),
  },
  {
    id: 'reem-kufi',
    name: 'ریم کوفی',
    family: "'Reem Kufi'",
    load: () => Promise.all([import('@fontsource/reem-kufi/400.css'), import('@fontsource/reem-kufi/700.css')]),
  },
  {
    id: 'markazi',
    name: 'مرکزی',
    family: "'Markazi Text'",
    load: () => Promise.all([import('@fontsource/markazi-text/400.css'), import('@fontsource/markazi-text/700.css')]),
  },
  {
    id: 'amiri',
    name: 'امیری',
    family: "'Amiri'",
    load: () => Promise.all([import('@fontsource/amiri/400.css'), import('@fontsource/amiri/700.css')]),
  },
  {
    id: 'lalezar',
    name: 'لاله‌زار (تیتر)',
    family: "'Lalezar'",
    load: () => import('@fontsource/lalezar/400.css'),
  },
  { id: 'system', name: 'فونت سیستم (Tahoma)', family: 'Tahoma' },
  { id: 'custom', name: 'آپلود فونت دلخواه', family: "'GoalCustomFont'" },
];

// ---------------------------------------------------------------------------
// Texts
// ---------------------------------------------------------------------------
export const DEFAULT_TEXTS: Record<Lang, GoalTexts> = {
  fa: {
    pageTitle: '',
    title: 'هدف تیمی ما',
    subtitle: 'هدف نهایی: {target} {unit}',
    vizLabel: 'پیشرفت',
    unit: 'امتیاز',
    remainingText: 'مانده تا رسیدن به هدف ({target})',
    callToAction: 'سهم تو از این هدف مشترک چقدره؟!',
    celebrationTitle: 'به هدف رسیدیم!',
    celebrationBody: 'با همت و تلاش همه‌ی اعضای تیم\nاین هدف محقق شد',
    afterGoal: 'پیش به سوی هدف بعدی',
    footer: '',
  },
  ar: {
    pageTitle: '',
    title: 'هدف فريقنا',
    subtitle: 'الهدف النهائي: {target} {unit}',
    vizLabel: 'التقدم',
    unit: 'نقطة',
    remainingText: 'متبقي للوصول إلى الهدف ({target})',
    callToAction: 'ما هي حصتك من هذا الهدف المشترك؟!',
    celebrationTitle: 'وصلنا إلى الهدف!',
    celebrationBody: 'بفضل جهود جميع أعضاء الفريق\nتحقق هذا الهدف',
    afterGoal: 'نحو الهدف التالي',
    footer: '',
  },
  en: {
    pageTitle: '',
    title: 'Our Team Goal',
    subtitle: 'Final target: {target} {unit}',
    vizLabel: 'Progress',
    unit: 'points',
    remainingText: 'left to reach the goal ({target})',
    callToAction: 'How much of this shared goal is yours?',
    celebrationTitle: 'Goal reached!',
    celebrationBody: 'Thanks to the effort of every team member\nwe made it',
    afterGoal: 'On to the next goal',
    footer: '',
  },
};

export const TEXT_FIELDS: { key: keyof GoalTexts; label: string; multiline?: boolean; hint?: string }[] = [
  { key: 'title', label: 'تیتر اصلی', hint: 'خالی = بدون تیتر' },
  { key: 'subtitle', label: 'زیرتیتر' },
  { key: 'vizLabel', label: 'برچسب داخل نمودار' },
  { key: 'unit', label: 'واحد شمارش', hint: 'مثل امتیاز، تومان، نفر' },
  { key: 'remainingText', label: 'متن زیر عدد باقیمانده' },
  { key: 'callToAction', label: 'جمله‌ی انگیزشی' },
  { key: 'celebrationTitle', label: 'تیتر جشن رسیدن به هدف' },
  { key: 'celebrationBody', label: 'متن جشن', multiline: true },
  { key: 'afterGoal', label: 'متن بعد از رسیدن به هدف' },
  { key: 'footer', label: 'پانویس', hint: 'مثلاً نام سازمان' },
  { key: 'pageTitle', label: 'عنوان تب مرورگر', hint: 'خالی = همان تیتر اصلی' },
];

export const LANG_NAMES: Record<Lang, string> = { fa: 'فارسی', ar: 'عربی', en: 'انگلیسی' };

// ---------------------------------------------------------------------------
// Whole-config presets
// ---------------------------------------------------------------------------
export function createDefaultConfig(): GoalConfig {
  return {
    version: 1,
    name: 'هدف جدید',
    languages: ['fa'],
    defaultLang: 'fa',
    texts: structuredClone(DEFAULT_TEXTS),
    visualization: { type: 'gauge', milestones: 4, ringText: 'TEAM GOAL', counterMode: 'remaining' },
    theme: {
      mode: 'both',
      paletteId: 'gold',
      palettes: { dark: { ...PALETTES[0].dark }, light: { ...PALETTES[0].light } },
      font: { id: 'vazirmatn', customUrl: '' },
      radius: 'round',
    },
    background: { type: 'glow', image: '', overlay: 0.7, particles: true },
    logo: '',
    logoDark: '',
    logoPlacements: { header: true, editor: true, poster: true, favicon: false },
    features: {
      stats: true,
      celebration: true,
      confetti: true,
      poster: true,
      replay: true,
      editorButton: false,
      languageSwitch: true,
      lastUpdated: true,
    },
  };
}

/** The original Kiyan Pearl page, used for the migrated legacy goal (config = null). */
export function createKiyanConfig(): GoalConfig {
  const base = createDefaultConfig();
  return {
    ...base,
    name: 'سفیر مروارید کیان‌تیم',
    languages: ['fa', 'ar'],
    defaultLang: 'fa',
    texts: {
      fa: {
        pageTitle: 'کیان‌تیم | تعهد سازمانی',
        title: '',
        subtitle: '',
        vizLabel: 'سفیر مروارید',
        unit: 'امتیاز',
        remainingText: 'مانده تا سفیر مروارید کیان‌تیم ({target})',
        callToAction: 'سهم تیم تو از این ویژن مشترک چقدره؟!',
        celebrationTitle: 'سفیر مروارید کیان تیم',
        celebrationBody: 'با همت و تلاش اعضای هدفمند\nاین خانواده تیک شد',
        afterGoal: 'پیش به سوی تکثیر سفیر مروارید',
        footer: 'KIYAN TEAM',
      },
      ar: {
        pageTitle: 'فريق كيان | الالتزام المؤسسي',
        title: '',
        subtitle: '',
        vizLabel: 'سفير اللؤلؤة',
        unit: 'نقطة',
        remainingText: 'متبقي للوصول إلى سفير لؤلؤة كيان ({target})',
        callToAction: 'ما هي حصة فريقك من هذه الرؤية المشتركة؟!',
        celebrationTitle: 'سفير لؤلؤة فريق كيان',
        celebrationBody: 'بفضل جهود ومساعي الأعضاء الهادفين\nفي هذه العائلة تم تحقيقه',
        afterGoal: 'نحو مضاعفة سفراء اللؤلؤ',
        footer: 'فريق كيان',
      },
      en: { ...DEFAULT_TEXTS.en, footer: 'KIYAN TEAM' },
    },
    visualization: { ...base.visualization, type: 'gauge', ringText: 'KIYAN PEARL AMBASSADORS' },
    // The original page was dark-only; keep it that way until an admin opts in.
    theme: { ...base.theme, mode: 'dark' },
    background: { type: 'image', image: 'builtin:kiyan', overlay: 0.75, particles: true },
    // The original page had a public settings button; keep it for continuity.
    features: { ...base.features, editorButton: true },
  };
}
