import { EASE, PercentReadout, formatCompact, milestoneFractions, useEntrance, type VizProps } from './common';

/** Thick horizontal progress bar with milestones and a floating marker. */
export default function BarViz({ ratio, target, lang, label, config, compact }: VizProps) {
  const shown = useEntrance(ratio);
  const transition = `${EASE} 1.8s`;

  return (
    <div className="w-full max-w-[520px] mx-auto px-2">
      <PercentReadout ratio={ratio} lang={lang} label={label} size={compact ? 'md' : 'lg'} />

      <div className="relative mt-8">
        {/* Position pin (the percentage itself is shown above) */}
        <div
          className="viz-anim absolute -top-5 -translate-x-1/2 rtl:translate-x-1/2"
          style={{ insetInlineStart: `${shown * 100}%`, transition: `inset-inline-start ${transition}` }}
          aria-hidden
        >
          <div className="w-3 h-3 bg-primary-light rotate-45 rounded-[2px] shadow-[0_0_10px_var(--color-primary)]" />
        </div>

        {/* Track */}
        <div className="relative h-7 rounded-full bg-track border border-primary/25 overflow-hidden shadow-[inset_0_2px_8px_rgb(0_0_0/var(--shade))]">
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
        <div className="relative h-12 mt-1.5">
          {milestoneFractions(config.visualization.milestones).map((f, i) => {
            // End labels align inward so long localized labels never leave the screen.
            const edge = f === 0 ? 'start' : f === 1 ? 'end' : null;
            return (
              <div
                key={f}
                className={`absolute top-0 flex flex-col ${
                  edge === 'start' ? 'items-start' : edge === 'end' ? 'items-end' : 'items-center -translate-x-1/2 rtl:translate-x-1/2'
                }`}
                style={edge === 'end' ? { insetInlineEnd: 0 } : { insetInlineStart: `${f * 100}%` }}
              >
                {/* Alternate labels drop to a second row so long localized numbers never collide. */}
                <div className={`w-px ${i % 2 ? 'h-[1.15rem]' : 'h-2'} ${f <= shown ? 'bg-primary' : 'bg-text-muted/50'}`} />
                <span className={`text-[0.68rem] font-bold whitespace-nowrap ${f <= ratio ? 'text-primary' : 'text-text-muted'}`}>
                  {formatCompact(target * f, lang)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
