import { motion } from 'motion/react';
import { PercentReadout, useSvgId, type VizProps } from './common';

const R = 85;
const CIRC = 2 * Math.PI * R;

/** Donut ring with an optional rotating text band around it. */
export default function RingViz({ ratio, lang, label, config, compact }: VizProps) {
  const id = useSvgId('ring');
  const ringText = config.visualization.ringText.trim();
  const repeated = ringText ? `${ringText} • `.repeat(Math.max(1, Math.round(60 / (ringText.length + 3)))) : '';

  return (
    <div className="relative w-[min(62vw,320px)] aspect-square mx-auto my-6">
      <div className="absolute -inset-4 rounded-full border border-primary/35" />
      <div className="absolute -inset-8 rounded-full border border-primary/15" />

      <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible" role="img" aria-label={label}>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'var(--color-primary-light)' }} />
            <stop offset="25%" style={{ stopColor: 'var(--color-primary)' }} />
            <stop offset="50%" style={{ stopColor: 'var(--color-primary-light)' }} />
            <stop offset="75%" style={{ stopColor: 'var(--color-primary-dark)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--color-primary-light)' }} />
            {!compact && (
              <animateTransform attributeName="gradientTransform" type="rotate" from="0 0.5 0.5" to="360 0.5 0.5" dur="3.5s" repeatCount="indefinite" />
            )}
          </linearGradient>
          <filter id={`${id}-glow`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="100" cy="100" r={R} strokeWidth="14" fill="none" style={{ stroke: 'var(--color-track)' }} />
        <motion.circle
          cx="100"
          cy="100"
          r={R}
          strokeWidth="14"
          fill="none"
          stroke={`url(#${id}-fill)`}
          strokeDasharray={CIRC}
          initial={{ strokeDashoffset: CIRC }}
          animate={{ strokeDashoffset: CIRC - ratio * CIRC }}
          transition={{ duration: 1.9, ease: 'easeOut' }}
          transform="rotate(-90 100 100)"
          filter={compact ? undefined : `url(#${id}-glow)`}
        />
      </svg>

      {repeated && (
        <div className="absolute top-1/2 left-1/2 w-[113%] h-[113%] -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-90">
          <svg viewBox="-5 -5 210 210" className={`w-full h-full ${compact ? '' : 'animate-[spin_30s_linear_infinite]'}`}>
            <path id={`${id}-path`} d="M 100, 100 m -93, 0 a 93,93 0 1,1 186,0 a 93,93 0 1,1 -186,0" fill="transparent" />
            <text fontWeight="700" fontSize="12" letterSpacing="5" style={{ direction: 'ltr', fill: 'var(--color-primary)' }}>
              <textPath href={`#${id}-path`} textLength="584" lengthAdjust="spacingAndGlyphs">
                {repeated}
              </textPath>
            </text>
          </svg>
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <PercentReadout ratio={ratio} lang={lang} label={label} size={compact ? 'md' : 'lg'} />
      </div>
    </div>
  );
}
