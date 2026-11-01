import { MAX_DIGITS } from '../config';

export type Lang = 'fa' | 'ar' | 'en';

export const LANGS: Lang[] = ['fa', 'ar', 'en'];

const LOCALES: Record<Lang, string> = { fa: 'fa-IR', ar: 'ar-EG', en: 'en-US' };
export const localeOf = (lang: Lang) => LOCALES[lang];
export const dirOf = (lang: Lang) => (lang === 'en' ? 'ltr' : 'rtl');
export const isLang = (value: unknown): value is Lang => value === 'fa' || value === 'ar' || value === 'en';

export function formatNumber(value: number, lang: Lang, options?: Intl.NumberFormatOptions) {
  return value.toLocaleString(localeOf(lang), options);
}

export function formatPercent(value: number, lang: Lang) {
  return formatNumber(value, lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 60_000_000 -> "۶۰M" (fa) / "٦٠M" (ar); 12_500_000 -> "۱۲٫۵M". */
export function formatMillions(value: number, lang: Lang) {
  return `${formatNumber(value / 1_000_000, lang, { maximumFractionDigits: 1 })}M`;
}

const DIGIT_MAP: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

/**
 * Parses a user-typed whole number that may use Persian/Arabic digits and
 * thousands separators. Returns null for anything that is not a plain integer.
 */
export function parseWholeNumber(input: string): number | null {
  const normalized = input
    .replace(/[۰-۹٠-٩]/g, (d) => DIGIT_MAP[d])
    .replace(/[\s,،٬'_]/g, '');
  if (!/^\d+$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isSafeInteger(value) ? value : null;
}

/** Replaces {name} placeholders; unknown names are left untouched. */
export function fillTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? vars[key] : match));
}

/** 1234 -> [0,0,0,0,1,2,3,4] (always `length` long). */
export function toDigits(value: number, length = MAX_DIGITS): number[] {
  return String(Math.max(0, Math.floor(value))).padStart(length, '0').slice(-length).split('').map(Number);
}

export function fromDigits(digits: number[]): number {
  return digits.reduce((acc, d) => acc * 10 + d, 0);
}
