import { motion } from 'motion/react';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { formatPercent } from '../lib/format';
import { useSvgId, type VizProps } from './common';

const C = 120;
const INNER = 96;
const WAVE_PERIOD = 120;

/** Builds a periodic wave surface at y=0 that is filled downwards. */
function wavePath(amplitude: number) {
  let d = `M ${-2 * WAVE_PERIOD} 0`;
  for (let x = -2 * WAVE_PERIOD; x < 4 * WAVE_PERIOD; x += WAVE_PERIOD / 2) {
    const dir = (x / (WAVE_PERIOD / 2)) % 2 === 0 ? -1 : 1;
    d += ` Q ${x + WAVE_PERIOD / 4} ${dir * amplitude} ${x + WAVE_PERIOD / 2} 0`;
  }
  return `${d} L ${4 * WAVE_PERIOD} 400 L ${-2 * WAVE_PERIOD} 400 Z`;
}

const FRONT = wavePath(7);
const BACK = wavePath(5);

/** A sphere filling up with animated liquid. */
export default function LiquidViz({ ratio, lang, label, compact }: VizProps) {
  const id = useSvgId('liquid');
  const pct = useAnimatedNumber(ratio * 100, 1800);
  // Surface y: bottom of the sphere at 0%, top at 100% (with a little headroom for the wave).
  const level = C + INNER - ratio * (2 * INNER + 8);

  return (
    <div className="flex flex-col items-center">
      <div className={`relative ${compact ? 'w-[180px]' : 'w-[min(66vw,320px)]'} aspect-square`}>
        <svg viewBox="0 0 240 240" className="w-full h-full" role="img" aria-label={label}>
          <defs>
            <clipPath id={`${id}-clip`}>
              <circle cx={C} cy={C} r={INNER} />
            </clipPath>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--color-primary-light)' }} />
              <stop offset="55%" style={{ stopColor: 'var(--color-primary)' }} />
              <stop offset="100%" style={{ stopColor: 'var(--color-primary-dark)' }} />
            </linearGradient>
            <radialGradient id={`${id}-shine`} cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="white" stopOpacity="0.28" />
              <stop offset="60%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx={C} cy={C} r={INNER + 12} fill="none" strokeWidth={2} style={{ stroke: 'color-mix(in srgb, var(--color-primary) 45%, transparent)' }} />
          <circle cx={C} cy={C} r={INNER} style={{ fill: 'var(--color-track)' }} />

          <g clipPath={`url(#${id}-clip)`}>
            <motion.g initial={{ y: C + INNER + 10 }} animate={{ y: level }} transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}>
              <g opacity={0.45}>
                <path d={BACK} fill={`url(#${id}-fill)`} transform="translate(-40 -4)">
                  {!compact && (
                    <animateTransform attributeName="transform" type="translate" from="-40 -4" to={`${-40 - WAVE_PERIOD} -4`} dur="6s" repeatCount="indefinite" />
                  )}
                </path>
              </g>
              <path d={FRONT} fill={`url(#${id}-fill)`}>
                {!compact && (
                  <animateTransform attributeName="transform" type="translate" from="0 0" to={`${WAVE_PERIOD} 0`} dur="3.5s" repeatCount="indefinite" />
                )}
              </path>
            </motion.g>
          </g>
          <circle cx={C} cy={C} r={INNER} fill={`url(#${id}-shine)`} />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="font-extrabold text-text text-[clamp(1.9rem,7vw,2.8rem)] leading-none"
            style={{ direction: 'ltr', textShadow: '0 2px 12px var(--color-bg), 0 0 3px var(--color-bg)' }}
          >
            {formatPercent(pct, lang)}
            <span className="text-[0.55em] ms-1">%</span>
          </div>
        </div>
      </div>
      {label && <span className="text-[0.95rem] font-bold text-primary-light mt-3">{label}</span>}
    </div>
  );
}
