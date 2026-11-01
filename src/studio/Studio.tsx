import { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Home, Loader2, LogOut, Palette, PenLine, Plus, Star, Trash2, CopyPlus } from 'lucide-react';
import { api, clearToken, isDevStorage, loadToken, messageFor, storeToken, ApiError, type GoalSummary } from '../lib/api';
import { formatNumber, formatPercent } from '../lib/format';
import { goalUrl, hrefFor, navigate, type Route } from '../router';
import { normalizeConfig } from '../goal/normalize';
import { buttonClass, inputClass } from './ui';
import Wizard from './Wizard';

export default function Studio({ route }: { route: Exclude<Route, { kind: 'goal' } | { kind: 'preview' }> }) {
  const [token, setToken] = useState<string | null>(() => loadToken('platform'));

  useEffect(() => {
    document.title = 'استودیو هدف‌گذاری';
  }, []);

  const logout = useCallback(() => {
    clearToken('platform');
    setToken(null);
  }, []);

  return (
    <div dir="rtl" lang="fa" className="min-h-[100dvh] bg-zinc-950 text-zinc-100 font-vazirmatn">
      {!token ? (
        <Login onLogin={setToken} />
      ) : route.kind === 'wizard' ? (
        <Wizard key={route.slug ?? 'new'} token={token} slug={route.slug} onUnauthorized={logout} />
      ) : (
        <Dashboard token={token} onLogout={logout} />
      )}
    </div>
  );
}

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.login(password);
      if (result.scope !== 'platform') throw new ApiError('invalid_password');
      storeToken('platform', result);
      onLogin(result.token);
    } catch (err) {
      setError(messageFor(err));
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6">
      <form
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div>
          <h1 className="text-lg font-bold">استودیو هدف‌گذاری</h1>
          <p className="text-sm text-zinc-400 mt-1">برای ساخت و مدیریت صفحه‌های هدف، رمز مدیر پلتفرم را وارد کنید.</p>
        </div>
        <input type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="رمز عبور" aria-label="رمز عبور" />
        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
        <button type="submit" className={`${buttonClass.primary} w-full`} disabled={busy || !password}>
          {busy && <Loader2 size={16} className="animate-spin" />}
          ورود
        </button>
        {import.meta.env.DEV && <p className="text-[0.7rem] text-zinc-500">حالت توسعه: هر رمزی پذیرفته می‌شود.</p>}
      </form>
    </div>
  );
}

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [goals, setGoals] = useState<GoalSummary[] | null>(null);
  const [defaultGoal, setDefaultGoal] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const handle = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.code === 'unauthorized') onLogout();
      else setError(messageFor(err));
    },
    [onLogout],
  );

  const refresh = useCallback(async () => {
    try {
      const data = await api.list(token);
      setGoals(data.goals);
      setDefaultGoal(data.defaultGoal);
      setError('');
    } catch (err) {
      handle(err);
    }
  }, [token, handle]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await refresh();
    } catch (err) {
      handle(err);
    }
  };

  const duplicate = (slug: string) =>
    run(async () => {
      const goal = await api.getForEdit(token, slug);
      const config = normalizeConfig(goal.config);
      config.name = `${config.name} (کپی)`;
      let copySlug = `${slug}-copy`;
      for (let i = 2; goals?.some((g) => g.slug === copySlug); i++) copySlug = `${slug}-copy-${i}`;
      await api.save(token, { originalSlug: null, slug: copySlug, config, target: goal.target, score: 0 });
    });

  const copyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(goalUrl(slug));
      setCopied(slug);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      window.prompt('لینک صفحه:', goalUrl(slug));
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">صفحه‌های هدف</h1>
          <p className="text-sm text-zinc-400 mt-1">هر صفحه یک هدف تیمی یا سازمانی با ظاهر و سبک نمایش مخصوص خودش است.</p>
        </div>
        <div className="flex gap-2">
          <button className={buttonClass.primary} onClick={() => navigate({ kind: 'wizard', slug: null })}>
            <Plus size={16} />
            ساخت صفحه‌ی جدید
          </button>
          <button className={buttonClass.ghost} onClick={onLogout} title="خروج">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {isDevStorage() && (
        <p className="text-xs rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-200 px-3 py-2">
          حالت توسعه: سرور PHP در دسترس نیست و داده‌ها فقط در همین مرورگر ذخیره می‌شوند.
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {goals === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-zinc-500" />
        </div>
      ) : goals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700 p-12 text-center space-y-3">
          <p className="text-zinc-300">هنوز هیچ صفحه‌ای نساخته‌اید.</p>
          <button className={buttonClass.primary} onClick={() => navigate({ kind: 'wizard', slug: null })}>
            <Plus size={16} />
            ساخت اولین صفحه
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {goals.map((g) => {
            const ratio = g.target > 0 ? Math.min(g.score / g.target, 1) : 0;
            const name = g.name ?? (g.slug === 'kiyan' ? 'سفیر مروارید کیان‌تیم' : g.slug);
            return (
              <li key={g.slug} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold truncate">{name}</h2>
                      {g.slug === defaultGoal && (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[0.65rem] px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300">
                          <Home size={11} /> صفحه‌ی اصلی
                        </span>
                      )}
                    </div>
                    <a href={hrefFor({ kind: 'goal', slug: g.slug, edit: false })} target="_blank" rel="noreferrer" className="text-xs text-zinc-500 font-mono hover:text-zinc-300" dir="ltr">
                      ?g={g.slug}
                    </a>
                  </div>
                  <span className="text-sm font-bold text-amber-300 shrink-0" dir="ltr">
                    {formatPercent(ratio * 100, 'fa')}%
                  </span>
                </div>

                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${ratio * 100}%` }} />
                </div>
                <div className="text-xs text-zinc-400" dir="ltr" style={{ textAlign: 'right' }}>
                  {formatNumber(g.score, 'fa')} / {formatNumber(g.target, 'fa')}
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <a className={`${buttonClass.ghost} !px-2.5 !py-1.5 !text-xs`} href={hrefFor({ kind: 'goal', slug: g.slug, edit: false })} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} /> مشاهده
                  </a>
                  <button className={`${buttonClass.ghost} !px-2.5 !py-1.5 !text-xs`} onClick={() => navigate({ kind: 'wizard', slug: g.slug })}>
                    <Palette size={14} /> طراحی
                  </button>
                  <a className={`${buttonClass.ghost} !px-2.5 !py-1.5 !text-xs`} href={hrefFor({ kind: 'goal', slug: g.slug, edit: true })}>
                    <PenLine size={14} /> ثبت امتیاز
                  </a>
                  <button className={`${buttonClass.ghost} !px-2.5 !py-1.5 !text-xs`} onClick={() => copyLink(g.slug)}>
                    <Copy size={14} /> {copied === g.slug ? 'کپی شد' : 'لینک'}
                  </button>
                  <button className={`${buttonClass.ghost} !px-2.5 !py-1.5 !text-xs`} onClick={() => duplicate(g.slug)} title="ساخت کپی از این صفحه">
                    <CopyPlus size={14} />
                  </button>
                  {g.slug !== defaultGoal && (
                    <button className={`${buttonClass.ghost} !px-2.5 !py-1.5 !text-xs`} onClick={() => run(() => api.setDefault(token, g.slug))} title="نمایش در آدرس اصلی سایت">
                      <Star size={14} />
                    </button>
                  )}
                  <button
                    className={`${buttonClass.danger} !px-2.5 !py-1.5 !text-xs`}
                    onClick={() => {
                      if (window.confirm(`صفحه‌ی «${name}» و امتیاز ثبت‌شده‌اش برای همیشه حذف شود؟`)) run(() => api.remove(token, g.slug));
                    }}
                    title="حذف"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
