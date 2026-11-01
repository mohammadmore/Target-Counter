import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { api, messageFor } from '../lib/api';
import { assetUrl } from '../goal/theme';

export const inputClass = 'studio-field w-full rounded-xl px-3 py-2 text-sm';

export const buttonClass = {
  primary:
    'btn-aurora inline-flex items-center justify-center gap-2 rounded-xl font-bold px-4 py-2 text-sm disabled:opacity-45 disabled:cursor-not-allowed',
  ghost:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-st-line/15 bg-st-fill/[0.06] text-st-fg px-4 py-2 text-sm hover:bg-st-fill/[0.12] hover:border-st-line/25 disabled:opacity-45 transition-colors backdrop-blur-md',
  danger:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/35 bg-rose-500/[0.08] text-st-danger px-3 py-2 text-sm hover:bg-rose-500/20 transition-colors',
};

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="glass rounded-2xl p-4 sm:p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-st-fg">{title}</h3>
        {description && <p className="text-xs text-st-muted mt-1 leading-relaxed">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-st-fg/85">{label}</span>
      {children}
      {error ? <span className="block text-xs text-st-danger">{error}</span> : hint && <span className="block text-[0.7rem] text-st-muted/80">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-start gap-3 w-full text-start group">
      <span className={`mt-0.5 shrink-0 w-9 h-5 rounded-full relative transition-colors ${checked ? 'aurora-gradient shadow-[0_0_14px_-2px_rgba(168,85,247,0.8)]' : 'bg-st-fill/15'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'start-[1.1rem]' : 'start-0.5'}`} />
      </span>
      <span>
        <span className="block text-sm text-st-fg">{label}</span>
        {description && <span className="block text-xs text-st-muted/80 mt-0.5">{description}</span>}
      </span>
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="glass-soft inline-flex flex-wrap gap-1 p-1 rounded-xl">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${value === o.value ? 'btn-aurora' : 'text-st-muted hover:bg-st-fill/10 hover:text-st-fg'}`}
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
        className="w-9 h-9 rounded-lg border border-st-line/20 bg-transparent cursor-pointer shrink-0 shadow-[0_0_12px_-4px_rgba(255,255,255,0.4)]"
        aria-label={label}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[0.7rem] text-st-muted truncate">{label}</div>
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value.toLowerCase());
          }}
          onBlur={() => setDraft(value)}
          className="w-full bg-transparent text-xs font-mono text-st-fg/85 focus:outline-none focus:text-st-fg"
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
            {kind === 'image' && <img src={assetUrl(value)} alt="" className="h-9 w-14 object-cover rounded-lg border border-st-line/20" />}
            {kind === 'font' && <span className="text-xs text-st-ok">فونت آپلود شد</span>}
            <button type="button" onClick={() => onChange('')} className="p-1.5 rounded-lg text-st-muted hover:text-st-danger hover:bg-st-fill/10" aria-label="حذف">
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
      {error && <p className="text-xs text-st-danger">{error}</p>}
    </div>
  );
}
