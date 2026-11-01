import { EASE, PercentReadout, formatCompact, milestoneFractions, useEntrance, type VizProps } from './common';
import { formatPercent } from '../lib/format';

/** Thick horizontal progress bar with milestones and a floating marker. */
export default function BarViz({ ratio, target, lang, label, config, compact }: VizProps) {
  const shown = useEntrance(ratio);
  const transition = `${EASE} 1.8s`;

  return (
    <div className="w-full max-w-[520px] mx-auto px-2">
      <PercentReadout ratio={ratio} lang={lang} label={label} size={compact ? 'md' : 'lg'} />

      <div className="relative mt-12">
        {/* Floating marker */}
        <div
          className="viz-anim absolute -top-10 -translate-x-1/2 rtl:translate-x-1/2"
          style={{ insetInlineStart: `${shown * 100}%`, transition: `inset-inline-start ${transition}` }}
        >
          <div className="px-2 py-0.5 rounded-md bg-primary text-bg text-[0.75rem] font-bold whitespace-nowrap" style={{ direction: 'ltr' }}>
            {formatPercent(ratio * 100, lang)}%
          </div>
          <div className="w-2 h-2 bg-primary rotate-45 mx-auto -mt-1" />
        </div>

        {/* Track */}
        <div className="relative h-7 rounded-full bg-track border border-primary/25 overflow-hidden shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]">
          <div
            className="viz-anim absolute inset-y-0 start-0 rounded-full bg-gradient-to-l rtl:bg-gradient-to-r from-primary-light via-primary to-primary-dark shadow-[0_0_18px_color-mix(in_srgb,var(--color-primary)_45%,transparent)] overflow-hidden"
            style={{ width: `${shown * 100}%`, transition: `width ${transition}` }}
          >
            {!compact && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-[shimmer_2.8s_ease-in-out_infinite]" />
            )}
          </div>
        </div>

        {/* Milestones */}
        <div className="relative h-8 mt-1.5">
          {milestoneFractions(config.visualization.milestones).map((f) => (
            <div
              key={f}
              className="absolute top-0 flex flex-col items-center -translate-x-1/2 rtl:translate-x-1/2"
              style={{ insetInlineStart: `${f * 100}%` }}
            >
              <div className={`w-px h-2 ${f <= shown ? 'bg-primary' : 'bg-text-muted/50'}`} />
              <span className={`text-[0.68rem] font-bold whitespace-nowrap ${f <= ratio ? 'text-primary' : 'text-text-muted'}`}>
                {formatCompact(target * f, lang)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
