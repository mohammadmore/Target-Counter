import { useLayoutEffect, useRef, useState } from 'react';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { dirOf, formatNumber } from '../lib/format';
import { EASE, PercentReadout, formatCompact, milestoneFractions, useEntrance, type VizProps } from './common';

const W = 340;
const PATH = 'M 22 172 C 110 172, 92 98, 170 102 S 248 34, 318 34';

type Point = { x: number; y: number };

/** A road with checkpoints; the team marker travels along it. */
export default function JourneyViz({ ratio, target, lang, label, config, compact }: VizProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);
  const shown = useEntrance(ratio);
  const travelled = useAnimatedNumber(ratio, 1800);
  const rtl = dirOf(lang) === 'rtl';

  useLayoutEffect(() => {
    if (pathRef.current) setLength(pathRef.current.getTotalLength());
  }, []);

  const pointAt = (f: number): Point => {
    if (!pathRef.current || !length) return { x: 0, y: 0 };
    const p = pathRef.current.getPointAtLength(Math.max(0, Math.min(1, f)) * length);
    return { x: p.x, y: p.y };
  };
  // Text is drawn outside the mirrored group so it never reads backwards.
  const mx = (x: number) => (rtl ? W - x : x);

  const fractions = milestoneFractions(config.visualization.milestones);
  const marker = pointAt(travelled);

  return (
    <div className="w-full max-w-[520px] mx-auto">
      <svg viewBox={`0 0 ${W} 215`} className="w-full h-auto overflow-visible" role="img" aria-label={label}>
        <g transform={rtl ? `translate(${W} 0) scale(-1 1)` : undefined}>
          <path d={PATH} fill="none" strokeWidth={16} strokeLinecap="round" style={{ stroke: 'var(--color-track)' }} />
          <path d={PATH} fill="none" strokeWidth={2} strokeDasharray="6 8" strokeLinecap="round" style={{ stroke: 'color-mix(in srgb, var(--color-text-muted) 45%, transparent)' }} />
          <path
            ref={pathRef}
            d={PATH}
            fill="none"
            strokeWidth={10}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100 100"
            strokeDashoffset={100 - shown * 100}
            className="viz-anim"
            style={{ stroke: 'var(--color-primary)', transition: `stroke-dashoffset 1.8s ${EASE}`, filter: 'drop-shadow(0 0 6px color-mix(in srgb, var(--color-primary) 60%, transparent))' }}
          />
          {length > 0 &&
            fractions.map((f, i) => {
              const p = pointAt(f);
              const reached = f <= ratio + 1e-9;
              const last = i === fractions.length - 1;
              return (
                <g key={f} transform={`translate(${p.x} ${p.y})`}>
                  <circle
                    r={last ? 13 : 10}
                    strokeWidth={2.5}
                    style={{ fill: reached ? 'var(--color-primary)' : 'var(--color-surface)', stroke: reached ? 'var(--color-primary-light)' : 'var(--color-primary)' }}
                  />
                  {reached && <path d="M -4.5 0.5 L -1.2 3.8 L 4.8 -3.2" fill="none" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--color-bg)' }} />}
                </g>
              );
            })}
          {length > 0 && (
            <g transform={`translate(${marker.x} ${marker.y})`}>
              {!compact && (
                <circle r={9} fill="none" strokeWidth={2} style={{ stroke: 'var(--color-primary-light)' }}>
                  <animate attributeName="r" from="9" to="22" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.9" to="0" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
              <circle r={8} strokeWidth={3} style={{ fill: 'var(--color-primary-light)', stroke: 'var(--color-bg)' }} />
            </g>
          )}
        </g>

        {length > 0 &&
          fractions.map((f, i) => {
            const p = pointAt(f);
            const reached = f <= ratio + 1e-9;
            return (
              <g key={f}>
                {!reached && (
                  <text x={mx(p.x)} y={p.y + 4} fontSize="10" fontWeight="bold" textAnchor="middle" style={{ fill: 'var(--color-primary)' }}>
                    {formatNumber(i, lang)}
                  </text>
                )}
                <text x={mx(p.x)} y={p.y + (i % 2 === 0 ? 30 : -20)} fontSize="10" fontWeight="bold" textAnchor="middle" style={{ fill: reached ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                  {formatCompact(target * f, lang)}
                </text>
              </g>
            );
          })}
      </svg>
      <div className="mt-2">
        <PercentReadout ratio={ratio} lang={lang} label={label} size={compact ? 'md' : 'lg'} />
      </div>
    </div>
  );
}
