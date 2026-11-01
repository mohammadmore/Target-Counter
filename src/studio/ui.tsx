import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { api, messageFor } from '../lib/api';
import { assetUrl } from '../goal/theme';

export const inputClass =
  'w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none transition-colors';

export const buttonClass = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 text-zinc-950 font-bold px-4 py-2 text-sm hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
  ghost:
    'inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700 text-zinc-200 px-4 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50 transition-colors',
  danger: 'inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/40 text-red-300 px-3 py-2 text-sm hover:bg-red-500/10 transition-colors',
};

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
        {description && <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-zinc-300">{label}</span>
      {children}
      {error ? <span className="block text-xs text-red-400">{error}</span> : hint && <span className="block text-[0.7rem] text-zinc-500">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-start gap-3 w-full text-start group">
      <span className={`mt-0.5 shrink-0 w-9 h-5 rounded-full relative transition-colors ${checked ? 'bg-amber-400' : 'bg-zinc-700'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'start-[1.1rem]' : 'start-0.5'}`} />
      </span>
      <span>
        <span className="block text-sm text-zinc-100">{label}</span>
        {description && <span className="block text-xs text-zinc-500 mt-0.5">{description}</span>}
      </span>
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${value === o.value ? 'bg-amber-400 text-zinc-950' : 'text-zinc-300 hover:bg-zinc-800'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const full = value.length === 4 ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}` : value;
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={full}
        onChange={(e) => onChange(e.target.value)}
        className="w-9 h-9 rounded-md border border-zinc-700 bg-transparent cursor-pointer shrink-0"
        aria-label={label}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[0.7rem] text-zinc-400 truncate">{label}</div>
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value.toLowerCase());
          }}
          onBlur={() => setDraft(value)}
          className="w-full bg-transparent text-xs font-mono text-zinc-200 focus:outline-none"
          dir="ltr"
          aria-label={`${label} (hex)`}
        />
      </div>
    </div>
  );
}

/** Uploads a file through the API and reports the stored reference ("uploads/…"). */
export function UploadField({
  token,
  kind,
  value,
  onChange,
  label,
  accept,
}: {
  token: string;
  kind: 'image' | 'font';
  value: string;
  onChange: (ref: string) => void;
  label: string;
  accept: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const upload = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const { url } = await api.upload(token, kind, file);
      onChange(url);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <button type="button" className={buttonClass.ghost} onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {label}
        </button>
        {value && (
          <>
            {kind === 'image' && <img src={assetUrl(value)} alt="" className="h-9 w-14 object-cover rounded border border-zinc-700" />}
            {kind === 'font' && <span className="text-xs text-emerald-400">فونت آپلود شد</span>}
            <button type="button" onClick={() => onChange('')} className="p-1.5 rounded-md text-zinc-400 hover:text-red-300 hover:bg-zinc-800" aria-label="حذف">
              <X size={16} />
            </button>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
