import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { motion } from 'motion/react';
import { api, ApiError, type ScoreData } from '../lib/api';
import { formatNumber, fromDigits, parseWholeNumber, toDigits } from '../lib/format';
import { MAX_DIGITS, MAX_VALUE } from '../config';

const TOKEN_KEY = 'kianteam_admin_token';
const DRAG_STEP_PX = 20;

const ERROR_MESSAGES: Record<string, string> = {
  invalid_password: 'رمز عبور اشتباه است.',
  too_many_attempts: 'تعداد تلاش‌های ناموفق زیاد بود. ۱۵ دقیقه دیگر دوباره امتحان کنید.',
  unauthorized: 'نشست شما منقضی شده است. لطفاً دوباره وارد شوید.',
  invalid_score: 'امتیاز وارد شده معتبر نیست.',
  invalid_target: `هدف باید عددی بین ۱ و ${formatNumber(MAX_VALUE, 'fa')} باشد.`,
  score_exceeds_target: 'امتیاز نمی‌تواند بیشتر از هدف باشد.',
  not_configured: 'سرور هنوز پیکربندی نشده است (فایل kiyan-config.php).',
  unavailable: 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.',
  server_error: 'خطای سرور؛ تغییرات ذخیره نشد.',
};

const messageFor = (err: unknown) =>
  (err instanceof ApiError && ERROR_MESSAGES[err.code]) || 'خطای ناشناخته؛ تغییرات ذخیره نشد.';

function loadToken(): string | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? 'null');
    if (stored?.token && stored.expiresAt * 1000 > Date.now()) return stored.token;
  } catch { /* ignore */ }
  sessionStorage.removeItem(TOKEN_KEY);
  return null;
}

// ---------------------------------------------------------------------------
// Digit wheel
// ---------------------------------------------------------------------------
function DigitWheel({
  value,
  onChange,
  colorClass,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  colorClass: string;
  label: string;
}) {
  const [rotation, setRotation] = useState(value);
  const dragStart = useRef<number | null>(null);

  // Keep a continuous rotation so 9 -> 0 spins forward instead of rewinding.
  useEffect(() => {
    setRotation((r) => {
      const currentVal = ((Math.round(r) % 10) + 10) % 10;
      let diff = value - currentVal;
      if (diff > 5) diff -= 10;
      else if (diff < -5) diff += 10;
      return r + diff;
    });
  }, [value]);

  const step = (delta: number) => onChange((value + delta + 10) % 10);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragStart.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return;
    const diff = dragStart.current - e.clientY;
    if (Math.abs(diff) >= DRAG_STEP_PX) {
      step(diff > 0 ? 1 : -1); // drag up -> +1
      dragStart.current = e.clientY;
    }
  };
  const endDrag = () => {
    dragStart.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp') step(1);
    else if (e.key === 'ArrowDown') step(-1);
    else if (/^[0-9]$/.test(e.key)) onChange(Number(e.key));
    else return;
    e.preventDefault();
  };

  return (
    <div
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={9}
      className={`relative flex flex-col items-center justify-center bg-black/60 border rounded-lg mx-[1px] w-9 sm:w-[2.75rem] h-[6.5rem] select-none cursor-ns-resize overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-2 ${colorClass}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      style={{ perspective: '300px', touchAction: 'none' }}
    >
      {/* 3D Bevel & Inner Shadows */}
      <div className="absolute inset-0 shadow-[inset_0_5px_12px_rgba(0,0,0,0.85),inset_0_-5px_12px_rgba(0,0,0,0.85)] pointer-events-none z-10 rounded-lg" />
      <div className="absolute inset-0 border border-white/5 pointer-events-none z-10 rounded-lg" />

      {/* Gradient Masks */}
      <div className="absolute top-0 w-full h-[35%] bg-gradient-to-b from-black/95 via-black/40 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 w-full h-[35%] bg-gradient-to-t from-black/95 via-black/40 to-transparent z-10 pointer-events-none" />

      {/* 3D Wheel Numbers */}
      <div className="absolute inset-0 flex items-center justify-center font-mono font-bold" style={{ transformStyle: 'preserve-3d' }}>
        {[-3, -2, -1, 0, 1, 2, 3].map((offset) => {
          const absoluteIndex = rotation + offset;
          const displayNum = ((absoluteIndex % 10) + 10) % 10;
          const isCenter = offset === 0;

          return (
            <motion.div
              key={absoluteIndex}
              className="absolute flex items-center justify-center w-full h-full"
              initial={false}
              animate={{
                y: `${offset * 35}%`,
                rotateX: offset * -35,
                z: -Math.abs(offset) * 15,
                scale: 1 - Math.abs(offset) * 0.1,
                opacity: 1 - Math.abs(offset) * 0.4,
                filter: isCenter ? 'blur(0px)' : 'blur(0.8px)',
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
            >
              <div className={`text-[1.35rem] sm:text-2xl ${isCenter ? 'drop-shadow-[0_0_8px_currentColor]' : ''}`}>{displayNum}</div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

const wheelColor = (i: number) => {
  if (i < 2) return 'border-gold-1 text-gold-2 shadow-[0_0_8px_rgba(212,175,55,0.15)]'; // millions
  if (i < 5) return 'border-slate-300 text-slate-200 shadow-[0_0_8px_rgba(203,213,225,0.1)]'; // thousands
  return 'border-amber-600 text-amber-500 shadow-[0_0_8px_rgba(217,119,6,0.15)]'; // units
};

// ---------------------------------------------------------------------------
// Admin view
// ---------------------------------------------------------------------------
interface AdminViewProps {
  score: number;
  target: number;
  save: (token: string, update: ScoreData) => Promise<ScoreData>;
  onBack: () => void;
}

export default function AdminView({ score, target, save, onBack }: AdminViewProps) {
  const [token, setToken] = useState<string | null>(loadToken);
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [pwError, setPwError] = useState('');

  const [digits, setDigits] = useState(() => toDigits(score));
  const [scoreText, setScoreText] = useState(() => String(score));
  const [targetText, setTargetText] = useState(() => String(target));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Follow live server values only while the admin hasn't started editing.
  useEffect(() => {
    if (dirty) return;
    setDigits(toDigits(score));
    setScoreText(String(score));
    setTargetText(String(target));
  }, [score, target, dirty]);

  useEffect(() => () => clearTimeout(messageTimer.current), []);

  const flash = (kind: 'ok' | 'error', text: string) => {
    clearTimeout(messageTimer.current);
    setMessage({ kind, text });
    messageTimer.current = setTimeout(() => setMessage(null), kind === 'ok' ? 2500 : 4500);
  };

  const logout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  const tryLogin = async () => {
    if (!password || loggingIn) return;
    setLoggingIn(true);
    setPwError('');
    try {
      const result = await api.login(password);
      sessionStorage.setItem(TOKEN_KEY, JSON.stringify(result));
      setToken(result.token);
      setPassword('');
    } catch (err) {
      setPwError(messageFor(err));
      setPassword('');
    } finally {
      setLoggingIn(false);
    }
  };

  const editedScore = fromDigits(digits);
  const editedTarget = parseWholeNumber(targetText);

  const handleDigitChange = (index: number, val: number) => {
    const next = [...digits];
    next[index] = val;
    setDigits(next);
    setScoreText(String(fromDigits(next)));
    setDirty(true);
  };

  const handleScoreText = (text: string) => {
    setScoreText(text);
    setDirty(true);
    const parsed = parseWholeNumber(text);
    if (parsed !== null && parsed <= MAX_VALUE) setDigits(toDigits(parsed));
  };

  const handleSave = async () => {
    if (!token || saving) return;
    const typedScore = parseWholeNumber(scoreText);
    if (typedScore === null || typedScore > MAX_VALUE) {
      flash('error', ERROR_MESSAGES.invalid_score);
      return;
    }
    if (editedTarget === null || editedTarget < 1 || editedTarget > MAX_VALUE) {
      flash('error', ERROR_MESSAGES.invalid_target);
      return;
    }
    if (typedScore > editedTarget) {
      flash('error', ERROR_MESSAGES.score_exceeds_target);
      return;
    }

    setSaving(true);
    try {
      await save(token, { score: typedScore, target: editedTarget });
      setDirty(false);
      flash('ok', 'امتیاز در سرور ذخیره شد.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unauthorized') {
        logout();
        setPwError(ERROR_MESSAGES.unauthorized);
        return;
      }
      flash('error', messageFor(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setDirty(false); // effect re-syncs from server values
  };

  if (!token) {
    return (
      <div className="relative z-40 min-h-[100dvh] flex items-center justify-center px-[6vw] py-[6vh]">
        <form
          className="w-[min(92vw,380px)] bg-black/70 border border-gold-1/25 rounded-[10px] p-[clamp(1.6rem,4vw,2.4rem)] backdrop-blur-md"
          onSubmit={(e) => {
            e.preventDefault();
            tryLogin();
          }}
        >
          <div className="text-[1.05rem] font-bold text-gold-2 mb-[1.4rem]">ورود مدیر سیستم</div>
          <p className="text-[0.85rem] text-pearl-dim mb-4 leading-relaxed">برای ویرایش امتیازات، رمز عبور مدیریت را وارد کنید.</p>

          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPwError('');
            }}
            autoComplete="current-password"
            aria-label="رمز عبور"
            className="w-full p-[0.7rem_0.9rem] mb-[1rem] bg-[#100f0c] border border-gold-1/30 rounded-[6px] text-pearl text-[1rem] dir-ltr text-right focus:outline-none focus:border-gold-1"
            placeholder="رمز عبور را وارد کنید"
            autoFocus
          />
          <div className="text-red-400 text-[0.82rem] -mt-[0.4rem] mb-[1rem] min-h-[1em]" role="alert">
            {pwError}
          </div>

          <button
            type="submit"
            disabled={loggingIn || !password}
            className="w-full flex items-center justify-center gap-2 p-[0.75rem_1rem] border-none rounded-[6px] bg-gradient-to-b from-gold-2 to-gold-1 text-[#1a1408] font-bold text-[0.95rem] cursor-pointer transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loggingIn ? 'در حال بررسی…' : 'ورود'}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="block mt-[1.3rem] text-[0.82rem] text-pearl-dim decoration-dotted border-b border-pearl-dim/35 hover:text-gold-2 text-center w-full"
          >
            بازگشت به صفحه اصلی
          </button>
        </form>
      </div>
    );
  }

  const previewTarget = editedTarget && editedTarget > 0 ? editedTarget : target;
  const currentPct = previewTarget > 0 ? (editedScore / previewTarget) * 100 : 0;
  const inputClass =
    'w-full p-[0.55rem_0.8rem] bg-[#100f0c] border border-gold-1/30 rounded-[6px] text-pearl text-[0.95rem] dir-ltr text-center focus:outline-none focus:border-gold-1';

  return (
    <div className="relative z-40 min-h-[100dvh] flex items-center justify-center px-[4vw] py-[6vh]">
      <div className="w-[min(95vw,420px)] bg-black/70 border border-gold-1/25 rounded-[10px] p-[clamp(1.2rem,4vw,2rem)] backdrop-blur-md">
        <div className="flex justify-center items-center mb-[1.4rem]">
          <div className="text-[1.15rem] font-bold text-gold-2">پنل مدیریت امتیاز</div>
        </div>

        <label className="block text-[0.85rem] text-pearl-dim mb-[1rem] text-center">
          تنظیم دقیق امتیاز ({formatNumber(MAX_DIGITS, 'fa')} رقم) — بکشید یا با کلیدهای ↑↓ تغییر دهید
        </label>

        <div className="flex justify-center items-center gap-[2px] sm:gap-1 mb-4 dir-ltr">
          {digits.map((digit, i) => (
            <DigitWheel
              key={i}
              value={digit}
              onChange={(v) => handleDigitChange(i, v)}
              colorClass={wheelColor(i)}
              label={`رقم ${formatNumber(i + 1, 'fa')}`}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="text-[0.78rem] text-pearl-dim">
            <span className="block mb-1">یا امتیاز را تایپ کنید</span>
            <input
              inputMode="numeric"
              value={scoreText}
              onChange={(e) => handleScoreText(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-[0.78rem] text-pearl-dim">
            <span className="block mb-1">هدف (تارگت)</span>
            <input
              inputMode="numeric"
              value={targetText}
              onChange={(e) => {
                setTargetText(e.target.value);
                setDirty(true);
              }}
              className={inputClass}
            />
          </label>
        </div>

        <div className="text-center min-h-[1.2em] mb-[1rem]" role="status" aria-live="polite">
          {message && (
            <span className={`text-[0.82rem] ${message.kind === 'error' ? 'text-red-400' : 'text-gold-2'}`}>{message.text}</span>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="w-full p-[0.75rem_1rem] border-none rounded-[6px] bg-gradient-to-b from-gold-2 to-gold-1 text-[#1a1408] font-bold text-[0.95rem] cursor-pointer transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'در حال ذخیره…' : 'ذخیره تغییرات در دیتابیس'}
        </button>

        {dirty && !saving && (
          <button
            onClick={handleDiscard}
            className="w-full mt-[0.7rem] p-[0.6rem_1rem] rounded-[6px] bg-transparent text-pearl-dim text-[0.85rem] cursor-pointer hover:text-gold-2"
          >
            لغو تغییرات و نمایش مقدار سرور
          </button>
        )}

        <button
          onClick={logout}
          className="w-full mt-[0.7rem] p-[0.75rem_1rem] border border-gold-1/35 rounded-[6px] bg-transparent text-pearl-dim font-bold text-[0.95rem] cursor-pointer hover:bg-white/5"
        >
          خروج از پنل
        </button>

        <div className="flex justify-between text-[0.85rem] text-pearl-dim border-t border-dashed border-gold-1/20 pt-[0.9rem] mt-[1rem]">
          <span>امتیاز فعلی سرور</span>
          <b className="text-gold-2 font-bold dir-ltr unicode-bidi-plaintext">{formatNumber(score, 'fa')}</b>
        </div>
        <div className="flex justify-between text-[0.85rem] text-pearl-dim border-t border-dashed border-gold-1/20 pt-[0.9rem] mt-[0.3rem]">
          <span>هدف فعلی سرور</span>
          <b className="text-gold-2 font-bold dir-ltr unicode-bidi-plaintext">{formatNumber(target, 'fa')}</b>
        </div>
        <div className="flex justify-between text-[0.85rem] text-pearl-dim border-t border-dashed border-gold-1/20 pt-[0.9rem] mt-[0.3rem]">
          <span>درصد با این عدد</span>
          <b className="text-gold-2 font-bold dir-ltr unicode-bidi-plaintext">
            {formatNumber(currentPct, 'fa', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}٪
          </b>
        </div>

        <button
          onClick={onBack}
          className="block w-full mt-[1.3rem] text-[0.82rem] text-pearl-dim decoration-dotted border-b border-pearl-dim/35 hover:text-gold-2 text-center pb-1"
        >
          مشاهده صفحه اصلی
        </button>
      </div>
    </div>
  );
}
