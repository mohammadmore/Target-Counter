/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import Background from './components/Background';
import MainView from './components/MainView';
import AdminView from './components/AdminView';
import { useScore } from './hooks/useScore';
import { Settings, Camera, Film, WifiOff } from 'lucide-react';
import { toPng } from 'html-to-image';
import { AnimatePresence, motion } from 'motion/react';
import type { Lang } from './lib/format';
import { t } from './i18n';

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && 'ontouchend' in document);

const initialLang = (): Lang => (new URLSearchParams(window.location.search).get('lang') === 'ar' ? 'ar' : 'fa');

export default function App() {
  const { score, target, loading, connectionError, save } = useScore();
  const [isAdmin, setIsAdmin] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showShutter, setShowShutter] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [shutterMsg, setShutterMsg] = useState('');
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  
  const [lang, setLang] = useState<Lang>(initialLang);
  const copy = t(lang);
  const appRef = useRef<HTMLDivElement>(null);
  const animationStartTime = useRef(Date.now());

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

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

  const flashMessage = (text: string, withShutter: boolean) => {
    setShutterMsg(text);
    setShowShutter(withShutter);
    setShowToast(true);
    setTimeout(() => {
      setShowShutter(false);
      setShowToast(false);
    }, 2500);
  };

  const handleCapture = async () => {
    if (!appRef.current || isCapturing) return;
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
        // iOS Safari crashes on very large canvases, so use a lower ratio there.
        pixelRatio: isIOS() ? 2 : 3,
        backgroundColor: '#060605',
      });

      if (isIOS()) {
        setPosterUrl(dataUrl);
      } else {
        const link = document.createElement('a');
        link.download = 'kianteam-vision.png';
        link.href = dataUrl;
        link.click();
        flashMessage(copy.posterSaved, true);
      }
    } catch (err) {
      console.error('Failed to capture poster:', err);
      flashMessage(copy.posterFailed, false);
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
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-40 min-h-[100dvh] flex flex-col gap-4 items-center justify-center" role="status">
            <div className="w-12 h-12 border-4 border-gold-1/30 border-t-gold-2 rounded-full animate-spin"></div>
            <p className="text-pearl-dim text-sm">{connectionError ? copy.connectionLost : copy.connecting}</p>
          </motion.div>
        ) : isAdmin ? (
          <motion.div key="admin" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.3 }} className="relative z-40 w-full">
            <AdminView score={score} target={target} save={save} onBack={() => setIsAdmin(false)} />
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
        {showToast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-[40px] left-1/2 -translate-x-1/2 z-[101] bg-black/80 border border-gold-1/30 text-gold-2 px-6 py-3 rounded-full font-medium backdrop-blur-md shadow-lg pointer-events-none whitespace-nowrap"
          >
            {shutterMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {connectionError && !loading && !isCapturing && (
        <div
          role="status"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-black/75 border border-red-400/40 text-red-200 text-xs px-3 py-1.5 rounded-full backdrop-blur-md"
        >
          <WifiOff size={14} />
          <span>{copy.connectionLost}</span>
        </div>
      )}

      {!isAdmin && !isCapturing && !loading && (
        <div className="fixed bottom-[18px] left-[18px] z-50 flex gap-3">
          <button 
            onClick={() => setIsAdmin(true)} 
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-gold-1/20 flex items-center justify-center text-gold-2/50 hover:text-gold-2 hover:bg-gold-1/10 transition-all hover:scale-110"
            title={copy.adminLogin}
            aria-label={copy.adminLogin}
          >
            <Settings size={18} strokeWidth={1.5} />
          </button>
          
          <button 
            onClick={toggleLang}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-gold-1/20 flex items-center justify-center text-gold-2/50 hover:text-gold-2 hover:bg-gold-1/10 transition-all hover:scale-110 font-bold text-[0.8rem]"
            title={copy.toggleLang}
            aria-label={copy.toggleLang}
          >
            {lang === 'fa' ? 'AR' : 'FA'}
          </button>
          
          <button 
            onClick={handleReplay}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-gold-1/20 flex items-center justify-center text-gold-2/50 hover:text-gold-2 hover:bg-gold-1/10 transition-all hover:scale-110"
            title={copy.replay}
            aria-label={copy.replay}
          >
            <Film size={18} strokeWidth={1.5} />
          </button>

          <button 
            onClick={handleCapture}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-gold-1/20 flex items-center justify-center text-gold-2/50 hover:text-gold-2 hover:bg-gold-1/10 transition-all hover:scale-110"
            title={copy.downloadPoster}
            aria-label={copy.downloadPoster}
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
                aria-label={copy.close}
                className="absolute top-2 right-3 text-gold-2/60 hover:text-gold-2 text-2xl"
              >
                &times;
              </button>
              <h3 className="text-gold-2 font-bold text-lg mt-2 text-center">
                {copy.posterReady}
              </h3>
              <p className="text-pearl/70 text-sm text-center">
                {copy.posterHint}
              </p>
              <img src={posterUrl} alt="Poster" className="w-full rounded-lg border border-gold-1/20 shadow-[0_0_15px_rgba(212,175,55,0.2)]" />
              <button 
                onClick={() => setPosterUrl(null)}
                className="w-full py-2.5 mt-2 rounded-xl bg-gold-2 text-bg-main font-bold hover:bg-gold-1 transition-colors"
              >
                {copy.close}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

