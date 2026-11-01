import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, History, Loader2, LogOut, Minus, Plus, Undo2 } from 'lucide-react';
import { api, ApiError, clearToken, loadToken, storeToken, type GoalPayload, type HistoryEntry, type ScoreUpdate } from '../lib/api';
import { dirOf, formatNumber, formatPercent, fromDigits, toDigits, type Lang } from '../lib/format';
import type { GoalConfig } from '../goal/types';
import { ensureFont, themeStyle } from '../goal/theme';
import { timeAgo } from '../page/chrome';
import NumberInput from '../components/NumberInput';
import DigitWheel, { wheelColor } from './DigitWheel';
import { EDITOR_ERRORS, EDITOR_STRINGS } from './strings';

/** Beyond this many digits the wheels get too small to use; the typed input is enough. */
const MAX_WHEELS = 10;

const digitCount = (n: number) => Math.max(1, String(Math.max(0, Math.floor(n))).length);

interface ScoreEditorProps {
  goal: GoalPayload;
  config: GoalConfig;
  lang: Lang;
  mutate: <T extends GoalPayload>(run: () => Promise<T>) => Promise<T>;
  refresh: () => Promise<GoalPayload>;
  onBack: () => void;
}

/**
 * Score editor for one goal, for team leads (goal editor password) and admins.
 * Default flow is "add what happened today"; setting the total is guarded
 * against concurrent edits, and every change can be traced and undone.
 */
export default function ScoreEditor({ goal, config, lang, mutate, refresh, onBack }: ScoreEditorProps) {
  const t = EDITOR_STRINGS[lang];
  const errors = EDITOR_ERRORS[lang];
  const errorText = (err: unknown) => (err instanceof ApiError ? errors[err.code] ?? errors.unknown! : errors.unknown!);
  const { score, target, slug } = goal;

  const [token, setToken] = useState<string | null>(() => loadToken('platform') ?? loadToken(slug));
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [mode, setMode] = useState<'add' | 'set'>('add');
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [newScore, setNewScore] = useState<number | null>(score);
  // The score the admin started editing from — sent so we can detect concurrent changes.
  const [baseline, setBaseline] = useState(score);
  const [setDirty, setSetDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [history, setHistory] = useState<{ entries: HistoryEntry[]; undoableId: number | null } | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => ensureFont(config), [config]);
  useEffect(() => () => clearTimeout(messageTimer.current), []);

  // While not editing the total, follow live changes made by others.
  useEffect(() => {
    if (setDirty) return;
    setNewScore(score);
    setBaseline(score);
  }, [score, setDirty]);

  const flash = (kind: 'ok' | 'error', text: string) => {
    clearTimeout(messageTimer.current);
    setMessage({ kind, text });
    messageTimer.current = setTimeout(() => setMessage(null), kind === 'ok' ? 3000 : 7000);
  };

  const logout = useCallback(() => {
    clearToken('platform');
    clearToken(slug);
    setToken(null);
    setHistory(null);
  }, [slug]);

  const handleAuthError = (err: unknown) => {
    if (err instanceof ApiError && err.code === 'unauthorized') {
      logout();
      setLoginError(errorText(err));
      return true;
    }
    return false;
  };

  const loadHistory = useCallback(async () => {
    if (!token) return;
    try {
      setHistory(await api.history(token, slug));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'unauthorized') logout();
    }
  }, [token, slug, logout]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, score]);

  const tryLogin = async () => {
    if (!password || loggingIn) return;
    setLoggingIn(true);
    setLoginError('');
    try {
      const result = await api.login(password, slug, remember);
      storeToken(result.scope === 'platform' ? 'platform' : slug, result, remember);
      setToken(result.token);
      setPassword('');
    } catch (err) {
      setLoginError(errorText(err));
      setPassword('');
    } finally {
      setLoggingIn(false);
    }
  };

  const submit = async (update: ScoreUpdate) => {
    if (!token || busy) return;
    setBusy(true);
    try {
      await mutate(() => api.updateScore(token, slug, update));
      setAmount(null);
      setNote('');
      setSetDirty(false);
      flash('ok', t.saved);
    } catch (err) {
      if (handleAuthError(err)) return;
      if (err instanceof ApiError && err.code === 'score_changed') {
        const fresh = await refresh().catch(() => null);
        const current = fresh?.score ?? err.details.current ?? score;
        setBaseline(current);
        flash('error', t.changedBy(formatNumber(current, lang)));
        return;
      }
      flash('error', errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const undo = async (entryId: number) => {
    if (!token || busy) return;
    setBusy(true);
    try {
      await mutate(() => api.undo(token, slug, entryId));
      flash('ok', t.undone);
    } catch (err) {
      if (!handleAuthError(err)) flash('error', errorText(err));
      loadHistory();
    } finally {
      setBusy(false);
    }
  };

  const goalName = config.texts[lang].title || config.name;
  const inputClass =
    'w-full p-[0.65rem_0.9rem] bg-bg border border-primary/30 rounded-[8px] text-text text-[1.05rem] focus:outline-none focus:border-primary placeholder:text-text-muted/60';
  const primaryButton =
    'w-full flex items-center justify-center gap-2 p-[0.8rem_1rem] rounded-[8px] bg-gradient-to-b from-primary-light to-primary text-bg font-bold text-[0.95rem] transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed';

  const shell = (children: ReactNode) => (
    <div style={themeStyle(config)} dir={dirOf(lang)} lang={lang} className="relative min-h-[100dvh] bg-bg text-text font-goal">
      <div className="absolute inset-0 bg-glow pointer-events-none" />
      <div className="relative z-10 min-h-[100dvh] flex items-start sm:items-center justify-center px-4 py-8">
        <div className="w-full max-w-[440px] goal-card !rounded-[14px] p-[clamp(1.1rem,4vw,1.8rem)]">{children}</div>
      </div>
    </div>
  );

  // ---------------------------------------------------------------- login
  if (!token) {
    return shell(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          tryLogin();
        }}
        className="space-y-4"
      >
        <div>
          <div className="text-[1.1rem] font-bold text-primary-light">{t.title}</div>
          <div className="text-[0.9rem] text-text mt-0.5">{goalName}</div>
          <p className="text-[0.85rem] text-text-muted mt-3 leading-relaxed">{t.loginHint}</p>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setLoginError('');
          }}
          autoComplete="current-password"
          aria-label={t.password}
          placeholder={t.password}
          className={inputClass}
          autoFocus
        />
        <label className="flex items-center gap-2 text-[0.85rem] text-text-muted cursor-pointer">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 accent-[var(--color-primary)]" />
          {t.remember}
        </label>
        {loginError && (
          <p className="text-red-400 text-[0.85rem]" role="alert">
            {loginError}
          </p>
        )}
        <button type="submit" disabled={loggingIn || !password} className={primaryButton}>
          {loggingIn && <Loader2 size={16} className="animate-spin" />}
          {loggingIn ? t.checking : t.login}
        </button>
        <button type="button" onClick={onBack} className="block w-full text-center text-[0.85rem] text-text-muted hover:text-primary-light">
          {t.back}
        </button>
      </form>,
    );
  }

  // ---------------------------------------------------------------- editor
  const signedAmount = amount === null ? null : amount * sign;
  const addPreview = signedAmount === null ? null : score + signedAmount;
  const addError =
    addPreview === null ? null : addPreview < 0 ? errors.below_zero : addPreview > target ? errors.score_exceeds_target : null;

  const wheels = Math.max(digitCount(target), digitCount(newScore ?? 0));
  const showWheels = wheels <= MAX_WHEELS;
  const digits = toDigits(newScore ?? 0, wheels);
  const setError = newScore === null ? t.enterScore : newScore > target ? errors.score_exceeds_target : null;

  const pct = (n: number) => `${formatPercent((Math.min(n, target) / target) * 100, lang)}%`;

  return shell(
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[1.1rem] font-bold text-primary-light">{t.title}</div>
          <div className="text-[0.85rem] text-text-muted truncate">{goalName}</div>
        </div>
        <button onClick={logout} className="shrink-0 p-2 rounded-lg text-text-muted hover:text-primary-light hover:bg-primary/10" title={t.logout} aria-label={t.logout}>
          <LogOut size={18} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[10px] bg-bg/60 border border-primary/20 p-3">
          <div className="text-[0.72rem] text-text-muted">{t.current}</div>
          <div className="text-[1.15rem] font-extrabold text-primary-light" style={{ direction: 'ltr', textAlign: 'start' }}>
            {formatNumber(score, lang)}
          </div>
          <div className="text-[0.72rem] text-text-muted" style={{ direction: 'ltr', textAlign: 'start' }}>
            {pct(score)}
          </div>
        </div>
        <div className="rounded-[10px] bg-bg/60 border border-primary/20 p-3">
          <div className="text-[0.72rem] text-text-muted">{t.target}</div>
          <div className="text-[1.15rem] font-bold text-text" style={{ direction: 'ltr', textAlign: 'start' }}>
            {formatNumber(target, lang)}
          </div>
          <div className="text-[0.72rem] text-text-muted">
            {t.updated}: {timeAgo(goal.scoreUpdatedAt, lang)}
          </div>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="grid grid-cols-2 p-1 rounded-[10px] bg-bg/70 border border-primary/20" role="tablist">
        {(['add', 'set'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`py-2 rounded-[8px] text-[0.85rem] font-bold transition-colors ${mode === m ? 'bg-primary text-bg' : 'text-text-muted hover:text-text'}`}
          >
            {m === 'add' ? t.tabAdd : t.tabSet}
          </button>
        ))}
      </div>

      {mode === 'add' ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!amount) return flash('error', t.enterAmount);
            if (addError) return flash('error', addError);
            submit({ mode: 'add', amount: amount * sign, note: note || undefined });
          }}
        >
          <div className="flex gap-2">
            <div className="flex shrink-0 rounded-[8px] border border-primary/30 overflow-hidden" role="radiogroup">
              {([1, -1] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={sign === s}
                  aria-label={s === 1 ? t.add : t.subtract}
                  title={s === 1 ? t.add : t.subtract}
                  onClick={() => setSign(s)}
                  className={`w-11 flex items-center justify-center ${sign === s ? (s === 1 ? 'bg-primary text-bg' : 'bg-red-500/80 text-white') : 'text-text-muted'}`}
                >
                  {s === 1 ? <Plus size={18} /> : <Minus size={18} />}
                </button>
              ))}
            </div>
            <NumberInput value={amount} onChange={setAmount} lang={lang} placeholder={t.amount} aria-label={t.amount} className={inputClass} autoFocus />
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={t.notePlaceholder} aria-label={t.note} className={`${inputClass} !text-[0.9rem]`} />
          <div className="flex justify-between text-[0.85rem] min-h-[1.3em]">
            {addPreview !== null && (
              <>
                <span className="text-text-muted">{t.newTotal}</span>
                <span className={addError ? 'text-red-400 font-bold' : 'text-primary-light font-bold'} style={{ direction: 'ltr' }}>
                  {formatNumber(addPreview, lang)} · {addError ? '' : pct(addPreview)}
                </span>
              </>
            )}
          </div>
          <button type="submit" disabled={busy || !amount || !!addError} className={primaryButton}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? t.saving : amount ? t.submitAdd(`${sign > 0 ? '+' : '−'}${formatNumber(amount, lang)}`) : t.add}
          </button>
        </form>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (newScore === null) return flash('error', t.enterScore);
            if (newScore === score) return flash('error', t.noChange);
            if (setError) return flash('error', setError);
            submit({ mode: 'set', score: newScore, expectedScore: baseline, note: note || undefined });
          }}
        >
          {showWheels && (
            <>
              <p className="text-[0.75rem] text-text-muted text-center">{t.wheelsHint}</p>
              <div className="flex justify-center items-center gap-[2px] sm:gap-1" dir="ltr">
                {digits.map((digit, i) => (
                  <div key={i} className={`flex ${i > 0 && (digits.length - i) % 3 === 0 ? 'ms-1.5' : ''}`}>
                    <DigitWheel
                      value={digit}
                      onChange={(v) => {
                        const next = [...digits];
                        next[i] = v;
                        setNewScore(fromDigits(next));
                        setSetDirty(true);
                      }}
                      colorClass={wheelColor(i, digits.length)}
                      label={`${i + 1}`}
                      narrow={digits.length > 8}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
          <NumberInput
            value={newScore}
            onChange={(v) => {
              setNewScore(v);
              setSetDirty(true);
            }}
            lang={lang}
            aria-label={t.newScore}
            placeholder={t.newScore}
            className={`${inputClass} text-center !text-[1.2rem] font-bold`}
          />
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={t.notePlaceholder} aria-label={t.note} className={`${inputClass} !text-[0.9rem]`} />
          <div className="flex justify-between text-[0.85rem] min-h-[1.3em]">
            {newScore !== null && newScore !== score && (
              <>
                <span className="text-text-muted">{t.change}</span>
                <span className={setError ? 'text-red-400 font-bold' : 'text-primary-light font-bold'} style={{ direction: 'ltr' }}>
                  {newScore - score > 0 ? '+' : '−'}
                  {formatNumber(Math.abs(newScore - score), lang)}
                  {!setError && ` · ${pct(newScore)}`}
                </span>
              </>
            )}
          </div>
          <button type="submit" disabled={busy || newScore === null || newScore === score || !!setError} className={primaryButton}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? t.saving : t.submitSet}
          </button>
        </form>
      )}

      <div role="status" aria-live="polite" className="min-h-[1.2em] text-center">
        {message && <span className={`text-[0.85rem] ${message.kind === 'error' ? 'text-red-400' : 'text-primary-light'}`}>{message.text}</span>}
      </div>

      {/* History */}
      <section className="border-t border-dashed border-primary/20 pt-4">
        <h2 className="flex items-center gap-1.5 text-[0.85rem] font-bold text-text mb-2">
          <History size={15} />
          {t.history}
        </h2>
        {!history ? (
          <div className="flex justify-center py-3">
            <Loader2 size={18} className="animate-spin text-text-muted" />
          </div>
        ) : history.entries.length === 0 ? (
          <p className="text-[0.8rem] text-text-muted">{t.noHistory}</p>
        ) : (
          <ul className="space-y-1.5 max-h-[280px] overflow-y-auto">
            {history.entries.map((e) => {
              const delta = e.newScore - e.oldScore;
              const noteText = e.kind === 'undo' ? `${t.undoOf} ${e.note ?? ''}` : e.note === 'studio' ? t.studio : e.note;
              return (
                <li key={e.id} className={`flex items-center gap-2 text-[0.8rem] rounded-[8px] px-2 py-1.5 bg-bg/50 ${e.reverted ? 'opacity-50' : ''}`}>
                  <span className={`font-bold shrink-0 ${delta >= 0 ? 'text-primary-light' : 'text-red-300'} ${e.reverted ? 'line-through' : ''}`} style={{ direction: 'ltr' }}>
                    {delta >= 0 ? '+' : '−'}
                    {formatNumber(Math.abs(delta), lang)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-text-muted">
                    {noteText}
                    {e.reverted && ` (${t.reverted})`}
                  </span>
                  <span className="shrink-0 text-[0.7rem] text-text-muted/80">
                    {e.actor === 'platform' ? t.byAdmin : t.byEditor} · {timeAgo(e.at, lang)}
                  </span>
                  {history.undoableId === e.id && (
                    <button
                      onClick={() => undo(e.id)}
                      disabled={busy}
                      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md border border-primary/30 text-primary-light hover:bg-primary/10 disabled:opacity-50"
                    >
                      <Undo2 size={13} />
                      {t.undo}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <button onClick={onBack} className="flex items-center justify-center gap-1.5 w-full text-[0.85rem] text-text-muted hover:text-primary-light">
        <ArrowRight size={15} className="ltr:rotate-180" />
        {t.back}
      </button>
    </div>,
  );
}
