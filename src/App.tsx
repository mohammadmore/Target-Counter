/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import Background from './components/Background';
import MainView from './components/MainView';
import AdminView from './components/AdminView';
import { useScore } from './hooks/useScore';
import { Settings, Camera, Film, Globe } from 'lucide-react';
import { toPng } from 'html-to-image';
import { AnimatePresence, motion } from 'motion/react';

type Lang = 'fa' | 'ar';

export default function App() {
  const { score, setScore, target, loading } = useScore();
  const [isAdmin, setIsAdmin] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showShutter, setShowShutter] = useState(false);
  const [shutterMsg, setShutterMsg] = useState('');
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  
  const [lang, setLang] = useState<Lang>('fa');
  const appRef = useRef<HTMLDivElement>(null);
  const animationStartTime = useRef(Date.now());

  useEffect(() => {
    // Read initial lang from URL query param
    const params = new URLSearchParams(window.location.search);
    if (params.get('lang') === 'ar') {
      setLang('ar');
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      animationStartTime.current = Date.now();
    }
  }, [loading]);

  const toggleLang = () => {
    const newLang = lang === 'fa' ? 'ar' : 'fa';
    setLang(newLang);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', newLang);
    window.history.replaceState(null, '', url.toString());
  };

  const handleCapture = async () => {
    if (!appRef.current) return;
    try {
      setIsCapturing(true);
      // Wait for UI to hide buttons before capturing
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const timeElapsed = Date.now() - animationStartTime.current;
      if (timeElapsed < 2000) {
        await new Promise(resolve => setTimeout(resolve, 2000 - timeElapsed));
      }
      
      const dataUrl = await toPng(appRef.current, {
        cacheBust: true,
        pixelRatio: 3, // High quality for poster
        backgroundColor: '#060605'
      });
      
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
      
      if (isIOS) {
        setPosterUrl(dataUrl);
      } else {
        const link = document.createElement('a');
        link.download = 'kianteam-vision.png';
        link.href = dataUrl;
        link.click();
        setShowShutter(true);
        setShutterMsg(lang === 'fa' ? 'تصویر با موفقیت ذخیره شد' : 'تم حفظ الصورة بنجاح');
        setTimeout(() => setShowShutter(false), 2500);
      }

    } catch (err) {
      console.error('Failed to capture poster:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleReplay = () => {
    setReplayKey(prev => prev + 1);
    animationStartTime.current = Date.now();
  };

  return (
    <div ref={appRef} className="relative min-h-[100dvh] text-pearl bg-bg-main font-vazirmatn overflow-x-hidden selection:bg-gold-1/30 selection:text-gold-2" dir="rtl">
      <Background />
      
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-40 min-h-[100dvh] flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-gold-1/30 border-t-gold-2 rounded-full animate-spin"></div>
          </motion.div>
        ) : isAdmin ? (
          <motion.div key="admin" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }} className="relative z-40 w-full">
            <AdminView 
              score={score} 
              setScore={setScore} 
              target={target} 
              onBack={() => setIsAdmin(false)} 
            />
          </motion.div>
        ) : (
          <motion.div key={`main-${replayKey}`} initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.4 }} className="relative z-40 w-full">
            <MainView score={score} target={target} lang={lang} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShutter && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: [1, 0] }} 
            transition={{ duration: 0.5, ease: "easeOut" }} 
            className="fixed inset-0 z-[100] bg-white pointer-events-none"
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showShutter && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-[40px] left-1/2 -translate-x-1/2 z-[101] bg-black/80 border border-gold-1/30 text-gold-2 px-6 py-3 rounded-full font-medium backdrop-blur-md shadow-lg pointer-events-none whitespace-nowrap"
          >
            {shutterMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {!isAdmin && !isCapturing && !loading && (
        <div className="fixed bottom-[18px] left-[18px] z-50 flex gap-3">
          <button 
            onClick={() => setIsAdmin(true)} 
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-gold-1/20 flex items-center justify-center text-gold-2/50 hover:text-gold-2 hover:bg-gold-1/10 transition-all hover:scale-110"
            title={lang === 'fa' ? "ورود مدیر" : "دخول المسؤول"}
            aria-label="Admin"
          >
            <Settings size={18} strokeWidth={1.5} />
          </button>
          
          <button 
            onClick={toggleLang}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-gold-1/20 flex items-center justify-center text-gold-2/50 hover:text-gold-2 hover:bg-gold-1/10 transition-all hover:scale-110 font-bold text-[0.8rem]"
            title={lang === 'fa' ? "تغییر زبان به عربی" : "تغيير اللغة إلى الفارسية"}
            aria-label="Toggle Language"
          >
            {lang === 'fa' ? 'AR' : 'FA'}
          </button>
          
          <button 
            onClick={handleReplay}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-gold-1/20 flex items-center justify-center text-gold-2/50 hover:text-gold-2 hover:bg-gold-1/10 transition-all hover:scale-110"
            title={lang === 'fa' ? "پخش مجدد انیمیشن" : "إعادة تشغيل الحركة"}
            aria-label="Replay"
          >
            <Film size={18} strokeWidth={1.5} />
          </button>

          <button 
            onClick={handleCapture}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-gold-1/20 flex items-center justify-center text-gold-2/50 hover:text-gold-2 hover:bg-gold-1/10 transition-all hover:scale-110"
            title={lang === 'fa' ? "دانلود پوستر با کیفیت" : "تحميل ملصق عالي الجودة"}
            aria-label="Download Poster"
          >
            <Camera size={18} strokeWidth={1.5} />
          </button>
        </div>
      )}

      <AnimatePresence>
        {posterUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
          >
            <div className="relative max-w-sm w-full bg-bg-soft border border-gold-1/30 rounded-2xl p-4 flex flex-col items-center gap-4">
              <button 
                onClick={() => setPosterUrl(null)}
                className="absolute top-2 right-3 text-gold-2/60 hover:text-gold-2 text-2xl"
              >
                &times;
              </button>
              <h3 className="text-gold-2 font-bold text-lg mt-2 text-center">
                {lang === 'fa' ? 'پوستر شما آماده است' : 'الملصق الخاص بك جاهز'}
              </h3>
              <p className="text-pearl/70 text-sm text-center">
                {lang === 'fa' 
                  ? 'روی تصویر زیر نگه دارید (Long Press) و گزینه Save Image را بزنید تا در گالری ذخیره شود.'
                  : 'اضغط باستمرار على الصورة أدناه وحدد حفظ الصورة لحفظها.'}
              </p>
              <img src={posterUrl} alt="Poster" className="w-full rounded-lg border border-gold-1/20 shadow-[0_0_15px_rgba(212,175,55,0.2)]" />
              <button 
                onClick={() => setPosterUrl(null)}
                className="w-full py-2.5 mt-2 rounded-xl bg-gold-2 text-bg-main font-bold hover:bg-gold-1 transition-colors"
              >
                {lang === 'fa' ? 'بستن' : 'إغلاق'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

