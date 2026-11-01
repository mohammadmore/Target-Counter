import { motion, AnimatePresence } from 'motion/react';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { formatPercent, type Lang } from '../lib/format';
import { t } from '../i18n';

export default function ProgressRing({ score, target, lang }: { score: number; target: number; lang: Lang }) {
  const R = 85;
  const CIRC = 2 * Math.PI * R;
  const ratio = target > 0 ? Math.max(0, Math.min(score / target, 1)) : 0;
  const displayPct = useAnimatedNumber(ratio * 100);

  const ringText = 'KIYAN PEARL AMBASSADORS • '.repeat(3);

  return (
    <div className="relative w-[min(58vw,340px)] aspect-square mx-auto">
      {/* Decorative Rings */}
      <div className="absolute -inset-4 rounded-full border border-gold-1/35" />
      <div className="absolute -inset-8 rounded-full border border-gold-1/15" />

      <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-gold-2)" />
            <stop offset="20%" stopColor="var(--color-gold-1)" />
            <stop offset="45%" stopColor="#fff9e6" />
            <stop offset="65%" stopColor="var(--color-gold-3)" />
            <stop offset="85%" stopColor="var(--color-gold-1)" />
            <stop offset="100%" stopColor="var(--color-gold-2)" />
            <animateTransform
              attributeName="gradientTransform"
              type="rotate"
              from="0 0.5 0.5"
              to="360 0.5 0.5"
              dur="3.5s"
              repeatCount="indefinite"
            />
          </linearGradient>
          
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <circle className="stroke-ring-track" cx="100" cy="100" r={R} strokeWidth="14" fill="none" />
        <motion.circle
          cx="100" cy="100" r={R} strokeWidth="14" fill="none"
          stroke="url(#goldGrad)"
          strokeLinecap="butt"
          strokeDasharray={CIRC}
          initial={{ strokeDashoffset: CIRC }}
          animate={{ strokeDashoffset: CIRC - ratio * CIRC }}
          transition={{ duration: 1.9, ease: "easeOut" }}
          transform="rotate(-90 100 100)"
          filter="url(#glow)"
        />
      </svg>
      
      {/* Rotating SVG Text */}
      <div className="absolute top-1/2 left-1/2 w-[113%] h-[113%] max-w-none -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={lang}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.9 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full h-full"
          >
            <svg viewBox="-5 -5 210 210" className="w-full h-full animate-[spin_30s_linear_infinite]">
              <defs>
                <filter id="textGlow">
                  <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <path id={`textPath-${lang}`} d="M 100, 100 m -93, 0 a 93,93 0 1,1 186,0 a 93,93 0 1,1 -186,0" fill="transparent" />
              <text fill="#d4af37" fontWeight="700" filter="url(#textGlow)" className="text-[12.2px] font-bold tracking-[6px] uppercase" style={{ direction: 'ltr' }}>
                <textPath href={`#textPath-${lang}`} startOffset="0%" textLength="584" lengthAdjust="spacingAndGlyphs">
                  {ringText}
                </textPath>
              </text>
            </svg>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div 
            key={lang}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="relative flex flex-col items-center justify-center mb-[15%]"
          >
            <div className="font-extrabold text-[clamp(2.1rem,7vw,3.4rem)] leading-none text-transparent bg-clip-text bg-gradient-to-b from-gold-2 via-gold-1 to-gold-3" style={{ WebkitBackgroundClip: 'text', direction: 'ltr' }}>
              {formatPercent(displayPct, lang)}
              <span className="text-[0.5em] font-bold">%</span>
            </div>
            <div className="absolute top-[106%] mt-[0.2rem] text-[clamp(1.35rem,2.7vw,1.65rem)] text-gold-2 drop-shadow-sm flex flex-col items-center leading-tight font-extrabold whitespace-nowrap">
              {t(lang).ambassador.map((word) => (
                <span key={word}>{word}</span>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
