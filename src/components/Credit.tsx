import { useEffect, useId, useRef, useState } from 'react';
import { ExternalLink, Globe, Instagram, Link as LinkIcon, Linkedin, Mail, MessageCircle, Phone, Send, X } from 'lucide-react';
import type { ColorMode } from '../goal/types';
import type { Contact } from '../lib/api';
import { assetUrl } from '../goal/theme';
import { CONTACT_LABELS, contactHref, usePlatformProfile } from '../lib/platform';
import type { Lang } from '../lib/format';

export const CREDIT_LINE_1 = 'Powered by Asva Studio';
export const CREDIT_LINE_2 = 'توسعه یافته توسط شرکت داده پردازان اسوا';
export const POSTER_CREDIT = 'by Asva Studio';

const ICONS: Record<Contact['type'], typeof Globe> = {
  website: Globe,
  email: Mail,
  phone: Phone,
  whatsapp: MessageCircle,
  telegram: Send,
  instagram: Instagram,
  linkedin: Linkedin,
  link: LinkIcon,
};

const POPOVER_TITLE: Record<Lang, string> = { fa: 'ارتباط با اسوا', ar: 'تواصل مع أسوا', en: 'Contact Asva' };

/** Built-in Asva mark, used until the admin uploads the studio logos. */
function DefaultMark({ className = '' }: { className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={`asva-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#asva-${id})`} />
      <path d="M32 14 L47 50 H40.5 L37.4 42 H26.6 L23.5 50 H17 Z M28.6 36.6 H35.4 L32 27.6 Z" fill="#fff" />
    </svg>
  );
}

/** The Asva logo in a circle, right for the background it sits on. */
export function AsvaLogo({ mode, size = 28 }: { mode: ColorMode; size?: number }) {
  const { logoLight, logoDark } = usePlatformProfile();
  const src = mode === 'dark' ? logoDark || logoLight : logoLight || logoDark;
  return (
    <span className="shrink-0 rounded-full overflow-hidden flex items-center justify-center bg-white/10" style={{ width: size, height: size }}>
      {src ? <img src={assetUrl(src)} alt="Asva Studio" className="w-full h-full object-cover" /> : <DefaultMark className="w-full h-full" />}
    </span>
  );
}

const TONES = {
  /** On goal pages: the goal's own palette. */
  goal: {
    pill: 'bg-surface/85 border border-primary/25 text-text shadow-[0_6px_24px_-6px_rgb(0_0_0/var(--shade))] backdrop-blur-md',
    muted: 'text-text-muted',
    popover: 'bg-surface border border-primary/25 text-text shadow-[0_18px_50px_-12px_rgb(0_0_0/var(--shade))]',
    item: 'hover:bg-primary/10',
    icon: 'text-primary-light',
  },
  /** In the studio: the glass look (works in both studio modes). */
  studio: {
    pill: 'glass text-st-fg',
    muted: 'text-st-muted',
    popover: 'glass-strong text-st-fg',
    item: 'hover:bg-st-fill/10',
    icon: 'text-st-accent',
  },
} as const;

/**
 * Floating "Powered by Asva Studio" credit shown at the bottom of every page.
 * Clicking it opens the contact links the admin set in studio settings.
 */
export default function Credit({ mode, tone, lang = 'fa' }: { mode: ColorMode; tone: keyof typeof TONES; lang?: Lang }) {
  const { contacts } = usePlatformProfile();
  const t = TONES[tone];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const links = contacts.map((c) => ({ ...c, href: contactHref(c) })).filter((c) => c.href);
  const interactive = links.length > 0;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const body = (
    <>
      <AsvaLogo mode={mode} />
      <span className="flex flex-col items-start leading-tight text-start">
        <span className="text-[11px] font-bold tracking-wide whitespace-nowrap" dir="ltr">
          {CREDIT_LINE_1}
        </span>
        <span className={`text-[9.5px] whitespace-nowrap ${t.muted}`} dir="rtl">
          {CREDIT_LINE_2}
        </span>
      </span>
    </>
  );

  return (
    <div
      ref={rootRef}
      data-capture-skip=""
      className="fixed z-[55] left-1/2 -translate-x-1/2 bottom-[max(10px,env(safe-area-inset-bottom))] font-vazirmatn"
      dir="rtl"
    >
      {open && (
        <div role="dialog" aria-label={POPOVER_TITLE[lang]} className={`anim-fade-up absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-[240px] rounded-2xl p-2 ${t.popover}`}>
          <div className="flex items-center gap-2 px-2 pt-1 pb-2">
            <AsvaLogo mode={mode} size={22} />
            <span className="flex-1 text-[12px] font-bold">{POPOVER_TITLE[lang]}</span>
            <button onClick={() => setOpen(false)} className={`p-1 rounded-lg ${t.item} ${t.muted}`} aria-label="close">
              <X size={14} />
            </button>
          </div>
          <ul className="space-y-0.5">
            {links.map((c, i) => {
              const Icon = ICONS[c.type];
              const external = c.href!.startsWith('https:');
              return (
                <li key={i}>
                  <a
                    href={c.href!}
                    target={external ? '_blank' : undefined}
                    rel={external ? 'noopener noreferrer' : undefined}
                    className={`flex items-center gap-2.5 px-2 py-2 rounded-xl text-[12.5px] transition-colors ${t.item}`}
                  >
                    <Icon size={15} className={`shrink-0 ${t.icon}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium">{c.label || CONTACT_LABELS[c.type][lang]}</span>
                      <span className={`block text-[11px] truncate ${t.muted}`} dir="ltr" style={{ textAlign: 'start' }}>
                        {c.value}
                      </span>
                    </span>
                    {external && <ExternalLink size={12} className={`shrink-0 ${t.muted}`} />}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {interactive ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={`flex items-center gap-2 ps-1 pe-3 py-1 rounded-full transition-transform hover:scale-[1.03] ${t.pill}`}
        >
          {body}
        </button>
      ) : (
        <div className={`flex items-center gap-2 ps-1 pe-3 py-1 rounded-full ${t.pill}`}>{body}</div>
      )}
    </div>
  );
}

/** Minimal credit drawn into downloaded posters only. */
export function PosterCredit({ mode }: { mode: ColorMode }) {
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 text-[11px] font-semibold text-text-muted" dir="ltr">
      <AsvaLogo mode={mode} size={16} />
      {POSTER_CREDIT}
    </div>
  );
}
