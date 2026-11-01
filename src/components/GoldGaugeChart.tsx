import { useEffect, useState } from 'react';
import { Target, Award, TrendingUp, Sparkles } from 'lucide-react';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { formatMillions, formatNumber, formatPercent, type Lang } from '../lib/format';
import { t } from '../i18n';

interface GoldGaugeChartProps {
  score: number;
  target: number;
  lang: Lang;
}

// SVG geometry (viewBox 0 0 300 185): semicircle centred on the pivot.
const CX = 150;
const CY = 150;
const R = 105; // centre line of the progress band
const BAND = 24;
const NEEDLE = 88;
const ARC = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
const MILESTONES = [0, 0.25, 0.5, 0.75, 1];

const polar = (ratio: number, radius: number) => {
  const angle = Math.PI - ratio * Math.PI; // 0% = left, 100% = right
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
};

/** Starts at 0 and follows `value` on the next frames so CSS transitions animate it. */
function useDeferredRatio(value: number) {
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

export default function GoldGaugeChart({ score, target, lang }: GoldGaugeChartProps) {
  const copy = t(lang);
  const safeTarget = target > 0 ? target : 1;
  const clampedScore = Math.max(0, score);
  const ratio = Math.min(clampedScore / safeTarget, 1);
  const remaining = Math.max(safeTarget - clampedScore, 0);

  const shownRatio = useDeferredRatio(ratio);
  const displayPct = useAnimatedNumber(ratio * 100, 1800);

  return (
    <div className="w-full max-w-[460px] mx-auto bg-[#0a0907]/85 border border-gold-1/30 rounded-3xl p-5 shadow-[0_0_40px_rgba(212,175,55,0.08)] backdrop-blur-xl relative overflow-hidden">
      {/* Subtle luxury ambient lighting */}
      <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-40 bg-gold-1/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-gold-1/20 pb-3 mb-2 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gold-1/15 border border-gold-1/30 flex items-center justify-center text-gold-2">
            <Target size={16} />
          </div>
          <div className="text-right">
            <h3 className="text-[0.95rem] font-bold text-transparent bg-clip-text bg-gradient-to-r from-gold-2 via-gold-1 to-gold-3">
              {copy.gaugeTitle}
            </h3>
            <p className="text-[0.72rem] text-pearl-dim/80">{copy.gaugeSubtitle(safeTarget)}</p>
          </div>
        </div>

        <div className="px-2.5 py-1 rounded-full bg-gold-1/10 border border-gold-1/25 flex items-center gap-1.5 text-gold-2 text-[0.75rem] font-bold dir-ltr">
          <Sparkles size={12} className="animate-pulse" />
          <span>{formatPercent(ratio * 100, lang)}%</span>
        </div>
      </div>

      {/* Gauge */}
      <div className="relative w-full mt-3">
        <svg
          viewBox="0 0 300 185"
          className="w-full h-auto overflow-visible"
          role="img"
          aria-label={`${formatPercent(ratio * 100, lang)}%`}
        >
          <defs>
            <linearGradient id="gaugeGoldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#9b7325" />
              <stop offset="25%" stopColor="#d4af37" />
              <stop offset="50%" stopColor="#fff4cc" />
              <stop offset="75%" stopColor="#d4af37" />
              <stop offset="100%" stopColor="#f3cc5c" />
            </linearGradient>
            <linearGradient id="gaugeTrackGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1a1610" />
              <stop offset="50%" stopColor="#292013" />
              <stop offset="100%" stopColor="#1a1610" />
            </linearGradient>
            <filter id="gaugeGoldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track with thin border */}
          <path d={ARC} fill="none" stroke="#3a2e17" strokeWidth={BAND + 8} />
          <path d={ARC} fill="none" stroke="url(#gaugeTrackGrad)" strokeWidth={BAND + 6} />
          {/* Decorative inner gold rail */}
          <path
            d={`M ${CX - (R - BAND / 2 - 7)} ${CY} A ${R - BAND / 2 - 7} ${R - BAND / 2 - 7} 0 0 1 ${CX + (R - BAND / 2 - 7)} ${CY}`}
            fill="none"
            stroke="#d4af37"
            strokeOpacity={0.35}
            strokeWidth={1.5}
          />

          {/* Progress band */}
          <path
            d={ARC}
            fill="none"
            stroke="url(#gaugeGoldGrad)"
            strokeWidth={BAND}
            pathLength={100}
            strokeDasharray="100 100"
            strokeDashoffset={100 - shownRatio * 100}
            filter="url(#gaugeGoldGlow)"
            className="gauge-anim"
            style={{ transition: 'stroke-dashoffset 1.8s cubic-bezier(0.22, 1, 0.36, 1)' }}
          />

          {/* Milestones */}
          {MILESTONES.map((pct, idx) => {
            const a = polar(pct, R + BAND / 2 + 5);
            const b = polar(pct, R + BAND / 2 + 13);
            const label = polar(pct, R + BAND / 2 + 25);
            const isEdge = idx === 0 || idx === MILESTONES.length - 1;
            return (
              <g key={pct}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#d4af37" strokeWidth={isEdge ? 2 : 1.5} opacity={0.65} />
                <text
                  x={label.x}
                  y={label.y + 3}
                  fill="#d4af37"
                  fontSize="9.5"
                  fontWeight="bold"
                  textAnchor="middle"
                  opacity={0.8}
                  className="select-none"
                  style={{ direction: 'ltr' }}
                >
                  {pct === 0 ? formatNumber(0, lang) : formatMillions(safeTarget * pct, lang)}
                </text>
              </g>
            );
          })}

          {/* Needle */}
          <g transform={`translate(${CX} ${CY})`}>
            <g
              className="gauge-anim"
              style={{
                transform: `rotate(${-90 + shownRatio * 180}deg)`,
                transition: 'transform 1.8s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <line x1={0} y1={0} x2={0} y2={-NEEDLE} stroke="rgba(212, 175, 55, 0.35)" strokeWidth="6" strokeLinecap="round" />
              <polygon
                points={`-5,0 0,${-NEEDLE} 5,0`}
                fill="url(#gaugeGoldGrad)"
                stroke="#ffe899"
                strokeWidth="0.5"
                style={{ filter: 'drop-shadow(0 0 4px rgba(212,175,55,0.7))' }}
              />
            </g>
            <circle r="11" fill="#140f07" stroke="#d4af37" strokeWidth="2" />
            <circle r="6" fill="#d4af37" />
            <circle r="2.5" fill="#fff9e6" />
          </g>
        </svg>

        {/* Live percentage readout */}
        <div className="flex flex-col items-center pointer-events-none -mt-1">
          <div
            className="text-[1.65rem] sm:text-[1.85rem] font-extrabold leading-none text-transparent bg-clip-text bg-gradient-to-b from-gold-2 via-gold-1 to-gold-3 drop-shadow-[0_0_12px_rgba(212,175,55,0.4)] dir-ltr"
            style={{ WebkitBackgroundClip: 'text' }}
          >
            {formatPercent(displayPct, lang)}
            <span className="text-[0.65em] font-bold text-gold-2 ml-1">%</span>
          </div>
          <span className="text-[0.72rem] font-medium text-pearl-dim/90 mt-1">{copy.progressTowards(safeTarget)}</span>
        </div>
      </div>

      {/* Target breakdown */}
      <div className="grid grid-cols-2 gap-2.5 mt-3 pt-3 border-t border-gold-1/15 relative z-10">
        <div className="bg-black/40 border border-gold-1/20 rounded-xl p-2.5 text-center flex flex-col items-center">
          <div className="flex items-center gap-1 text-[0.72rem] text-gold-2/80 mb-0.5">
            <TrendingUp size={12} />
            <span>{copy.achieved}</span>
          </div>
          <div className="text-[0.95rem] font-bold text-pearl dir-ltr">{formatNumber(clampedScore, lang)}</div>
        </div>

        <div className="bg-black/40 border border-gold-1/20 rounded-xl p-2.5 text-center flex flex-col items-center">
          <div className="flex items-center gap-1 text-[0.72rem] text-pearl-dim mb-0.5">
            <Award size={12} />
            <span>{copy.remaining}</span>
          </div>
          <div className="text-[0.95rem] font-bold text-gold-2 dir-ltr">{formatNumber(remaining, lang)}</div>
        </div>
      </div>

      <div className="mt-2.5 text-center">
        <span className="text-[0.68rem] text-pearl-dim/60 tracking-wider font-light">{copy.gaugeFooter(safeTarget)}</span>
      </div>
    </div>
  );
}
