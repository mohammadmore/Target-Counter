import { useEffect, useState } from 'react';
import ProgressRing from './ProgressRing';
import GoldGaugeChart from './GoldGaugeChart';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import { Gauge, Disc, LayoutGrid } from 'lucide-react';

export default function MainView({ score, target, lang }: { score: number; target: number, lang: 'fa' | 'ar' }) {
  const safeTarget = target > 0 ? target : 60000000;
  const remaining = Math.max(safeTarget - score, 0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [viewMode, setViewMode] = useState<'gauge' | 'ring' | 'all'>('gauge');

  useEffect(() => {
    if (score >= safeTarget && safeTarget > 0) {
      const timer = setTimeout(() => {
        setShowCelebration(true);
        // Fire confetti
        const duration = 15 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { 
          startVelocity: 30, 
          spread: 360, 
          ticks: 60, 
          zIndex: 100,
          colors: ['#FFFFFF', '#E2E8F0', '#C0C0C0', '#D4AF37', '#FBBF24']
        };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function() {
          const timeLeft = animationEnd - Date.now();
          if (timeLeft <= 0) {
            return clearInterval(interval);
          }
          const particleCount = 50 * (timeLeft / duration);
          confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
          confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
        }, 250);
      }, 4000); // Wait 2s for ring animation + 2s extra

      return () => clearTimeout(timer);
    } else {
      setShowCelebration(false);
    }
  }, [score, safeTarget]);

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
          <button
            type="button"
            onClick={() => setViewMode('gauge')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.78rem] sm:text-[0.82rem] font-bold transition-all cursor-pointer ${
              viewMode === 'gauge'
                ? 'bg-gradient-to-r from-gold-2 via-gold-1 to-gold-3 text-black shadow-[0_0_12px_rgba(212,175,55,0.45)]'
                : 'text-pearl-dim/75 hover:text-gold-2 hover:bg-white/5'
            }`}
          >
            <Gauge size={14} />
            <span>{lang === 'fa' ? 'گیج تارگت ۶۰M' : 'مقياس 60M'}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('ring')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.78rem] sm:text-[0.82rem] font-bold transition-all cursor-pointer ${
              viewMode === 'ring'
                ? 'bg-gradient-to-r from-gold-2 via-gold-1 to-gold-3 text-black shadow-[0_0_12px_rgba(212,175,55,0.45)]'
                : 'text-pearl-dim/75 hover:text-gold-2 hover:bg-white/5'
            }`}
          >
            <Disc size={14} />
            <span>{lang === 'fa' ? 'حلقه سفیر' : 'حلقة السفير'}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.78rem] sm:text-[0.82rem] font-bold transition-all cursor-pointer ${
              viewMode === 'all'
                ? 'bg-gradient-to-r from-gold-2 via-gold-1 to-gold-3 text-black shadow-[0_0_12px_rgba(212,175,55,0.45)]'
                : 'text-pearl-dim/75 hover:text-gold-2 hover:bg-white/5'
            }`}
          >
            <LayoutGrid size={14} />
            <span>{lang === 'fa' ? 'نمای کامل' : 'عرض شامل'}</span>
          </button>
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
                {lang === 'fa' ? 'سفیر مروارید کیان تیم' : 'سفير لؤلؤة فريق كيان'}
              </span>
              <br/>
              {lang === 'fa' ? 'با همت و تلاش اعضای هدفمند' : 'بفضل جهود ومساعي الأعضاء الهادفين'}
              <br/>
              {lang === 'fa' ? 'این خانواده تیک شد' : 'في هذه العائلة تم تحقيقه'}
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
        {remaining <= 0 ? (
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
                {lang === 'fa' ? 'پیش به سوی تکثیر سفیر مروارید' : 'نحو مضاعفة سفراء اللؤلؤ'}
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
                  {Math.round(remaining).toLocaleString(lang === 'ar' ? 'ar-EG' : 'fa-IR')}
                </span>
                {' '}{lang === 'fa' ? 'امتیاز' : 'نقطة'}
              </div>
              <div className="text-[clamp(1.05rem,2.8vw,1.4rem)] font-medium leading-normal text-pearl/90">
                {lang === 'fa' ? 'مانده تا سفیر مروارید کیان‌تیم (۶۰,۰۰۰,۰۰۰)' : 'متبقي للوصول إلى سفير لؤلؤة كيان (60,000,000)'}
              </div>
              <div className="text-[clamp(0.9rem,2.4vw,1.15rem)] font-normal leading-normal text-pearl/75 mt-0.5">
                {lang === 'fa' ? 'سهم تیم تو از این ویژن مشترک چقدره؟!' : 'ما هي حصة فريقك من هذه الرؤية المشتركة؟!'}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
