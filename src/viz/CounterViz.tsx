import { useEffect, useState } from 'react';
import { formatNumber, formatPercent, type Lang } from '../lib/format';
import { EASE, useEntrance, type VizProps } from './common';

const digitGlyphs = (lang: Lang) => Array.from({ length: 10 }, (_, d) => formatNumber(d, lang));

function Roller({ digit, glyphs, delay }: { digit: number; glyphs: string[]; delay: number }) {
  return (
    <span className="relative inline-block h-[1.15em] overflow-hidden align-bottom">
      <span
        className="viz-anim flex flex-col"
        style={{ transform: `translateY(${-digit * 1.15}em)`, transition: `transform 1.6s ${EASE} ${delay}ms` }}
      >
        {glyphs.map((g) => (
          <span key={g} className="h-[1.15em] leading-[1.15em] text-center">
            {g}
          </span>
        ))}
      </span>
    </span>
  );
}

/** Big rolling odometer of the remaining (or achieved) amount. */
export default function CounterViz({ score, target, ratio, lang, label, config, compact }: VizProps) {
  const value = config.visualization.counterMode === 'score' ? score : Math.max(target - score, 0);
  const glyphs = digitGlyphs(lang);
  const text = formatNumber(Math.round(value), lang);
  const shownRatio = useEntrance(ratio);

  // Start every digit at 0 so the counter rolls into place on mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const chars = text.split('');
  return (
    <div className="w-full max-w-[560px] mx-auto flex flex-col items-center">
      <div
        className={`goal-card flex items-end justify-center px-4 py-3 font-extrabold text-primary-light ${
          compact ? 'text-[1.9rem]' : 'text-[clamp(2.2rem,10vw,4.4rem)]'
        }`}
        style={{ direction: 'ltr', textShadow: '0 0 18px color-mix(in srgb, var(--color-primary) 55%, transparent)' }}
        aria-label={text}
      >
        {chars.map((ch, i) => {
          const d = glyphs.indexOf(ch);
          const key = chars.length - i; // keyed from the right so columns keep identity
          return d >= 0 ? (
            <Roller key={key} digit={mounted ? d : 0} glyphs={glyphs} delay={(chars.length - i) * 60} />
          ) : (
            <span key={`s${key}`} className="text-primary/70 mx-[0.02em]">
              {ch}
            </span>
          );
        })}
      </div>

      {label && <div className="mt-3 text-[1rem] font-bold text-primary">{label}</div>}

      <div className="w-full max-w-[360px] mt-4">
        <div className="h-2 rounded-full bg-track overflow-hidden">
          <div
            className="viz-anim h-full rounded-full bg-gradient-to-l rtl:bg-gradient-to-r from-primary-light to-primary-dark"
            style={{ width: `${shownRatio * 100}%`, transition: `width 1.8s ${EASE}` }}
          />
        </div>
        <div className="mt-1.5 text-center text-[0.8rem] text-text-muted" style={{ direction: 'ltr' }}>
          {formatPercent(ratio * 100, lang)}%
        </div>
      </div>
    </div>
  );
}
