import { useEffect, useState } from 'react';
import ProgressRing from './ProgressRing';
import GoldGaugeChart from './GoldGaugeChart';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import { Gauge, Disc, LayoutGrid } from 'lucide-react';
import { formatNumber, type Lang } from '../lib/format';
import { t } from '../i18n';

type ViewMode = 'gauge' | 'ring' | 'all';

const CONFETTI_DELAY_MS = 4000; // let the ring/gauge animation finish first
const CONFETTI_DURATION_MS = 15_000;

export default function MainView({ score, target, lang }: { score: number; target: number; lang: Lang }) {
  const copy = t(lang);
  const safeTarget = target > 0 ? target : 1;
  const remaining = Math.max(safeTarget - score, 0);
  const goalReached = score >= safeTarget;
  const [showCelebration, setShowCelebration] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('gauge');

  useEffect(() => {
    if (!goalReached) {
      setShowCelebration(false);
      return;
    }

    let interval: ReturnType<typeof setInterval> | undefined;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const timer = setTimeout(() => {
      setShowCelebration(true);
      if (reduceMotion) return;

      const animationEnd = Date.now() + CONFETTI_DURATION_MS;
      const defaults = {
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        zIndex: 100,
        colors: ['#FFFFFF', '#E2E8F0', '#C0C0C0', '#D4AF37', '#FBBF24'],
      };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }
        const particleCount = 50 * (timeLeft / CONFETTI_DURATION_MS);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
    }, CONFETTI_DELAY_MS);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      confetti.reset();
    };
  }, [goalReached]);

  const modes: { id: ViewMode; icon: typeof Gauge; label: string }[] = [
    { id: 'gauge', icon: Gauge, label: copy.viewGauge(safeTarget) },
    { id: 'ring', icon: Disc, label: copy.viewRing },
    { id: 'all', icon: LayoutGrid, label: copy.viewAll },
  ];

  return (
    <div className="relative z-40 min-h-[100dvh] flex flex-col items-center justify-center px-[4vw] sm:px-[6vw] py-[4vh] pt-[calc(5vh+70px)] pb-24 text-center">
      
      {/* Sleek View Mode Switcher */}
      {!showCelebration && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-center gap-1 p-1 bg-black/65 border border-gold-1/30 rounded-full mb-6 backdrop-blur-md shadow-[0_0_20px_rgba(212,175,55,0.08)] z-30"
        >
          {modes.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setViewMode(id)}
              aria-pressed={viewMode === id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.78rem] sm:text-[0.82rem] font-bold transition-all cursor-pointer ${
                viewMode === id
                  ? 'bg-gradient-to-r from-gold-2 via-gold-1 to-gold-3 text-black shadow-[0_0_12px_rgba(212,175,55,0.45)]'
                  : 'text-pearl-dim/75 hover:text-gold-2 hover:bg-white/5'
              }`}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
        </motion.div>
      )}

      {/* Main Visualizer Stage */}
      <div className="relative w-full max-w-[500px] flex flex-col items-center justify-center min-h-[min(58vw,340px)]">
        
        {/* Celebration Text container */}
        <div className={`absolute inset-0 flex justify-center items-center transition-all duration-1000 delay-300 ease-in-out ${showCelebration ? 'opacity-100 scale-100 z-20' : 'opacity-0 scale-110 pointer-events-none'}`}>
          <AnimatePresence mode="wait">
            <motion.div 
              key={lang}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.3 }}
              className="text-[clamp(1.4rem,4vw,2.2rem)] leading-[1.8] font-medium text-pearl px-4 drop-shadow-md max-w-[700px] text-center"
            >
              <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-gold-2 to-gold-1 drop-shadow-[0_0_10px_rgba(212,175,55,0.4)]" style={{ WebkitBackgroundClip: 'text' }}>
                {copy.celebrationTitle}
              </span>
              <br/>
              {copy.celebrationLine1}
              <br/>
              {copy.celebrationLine2}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dynamic Display based on viewMode */}
        {!showCelebration && (
          <div className="w-full flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              {viewMode === 'gauge' && (
                <motion.div
                  key="gauge-only"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.35 }}
                  className="w-full"
                >
                  <GoldGaugeChart score={score} target={safeTarget} lang={lang} />
                </motion.div>
              )}

              {viewMode === 'ring' && (
                <motion.div
                  key="ring-only"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.35 }}
                  className="w-full"
                >
                  <ProgressRing score={score} target={safeTarget} lang={lang} />
                </motion.div>
              )}

              {viewMode === 'all' && (
                <motion.div
                  key="all-views"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35 }}
                  className="w-full flex flex-col items-center gap-8"
                >
                  <ProgressRing score={score} target={safeTarget} lang={lang} />
                  <div className="w-full pt-2">
                    <GoldGaugeChart score={score} target={safeTarget} lang={lang} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
      
      {/* Target Status & Vision Counter */}
      <div className="mt-[clamp(1.4rem,4vh,2.5rem)] w-full max-w-[480px] flex flex-col items-center gap-1 text-pearl">
        {goalReached ? (
          <div className={`transition-opacity duration-1000 ${showCelebration ? 'opacity-100 delay-700' : 'opacity-0'}`}>
            <AnimatePresence mode="wait">
              <motion.div 
                key={lang}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.3 }}
                className="text-[clamp(1.2rem,3.5vw,1.6rem)] font-bold text-transparent bg-clip-text bg-gradient-to-b from-pearl to-pearl-dim drop-shadow-sm mt-4"
              >
                {copy.afterGoal}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div 
              key={lang}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center w-full"
            >
              <div className="text-[clamp(1.7rem,4.5vw,2.3rem)] font-bold leading-tight">
                <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-gold-2 to-gold-1" style={{ WebkitBackgroundClip: 'text' }}>
                  {formatNumber(Math.round(remaining), lang)}
                </span>
                {' '}{copy.points}
              </div>
              <div className="text-[clamp(1.05rem,2.8vw,1.4rem)] font-medium leading-normal text-pearl/90">
                {copy.remainingTo(safeTarget)}
              </div>
              <div className="text-[clamp(0.9rem,2.4vw,1.15rem)] font-normal leading-normal text-pearl/75 mt-0.5">
                {copy.shareQuestion}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
