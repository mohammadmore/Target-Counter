import { useEffect, useId, useState } from 'react';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { formatNumber, formatPercent, localeOf, type Lang } from '../lib/format';
import type { GoalConfig } from '../goal/types';

export interface VizProps {
  score: number;
  target: number;
  /** 0..1, already clamped */
  ratio: number;
  lang: Lang;
  config: GoalConfig;
  /** The goal's "label inside the visualization" text */
  label: string;
  /** Smaller rendering for wizard thumbnails (no heavy effects). */
  compact?: boolean;
}

/** SVG-safe unique id (React ids contain characters that break url(#…)). */
export function useSvgId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/** Starts at 0, then follows `value` on the next frames so CSS transitions play on mount. */
export function useEntrance(value: number) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setShown(value));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [value]);
  return shown;
}

export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function formatCompact(value: number, lang: Lang) {
  return new Intl.NumberFormat(localeOf(lang), { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

/** Values of the labelled milestones, e.g. n=4 → 0, 25%, 50%, 75%, 100% of target. */
export function milestoneFractions(count: number) {
  return Array.from({ length: count + 1 }, (_, i) => i / count);
}

export function PercentReadout({ ratio, lang, label, size = 'lg' }: { ratio: number; lang: Lang; label?: string; size?: 'md' | 'lg' }) {
  const pct = useAnimatedNumber(ratio * 100, 1800);
  return (
    <div className="flex flex-col items-center">
      <div
        className={`font-extrabold leading-none text-gradient drop-shadow-[0_0_12px_color-mix(in_srgb,var(--color-primary)_35%,transparent)] ${
          size === 'lg' ? 'text-[clamp(2rem,7vw,3rem)]' : 'text-[1.7rem]'
        }`}
        style={{ direction: 'ltr' }}
      >
        {formatPercent(pct, lang)}
        <span className="text-[0.55em] font-bold ms-1">%</span>
      </div>
      {label && <span className="text-[0.85rem] font-bold text-primary-light mt-1.5">{label}</span>}
    </div>
  );
}

export { formatNumber };
