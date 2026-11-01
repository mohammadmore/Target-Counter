import { motion } from 'motion/react';
import { dirOf } from '../lib/format';
import { PercentReadout, formatCompact, milestoneFractions, useSvgId, type VizProps } from './common';

const TOP = 20;
const BOTTOM = 262; // where the tube meets the bulb
const TUBE_X = 62;
const TUBE_W = 36;

/** Classic fundraising thermometer. */
export default function ThermometerViz({ ratio, target, lang, label, config, compact }: VizProps) {
  const id = useSvgId('thermo');
  const height = BOTTOM - TOP;
  const level = BOTTOM - ratio * height;
  // SVG text-anchor follows the writing direction: make labels always grow away from the tube.
  const labelAnchor = dirOf(lang) === 'rtl' ? 'end' : 'start';

  return (
    <div className="flex items-center justify-center gap-6 sm:gap-10 w-full max-w-[460px] mx-auto">
      <svg viewBox="0 0 200 330" className={`${compact ? 'h-[200px]' : 'h-[min(52vh,360px)]'} w-auto overflow-visible`} role="img" aria-label={label}>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" style={{ stopColor: 'var(--color-primary-dark)' }} />
            <stop offset="45%" style={{ stopColor: 'var(--color-primary-light)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--color-primary)' }} />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <rect x={TUBE_X} y={TOP} width={TUBE_W} height={height + 20} rx={TUBE_W / 2} />
            <circle cx={TUBE_X + TUBE_W / 2} cy={290} r={34} />
          </clipPath>
        </defs>

        {/* Glass */}
        <rect x={TUBE_X - 5} y={TOP - 5} width={TUBE_W + 10} height={height + 25} rx={(TUBE_W + 10) / 2} strokeOpacity={0.45} strokeWidth={2} style={{ fill: 'var(--color-track)', stroke: 'var(--color-primary)' }} />
        <circle cx={TUBE_X + TUBE_W / 2} cy={290} r={40} strokeOpacity={0.45} strokeWidth={2} style={{ fill: 'var(--color-track)', stroke: 'var(--color-primary)' }} />

        {/* Liquid */}
        <g clipPath={`url(#${id}-clip)`}>
          <circle cx={TUBE_X + TUBE_W / 2} cy={290} r={34} fill={`url(#${id}-fill)`} />
          <motion.rect
            x={TUBE_X}
            width={TUBE_W}
            initial={{ y: BOTTOM, height: 20 }}
            animate={{ y: level, height: BOTTOM - level + 20 }}
            transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
            fill={`url(#${id}-fill)`}
          />
          <rect x={TUBE_X + 7} y={TOP} width={6} height={height + 40} rx={3} fill="white" opacity={0.18} />
        </g>

        {/* Scale */}
        {milestoneFractions(config.visualization.milestones).map((f) => {
          const y = BOTTOM - f * height;
          return (
            <g key={f}>
              <line x1={TUBE_X + TUBE_W + 8} x2={TUBE_X + TUBE_W + 20} y1={y} y2={y} strokeWidth={1.5} style={{ stroke: 'var(--color-primary)' }} opacity={f <= ratio ? 1 : 0.45} />
              <text x={TUBE_X + TUBE_W + 26} y={y + 4} fontSize="12" fontWeight="bold" textAnchor={labelAnchor} style={{ fill: f <= ratio ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                {formatCompact(target * f, lang)}
              </text>
            </g>
          );
        })}
      </svg>
      <PercentReadout ratio={ratio} lang={lang} label={label} size={compact ? 'md' : 'lg'} />
    </div>
  );
}
