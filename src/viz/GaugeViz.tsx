import { EASE, PercentReadout, formatCompact, milestoneFractions, useEntrance, useSvgId, type VizProps } from './common';

const CX = 150;
const CY = 150;
const R = 105;
const BAND = 24;
const NEEDLE = 88;
const ARC = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

const polar = (ratio: number, radius: number) => {
  const angle = Math.PI - ratio * Math.PI;
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
};

/** Speedometer-style half dial with an animated needle. */
export default function GaugeViz({ ratio, target, lang, label, config, compact }: VizProps) {
  const id = useSvgId('gauge');
  const shown = useEntrance(ratio);
  const inner = R - BAND / 2 - 7;

  return (
    <div className="w-full max-w-[460px] mx-auto">
      <svg viewBox="0 0 300 185" className="w-full h-auto overflow-visible" role="img" aria-label={label}>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: 'var(--color-primary-dark)' }} />
            <stop offset="30%" style={{ stopColor: 'var(--color-primary)' }} />
            <stop offset="55%" style={{ stopColor: 'var(--color-primary-light)' }} />
            <stop offset="80%" style={{ stopColor: 'var(--color-primary)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--color-primary-light)' }} />
          </linearGradient>
          <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path d={ARC} fill="none" strokeWidth={BAND + 8} style={{ stroke: 'color-mix(in srgb, var(--color-primary) 22%, var(--color-track))' }} />
        <path d={ARC} fill="none" strokeWidth={BAND + 6} style={{ stroke: 'var(--color-track)' }} />
        <path
          d={`M ${CX - inner} ${CY} A ${inner} ${inner} 0 0 1 ${CX + inner} ${CY}`}
          fill="none"
         
          strokeOpacity={0.35}
          strokeWidth={1.5} style={{ stroke: 'var(--color-primary)' }}
        />
        <path
          d={ARC}
          fill="none"
          stroke={`url(#${id}-fill)`}
          strokeWidth={BAND}
          pathLength={100}
          strokeDasharray="100 100"
          strokeDashoffset={100 - shown * 100}
          filter={compact ? undefined : `url(#${id}-glow)`}
          className="viz-anim"
          style={{ transition: `stroke-dashoffset 1.8s ${EASE}` }}
        />

        {milestoneFractions(config.visualization.milestones).map((f, i, all) => {
          const a = polar(f, R + BAND / 2 + 5);
          const b = polar(f, R + BAND / 2 + 13);
          const edge = i === 0 || i === all.length - 1;
          // End labels sit under the arc ends so long localized labels never leave the frame.
          const t = edge ? { x: CX + (f === 0 ? -R : R), y: CY + 20 } : polar(f, R + BAND / 2 + 26);
          return (
            <g key={f}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={edge ? 2 : 1.5} opacity={0.65} style={{ stroke: 'var(--color-primary)' }} />
              <text x={t.x} y={t.y + 3} fontSize="9" fontWeight="bold" textAnchor="middle" opacity={0.85} style={{ fill: 'var(--color-primary)' }}>
                {formatCompact(target * f, lang)}
              </text>
            </g>
          );
        })}

        <g transform={`translate(${CX} ${CY})`}>
          <g className="viz-anim" style={{ transform: `rotate(${-90 + shown * 180}deg)`, transition: `transform 1.8s ${EASE}` }}>
            <line x1={0} y1={0} x2={0} y2={-NEEDLE} strokeWidth="6" strokeLinecap="round" style={{ stroke: 'color-mix(in srgb, var(--color-primary) 35%, transparent)' }} />
            <polygon points={`-5,0 0,${-NEEDLE} 5,0`} fill={`url(#${id}-fill)`} strokeWidth="0.5" style={{ stroke: 'var(--color-primary-light)' }} />
          </g>
          <circle r="11" strokeWidth="2" style={{ fill: 'var(--color-surface)', stroke: 'var(--color-primary)' }} />
          <circle r="6" style={{ fill: 'var(--color-primary)' }} />
          <circle r="2.5" style={{ fill: 'var(--color-primary-light)' }} />
        </g>
      </svg>
      <div className="-mt-1">
        <PercentReadout ratio={ratio} lang={lang} label={label} size={compact ? 'md' : 'lg'} />
      </div>
    </div>
  );
}
