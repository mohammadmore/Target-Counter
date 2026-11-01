import { useEffect, useSyncExternalStore } from 'react';
import { api, CONTACT_TYPES, EMPTY_PROFILE, type Contact, type PlatformProfile } from './api';

// ---------------------------------------------------------------------------
// Shared store for the studio profile (credit logo + contacts). Remembered on
// the device so the credit renders instantly, refreshed from any goal response.
// ---------------------------------------------------------------------------
const CACHE_KEY = 'platform_profile';
const listeners = new Set<() => void>();
let current: PlatformProfile = (() => {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    if (cached && Array.isArray(cached.contacts)) return cached;
  } catch { /* ignore */ }
  return EMPTY_PROFILE;
})();
let fetched = false;

export function setPlatformProfile(profile: PlatformProfile | undefined) {
  if (!profile) return;
  fetched = true;
  if (JSON.stringify(profile) === JSON.stringify(current)) return;
  current = profile;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(profile));
  } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Current profile; fetches it once if no goal response has delivered it yet. */
export function usePlatformProfile(): PlatformProfile {
  const profile = useSyncExternalStore(subscribe, () => current);
  useEffect(() => {
    if (fetched) return;
    fetched = true;
    // Give a goal response (which embeds the profile) a moment to arrive first.
    const id = setTimeout(() => {
      api.getPlatform().then(setPlatformProfile).catch(() => (fetched = false));
    }, 1500);
    return () => clearTimeout(id);
  }, []);
  return profile;
}

// ---------------------------------------------------------------------------
// Contact links
// ---------------------------------------------------------------------------
export const CONTACT_LABELS: Record<Contact['type'], { fa: string; ar: string; en: string; placeholder: string }> = {
  website: { fa: 'وب‌سایت', ar: 'الموقع', en: 'Website', placeholder: 'https://asva.ir' },
  email: { fa: 'ایمیل', ar: 'البريد', en: 'Email', placeholder: 'info@asva.ir' },
  phone: { fa: 'تلفن', ar: 'الهاتف', en: 'Phone', placeholder: '+98 21 1234 5678' },
  whatsapp: { fa: 'واتس‌اپ', ar: 'واتساب', en: 'WhatsApp', placeholder: '+98 912 123 4567' },
  telegram: { fa: 'تلگرام', ar: 'تيليجرام', en: 'Telegram', placeholder: '@asvastudio' },
  instagram: { fa: 'اینستاگرام', ar: 'إنستغرام', en: 'Instagram', placeholder: '@asvastudio' },
  linkedin: { fa: 'لینکدین', ar: 'لينكدإن', en: 'LinkedIn', placeholder: 'https://linkedin.com/company/…' },
  link: { fa: 'لینک', ar: 'رابط', en: 'Link', placeholder: 'https://…' },
};

export const isContactType = (t: unknown): t is Contact['type'] => CONTACT_TYPES.includes(t as Contact['type']);

const handle = (v: string) => v.trim().replace(/^@/, '');
const httpsOnly = (v: string) => (/^https:\/\/[^\s"'<>\\]+$/i.test(v.trim()) ? v.trim() : null);

/** Turns what the admin typed into a safe link (https, mailto or tel only). */
export function contactHref(c: Contact): string | null {
  const v = c.value.trim();
  if (!v) return null;
  switch (c.type) {
    case 'email':
      return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(v) ? `mailto:${v}` : null;
    case 'phone': {
      const digits = v.replace(/[^\d+]/g, '');
      return digits.length >= 5 ? `tel:${digits}` : null;
    }
    case 'whatsapp': {
      if (/^https:/i.test(v)) return httpsOnly(v);
      const digits = v.replace(/\D/g, '');
      return digits.length >= 6 ? `https://wa.me/${digits}` : null;
    }
    case 'telegram':
      return /^https:/i.test(v) ? httpsOnly(v) : /^[A-Za-z0-9_]{3,}$/.test(handle(v)) ? `https://t.me/${handle(v)}` : null;
    case 'instagram':
      return /^https:/i.test(v) ? httpsOnly(v) : /^[A-Za-z0-9_.]{1,}$/.test(handle(v)) ? `https://instagram.com/${handle(v)}` : null;
    case 'website':
      return httpsOnly(/^https?:\/\//i.test(v) ? v.replace(/^http:/i, 'https:') : `https://${v}`);
    default:
      return httpsOnly(v);
  }
}
