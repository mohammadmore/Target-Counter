import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';

const ADMIN_PASSWORD = "Kiyan1405"; 

function DigitWheel({ value, onChange, colorClass }: { value: number, onChange: (v: number) => void, colorClass: string, key?: any }) {
  const [rotation, setRotation] = useState(value);
  const [dragStart, setDragStart] = useState<number | null>(null);

  // Smoothly sync the continuous rotation state when the target value changes
  useEffect(() => {
    setRotation(r => {
      const currentVal = ((Math.round(r) % 10) + 10) % 10;
      let diff = value - currentVal;
      if (diff > 5) diff -= 10;
      else if (diff < -5) diff += 10;
      return r + diff;
    });
  }, [value]);

  const handleDrag = (currentY: number) => {
    if (dragStart === null) return;
    const diff = dragStart - currentY;
    
    // Drag UP -> diff > 0 -> wheel moves UP -> numbers below come up
    if (diff > 20) {
      onChange((value + 1) % 10);
      setDragStart(currentY);
    } else if (diff < -20) {
      onChange((value - 1 + 10) % 10);
      setDragStart(currentY);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => setDragStart(e.touches[0].clientY);
  const handleTouchMove = (e: React.TouchEvent) => handleDrag(e.touches[0].clientY);
  const handleTouchEnd = () => setDragStart(null);

  const handleMouseDown = (e: React.MouseEvent) => setDragStart(e.clientY);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragStart !== null) handleDrag(e.clientY);
  };
  const handleMouseUp = () => setDragStart(null);
  const handleMouseLeave = () => setDragStart(null);

  return (
    <div 
      className={`relative flex flex-col items-center justify-center bg-black/60 border rounded-lg mx-[1px] w-9 sm:w-[2.75rem] h-[6.5rem] select-none cursor-ns-resize overflow-hidden ${colorClass}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: '300px', touchAction: 'none' }}
    >
      {/* 3D Bevel & Inner Shadows */}
      <div className="absolute inset-0 shadow-[inset_0_5px_12px_rgba(0,0,0,0.85),inset_0_-5px_12px_rgba(0,0,0,0.85)] pointer-events-none z-10 rounded-lg" />
      <div className="absolute inset-0 border border-white/5 pointer-events-none z-10 rounded-lg" />
      
      {/* Gradient Masks */}
      <div className="absolute top-0 w-full h-[35%] bg-gradient-to-b from-black/95 via-black/40 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 w-full h-[35%] bg-gradient-to-t from-black/95 via-black/40 to-transparent z-10 pointer-events-none" />

      {/* 3D Wheel Numbers Container */}
      <div className="absolute inset-0 flex items-center justify-center font-mono font-bold" style={{ transformStyle: 'preserve-3d' }}>
        {[-3, -2, -1, 0, 1, 2, 3].map(offset => {
          const absoluteIndex = rotation + offset;
          const displayNum = ((absoluteIndex % 10) + 10) % 10;
          const dist = offset; 
          const isCenter = dist === 0;

          return (
            <motion.div
              key={absoluteIndex}
              className="absolute flex items-center justify-center w-full h-full"
              initial={false}
              animate={{
                y: `${dist * 35}%`,
                rotateX: dist * -35, // Negative so the bottom item tilts its top towards us
                z: -Math.abs(dist) * 15,
                scale: 1 - Math.abs(dist) * 0.1,
                opacity: 1 - Math.abs(dist) * 0.4,
                filter: isCenter ? 'blur(0px)' : 'blur(0.8px)'
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
            >
              <div className={`text-[1.35rem] sm:text-2xl transition-all duration-300 ${isCenter ? 'drop-shadow-[0_0_8px_rgba(currentcolor,0.4)] z-0' : ''}`}>
                {displayNum}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminView({ score, setScore, target, onBack }: { score: number; setScore: (s: number) => void; target: number; onBack: () => void }) {
  const [isAuthed, setIsAuthed] = useState(() => sessionStorage.getItem('kianteam_admin_auth') === '1');
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');

  // Pad score to exactly 8 digits
  const currentDigits = String(score).padStart(8, '0').slice(-8).split('').map(Number);
  const [digits, setDigits] = useState(currentDigits);

  // Update local digits if external score changes (and we're not actively editing)
  useEffect(() => {
    setDigits(String(score).padStart(8, '0').slice(-8).split('').map(Number));
  }, [score]);

  const handleDigitChange = (index: number, val: number) => {
    const newDigits = [...digits];
    newDigits[index] = val;
    setDigits(newDigits);
  };

  const handleSave = () => {
    const newScore = parseInt(digits.join(''), 10);
    
    if (newScore > target) {
      setSaveError('خطا: امتیاز نمی‌تواند بیشتر از هدف ماهانه باشد.');
      setSaveMsg('');
      setTimeout(() => setSaveError(''), 3500);
      return;
    }
    
    setScore(newScore);
    setSaveError('');
    setSaveMsg('امتیاز در سرور ابری ذخیره شد.');
    setTimeout(() => setSaveMsg(''), 2500);
  };

  const tryLogin = () => {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('kianteam_admin_auth', '1');
      setIsAuthed(true);
    } else {
      setPwError('رمز عبور اشتباه است.');
      setPassword('');
    }
  };

  if (!isAuthed) {
    return (
      <div className="relative z-40 min-h-[100dvh] flex items-center justify-center px-[6vw] py-[6vh]">
        <div className="w-[min(92vw,380px)] bg-black/70 border border-gold-1/25 rounded-[10px] p-[clamp(1.6rem,4vw,2.4rem)] backdrop-blur-md">
          <div className="text-[1.05rem] font-bold text-gold-2 mb-[1.4rem]">ورود مدیر سیستم</div>
          <p className="text-[0.85rem] text-pearl-dim mb-4 leading-relaxed">
            برای ویرایش امتیازات، رمز عبور مدیریت را وارد کنید.
          </p>
          
          <input 
            type="password" 
            value={password}
            onChange={e => { setPassword(e.target.value); setPwError(''); }}
            onKeyDown={e => e.key === 'Enter' && tryLogin()}
            className="w-full p-[0.7rem_0.9rem] mb-[1rem] bg-[#100f0c] border border-gold-1/30 rounded-[6px] text-pearl text-[1rem] dir-ltr text-right focus:outline-none focus:border-gold-1" 
            placeholder="رمز عبور را وارد کنید" 
            autoFocus
          />
          <div className="text-red-400 text-[0.82rem] -mt-[0.4rem] mb-[1rem] min-h-[1em]">{pwError}</div>

          <button onClick={tryLogin} className="w-full flex items-center justify-center gap-2 p-[0.75rem_1rem] border-none rounded-[6px] bg-gradient-to-b from-gold-2 to-gold-1 text-[#1a1408] font-bold text-[0.95rem] cursor-pointer transition-all hover:brightness-110">
            ورود
          </button>
          
          <button onClick={onBack} className="block mt-[1.3rem] text-[0.82rem] text-pearl-dim decoration-dotted border-b border-pearl-dim/35 hover:text-gold-2 text-center w-full">بازگشت به صفحه اصلی</button>
        </div>
      </div>
    );
  }

  const currentPct = target > 0 ? (parseInt(digits.join(''), 10) / target) * 100 : 0;

  return (
    <div className="relative z-40 min-h-[100dvh] flex items-center justify-center px-[4vw] py-[6vh]">
      <div className="w-[min(95vw,420px)] bg-black/70 border border-gold-1/25 rounded-[10px] p-[clamp(1.2rem,4vw,2rem)] backdrop-blur-md">
        <div className="flex justify-center items-center mb-[1.4rem]">
          <div className="text-[1.15rem] font-bold text-gold-2">پنل مدیریت امتیاز</div>
        </div>
        
        <label className="block text-[0.85rem] text-pearl-dim mb-[1rem] text-center">تنظیم دقیق امتیاز (۸ رقم)</label>
        
        <div className="flex justify-center items-center gap-[2px] sm:gap-1 mb-6 dir-ltr">
          {digits.map((digit, i) => {
            let colorClass = "";
            if (i < 2) colorClass = "border-gold-1 text-gold-2 shadow-[0_0_8px_rgba(212,175,55,0.15)]"; // Millions (Gold)
            else if (i < 5) colorClass = "border-slate-300 text-slate-200 shadow-[0_0_8px_rgba(203,213,225,0.1)]"; // Thousands (Silver)
            else colorClass = "border-amber-600 text-amber-500 shadow-[0_0_8px_rgba(217,119,6,0.15)]"; // Units (Bronze)

            return (
              <DigitWheel 
                key={i} 
                value={digit} 
                onChange={(v) => handleDigitChange(i, v)} 
                colorClass={colorClass} 
              />
            );
          })}
        </div>
        
        <div className="text-center h-[1em] mb-[1rem]">
          {saveError ? (
            <span className="text-red-400 text-[0.82rem]">{saveError}</span>
          ) : (
            <span className="text-gold-2 text-[0.82rem]">{saveMsg}</span>
          )}
        </div>
        
        <button onClick={handleSave} className="w-full p-[0.75rem_1rem] border-none rounded-[6px] bg-gradient-to-b from-gold-2 to-gold-1 text-[#1a1408] font-bold text-[0.95rem] cursor-pointer transition-all hover:brightness-110">
          ذخیره تغییرات در دیتابیس
        </button>
        
        <button onClick={() => { sessionStorage.removeItem('kianteam_admin_auth'); setIsAuthed(false); }} className="w-full mt-[0.7rem] p-[0.75rem_1rem] border border-gold-1/35 rounded-[6px] bg-transparent text-pearl-dim font-bold text-[0.95rem] cursor-pointer hover:bg-white/5">
          خروج از پنل
        </button>
        
        <div className="flex justify-between text-[0.85rem] text-pearl-dim border-t border-dashed border-gold-1/20 pt-[0.9rem] mt-[1rem]">
          <span>هدف ماهانه</span>
          <b className="text-gold-2 font-bold dir-ltr unicode-bidi-plaintext">{target.toLocaleString('fa-IR')}</b>
        </div>
        <div className="flex justify-between text-[0.85rem] text-pearl-dim border-t border-dashed border-gold-1/20 pt-[0.9rem] mt-[0.3rem]">
          <span>درصد با این عدد</span>
          <b className="text-gold-2 font-bold dir-ltr unicode-bidi-plaintext">{currentPct.toLocaleString('fa-IR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}٪</b>
        </div>
        
        <button onClick={onBack} className="block w-full mt-[1.3rem] text-[0.82rem] text-pearl-dim decoration-dotted border-b border-pearl-dim/35 hover:text-gold-2 text-center pb-1">مشاهده صفحه اصلی</button>
      </div>
    </div>
  );
}
