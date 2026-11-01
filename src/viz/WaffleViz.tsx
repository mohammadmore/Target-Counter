import { formatNumber, type Lang } from '../lib/format';
import { PercentReadout, useEntrance, type VizProps } from './common';

const CAPTION: Record<Lang, (one: string) => string> = {
  fa: (one) => `هر دایره = ${one}٪ از هدف`,
  ar: (one) => `كل دائرة = ${one}٪ من الهدف`,
  en: (one) => `Each dot = ${one}% of the goal`,
};

/** 10×10 grid of pearls — every pearl is 1% of the goal. */
export default function WaffleViz({ ratio, lang, label, compact }: VizProps) {
  const shown = useEntrance(ratio) * 100;

  return (
    <div className="w-full max-w-[380px] mx-auto flex flex-col items-center gap-5">
      <PercentReadout ratio={ratio} lang={lang} label={label} size={compact ? 'md' : 'lg'} />
      <div className={`grid grid-cols-10 ${compact ? 'gap-1 w-[170px]' : 'gap-[clamp(4px,1.4vw,8px)] w-full'}`}>
        {Array.from({ length: 100 }, (_, i) => {
          const row = Math.floor(i / 10);
          const rank = (9 - row) * 10 + (i % 10); // fill from the bottom row up
          const amount = Math.max(0, Math.min(1, shown - rank));
          return (
            <div key={i} className="relative aspect-square rounded-full bg-track border border-primary/15">
              <div
                className="viz-anim absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,var(--color-primary-light),var(--color-primary)_55%,var(--color-primary-dark))] shadow-[0_0_8px_color-mix(in_srgb,var(--color-primary)_45%,transparent)]"
                style={{
                  transform: `scale(${amount})`,
                  opacity: amount > 0 ? 1 : 0,
                  transition: `transform 0.5s ease-out ${compact ? 0 : rank * 14}ms, opacity 0.3s ${compact ? 0 : rank * 14}ms`,
                }}
              />
            </div>
          );
        })}
      </div>
      {!compact && <div className="text-[0.78rem] text-text-muted">{CAPTION[lang](formatNumber(1, lang))}</div>}
    </div>
  );
}
