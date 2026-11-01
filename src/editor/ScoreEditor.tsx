import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { motion } from 'motion/react';
import { api, ApiError, ERROR_MESSAGES, clearToken, loadToken, messageFor, storeToken, type GoalPayload } from '../lib/api';
import { formatNumber, fromDigits, parseWholeNumber, toDigits } from '../lib/format';
import { MAX_VALUE } from '../config';

const DRAG_STEP_PX = 20;

const digitCount = (n: number) => Math.max(1, String(Math.max(0, Math.floor(n))).length);

// ---------------------------------------------------------------------------
// Digit wheel
// ---------------------------------------------------------------------------
function DigitWheel({
  value,
  onChange,
  colorClass,
  label,
  narrow,
}: {
  value: number;
  onChange: (v: number) => void;
  colorClass: string;
  label: string;
  narrow?: boolean;
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
      className={`relative flex flex-col items-center justify-center bg-bg/80 border rounded-lg mx-[1px] ${narrow ? 'w-[1.45rem] sm:w-8 text-[0.85em]' : 'w-9 sm:w-[2.75rem]'} h-[6.5rem] select-none cursor-ns-resize overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-light ${colorClass}`}
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

/** Colour groups of three digits from the right, using the goal's palette. */
const wheelColor = (i: number, total: number) => {
  const group = Math.floor((total - 1 - i) / 3);
  if (group === 0) return 'border-primary-dark text-primary-dark';
  if (group === 1) return 'border-text-muted text-text';
  return 'border-primary text-primary-light';
};

// ---------------------------------------------------------------------------
// Admin view
// ---------------------------------------------------------------------------
interface ScoreEditorProps {
  goal: GoalPayload;
  goalName: string;
  save: (token: string, update: { score: number; target?: number }) => Promise<GoalPayload>;
  onBack: () => void;
}

/** Score editor for one goal. Accepts the goal's editor password or the platform password. */
export default function ScoreEditor({ goal, goalName, save, onBack }: ScoreEditorProps) {
  const { score, target, slug } = goal;
  const [token, setToken] = useState<string | null>(() => loadToken('platform') ?? loadToken(slug));
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [pwError, setPwError] = useState('');

  const wheels = Math.max(digitCount(target), digitCount(score));
  const [digits, setDigits] = useState(() => toDigits(score, wheels));
  const [scoreText, setScoreText] = useState(() => String(score));
  const [targetText, setTargetText] = useState(() => String(target));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Follow live server values only while the admin hasn't started editing.
  useEffect(() => {
    if (dirty) return;
    setDigits(toDigits(score, wheels));
    setScoreText(String(score));
    setTargetText(String(target));
  }, [score, target, dirty, wheels]);

  useEffect(() => () => clearTimeout(messageTimer.current), []);

  const flash = (kind: 'ok' | 'error', text: string) => {
    clearTimeout(messageTimer.current);
    setMessage({ kind, text });
    messageTimer.current = setTimeout(() => setMessage(null), kind === 'ok' ? 2500 : 4500);
  };

  const logout = () => {
    clearToken('platform');
    clearToken(slug);
    setToken(null);
  };

  const tryLogin = async () => {
    if (!password || loggingIn) return;
    setLoggingIn(true);
    setPwError('');
    try {
      const result = await api.login(password, slug);
      storeToken(result.scope === 'platform' ? 'platform' : slug, result);
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
    if (parsed !== null && parsed <= MAX_VALUE) setDigits(toDigits(parsed, Math.max(wheels, digitCount(parsed))));
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
          className="w-[min(92vw,380px)] bg-surface/80 border border-primary/25 rounded-[10px] p-[clamp(1.6rem,4vw,2.4rem)] backdrop-blur-md"
          onSubmit={(e) => {
            e.preventDefault();
            tryLogin();
          }}
        >
          <div className="text-[1.05rem] font-bold text-primary-light mb-1">ثبت امتیاز</div>
          <div className="text-[0.85rem] text-text mb-[1.2rem]">{goalName}</div>
          <p className="text-[0.85rem] text-text-muted mb-4 leading-relaxed">رمز ویرایشگر این صفحه یا رمز مدیر پلتفرم را وارد کنید.</p>

          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPwError('');
            }}
            autoComplete="current-password"
            aria-label="رمز عبور"
            className="w-full p-[0.7rem_0.9rem] mb-[1rem] bg-bg border border-primary/30 rounded-[6px] text-text text-[1rem] dir-ltr text-right focus:outline-none focus:border-primary"
            placeholder="رمز عبور را وارد کنید"
            autoFocus
          />
          <div className="text-red-400 text-[0.82rem] -mt-[0.4rem] mb-[1rem] min-h-[1em]" role="alert">
            {pwError}
          </div>

          <button
            type="submit"
            disabled={loggingIn || !password}
            className="w-full flex items-center justify-center gap-2 p-[0.75rem_1rem] border-none rounded-[6px] bg-gradient-to-b from-primary-light to-primary text-bg font-bold text-[0.95rem] cursor-pointer transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loggingIn ? 'در حال بررسی…' : 'ورود'}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="block mt-[1.3rem] text-[0.82rem] text-text-muted decoration-dotted border-b border-text-muted/35 hover:text-primary-light text-center w-full"
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
    'w-full p-[0.55rem_0.8rem] bg-bg border border-primary/30 rounded-[6px] text-text text-[0.95rem] dir-ltr text-center focus:outline-none focus:border-primary';

  return (
    <div className="relative z-40 min-h-[100dvh] flex items-center justify-center px-[4vw] py-[6vh]">
      <div className="w-[min(95vw,420px)] bg-surface/80 border border-primary/25 rounded-[10px] p-[clamp(1.2rem,4vw,2rem)] backdrop-blur-md">
        <div className="flex justify-center items-center mb-[1.4rem]">
          <div className="text-center">
            <div className="text-[1.15rem] font-bold text-primary-light">پنل ثبت امتیاز</div>
            <div className="text-[0.8rem] text-text-muted mt-1">{goalName}</div>
          </div>
        </div>

        <label className="block text-[0.85rem] text-text-muted mb-[1rem] text-center">
          تنظیم دقیق امتیاز — بکشید یا با کلیدهای ↑↓ تغییر دهید
        </label>

        <div className="flex justify-center items-center gap-[2px] sm:gap-1 mb-4 dir-ltr">
          {digits.map((digit, i) => (
            <DigitWheel
              key={i}
              value={digit}
              onChange={(v) => handleDigitChange(i, v)}
              colorClass={wheelColor(i, digits.length)}
              narrow={digits.length > 9}
              label={`رقم ${formatNumber(i + 1, 'fa')}`}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="text-[0.78rem] text-text-muted">
            <span className="block mb-1">یا امتیاز را تایپ کنید</span>
            <input
              inputMode="numeric"
              value={scoreText}
              onChange={(e) => handleScoreText(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-[0.78rem] text-text-muted">
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
            <span className={`text-[0.82rem] ${message.kind === 'error' ? 'text-red-400' : 'text-primary-light'}`}>{message.text}</span>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="w-full p-[0.75rem_1rem] border-none rounded-[6px] bg-gradient-to-b from-primary-light to-primary text-bg font-bold text-[0.95rem] cursor-pointer transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? 'در حال ذخیره…' : 'ذخیره تغییرات در دیتابیس'}
        </button>

        {dirty && !saving && (
          <button
            onClick={handleDiscard}
            className="w-full mt-[0.7rem] p-[0.6rem_1rem] rounded-[6px] bg-transparent text-text-muted text-[0.85rem] cursor-pointer hover:text-primary-light"
          >
            لغو تغییرات و نمایش مقدار سرور
          </button>
        )}

        <button
          onClick={logout}
          className="w-full mt-[0.7rem] p-[0.75rem_1rem] border border-primary/35 rounded-[6px] bg-transparent text-text-muted font-bold text-[0.95rem] cursor-pointer hover:bg-white/5"
        >
          خروج از پنل
        </button>

        <div className="flex justify-between text-[0.85rem] text-text-muted border-t border-dashed border-primary/20 pt-[0.9rem] mt-[1rem]">
          <span>امتیاز فعلی سرور</span>
          <b className="text-primary-light font-bold dir-ltr unicode-bidi-plaintext">{formatNumber(score, 'fa')}</b>
        </div>
        <div className="flex justify-between text-[0.85rem] text-text-muted border-t border-dashed border-primary/20 pt-[0.9rem] mt-[0.3rem]">
          <span>هدف فعلی سرور</span>
          <b className="text-primary-light font-bold dir-ltr unicode-bidi-plaintext">{formatNumber(target, 'fa')}</b>
        </div>
        <div className="flex justify-between text-[0.85rem] text-text-muted border-t border-dashed border-primary/20 pt-[0.9rem] mt-[0.3rem]">
          <span>درصد با این عدد</span>
          <b className="text-primary-light font-bold dir-ltr unicode-bidi-plaintext">
            {formatNumber(currentPct, 'fa', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}٪
          </b>
        </div>

        <button
          onClick={onBack}
          className="block w-full mt-[1.3rem] text-[0.82rem] text-text-muted decoration-dotted border-b border-text-muted/35 hover:text-primary-light text-center pb-1"
        >
          مشاهده صفحه اصلی
        </button>
      </div>
    </div>
  );
}
