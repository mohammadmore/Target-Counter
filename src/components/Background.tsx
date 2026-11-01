import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import kiyanBg from '../assets/kiyanbg.jpg';

export default function Background() {
  const [particles, setParticles] = useState<{ id: number; size: number; left: number; duration: number; delay: number; drift: number; op: number }[]>([]);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const newParticles = Array.from({ length: 26 }).map((_, i) => ({
      id: i,
      size: 2 + Math.random() * 4,
      left: Math.random() * 100,
      duration: 9 + Math.random() * 10,
      delay: -Math.random() * 18,
      drift: Math.random() * 30 - 15,
      op: 0.35 + Math.random() * 0.5,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <>
      <div className="bg-fallback fixed inset-0 z-0 pointer-events-none" />
      
      {/* Background Image (with 100% opacity) */}
      <img 
        src={kiyanBg} 
        alt="Kiyan Background" 
        onLoad={() => setImgLoaded(true)}
        className={`fixed inset-0 w-full h-full object-cover z-10 pointer-events-none transition-opacity duration-[1500ms] ease-in-out ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
      />
      
      <div className="fixed inset-0 z-20 pointer-events-none bg-gradient-to-b from-bg-main/55 via-bg-main/75 to-bg-main/90" />
      
      <div className="particles fixed inset-0 z-30 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <div
            key={p.id}
            className="particle absolute bottom-[-10px] rounded-full"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              left: `${p.left}%`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              '--drift': `${p.drift}px`,
              '--op': p.op,
            } as CSSProperties}
          />
        ))}
      </div>
    </>
  );
}
