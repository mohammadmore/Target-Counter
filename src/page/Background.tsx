import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { GoalConfig } from '../goal/types';
import { assetUrl } from '../goal/theme';

/**
 * Themed page background. `contained` keeps it inside the parent (wizard
 * preview) instead of covering the viewport.
 */
export default function Background({ config, contained = false }: { config: GoalConfig; contained?: boolean }) {
  const { type, image, overlay, particles } = config.background;
  const [loadedSrc, setLoadedSrc] = useState('');
  const pos = contained ? 'absolute' : 'fixed';
  const src = type === 'image' ? assetUrl(image) : '';

  const dots = useMemo(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!particles || reduce) return [];
    return Array.from({ length: contained ? 14 : 26 }, (_, i) => ({
      id: i,
      size: 2 + Math.random() * 4,
      left: Math.random() * 100,
      duration: 9 + Math.random() * 10,
      delay: -Math.random() * 18,
      drift: Math.random() * 30 - 15,
      op: 0.35 + Math.random() * 0.5,
    }));
  }, [particles, contained]);

  return (
    <>
      <div
        className={`${pos} inset-0 z-0 pointer-events-none ${
          type === 'glow' || type === 'image' ? 'bg-glow' : type === 'gradient' ? 'bg-diagonal' : 'bg-bg'
        }`}
      />
      {src && (
        <>
          <img
            src={src}
            alt=""
            onLoad={() => setLoadedSrc(src)}
            className={`${pos} inset-0 w-full h-full object-cover z-10 pointer-events-none transition-opacity duration-[1500ms] ${
              loadedSrc === src ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`${pos} inset-0 z-20 pointer-events-none`}
            style={{
              background: `linear-gradient(to bottom,
                color-mix(in srgb, var(--color-bg) ${Math.round(overlay * 70)}%, transparent),
                color-mix(in srgb, var(--color-bg) ${Math.round(overlay * 100)}%, transparent) 50%,
                color-mix(in srgb, var(--color-bg) ${Math.round(Math.min(1, overlay * 1.2) * 100)}%, transparent))`,
            }}
          />
        </>
      )}
      {dots.length > 0 && (
        <div className={`${pos} inset-0 z-30 pointer-events-none overflow-hidden`}>
          {dots.map((p) => (
            <div
              key={p.id}
              className="particle absolute bottom-[-10px] rounded-full"
              style={
                {
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  left: `${p.left}%`,
                  animationDuration: `${p.duration}s`,
                  animationDelay: `${p.delay}s`,
                  '--drift': `${p.drift}px`,
                  '--op': p.op,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
