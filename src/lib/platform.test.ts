import { describe, expect, it } from 'vitest';
import { contactHref } from './platform';

describe('contactHref', () => {
  it('builds safe links from what admins type', () => {
    expect(contactHref({ type: 'website', value: 'asva.ir', label: '' })).toBe('https://asva.ir');
    expect(contactHref({ type: 'website', value: 'http://asva.ir', label: '' })).toBe('https://asva.ir');
    expect(contactHref({ type: 'email', value: 'info@asva.ir', label: '' })).toBe('mailto:info@asva.ir');
    expect(contactHref({ type: 'phone', value: '+98 (21) 1234-5678', label: '' })).toBe('tel:+982112345678');
    expect(contactHref({ type: 'whatsapp', value: '+98 912 123 4567', label: '' })).toBe('https://wa.me/989121234567');
    expect(contactHref({ type: 'telegram', value: '@asvastudio', label: '' })).toBe('https://t.me/asvastudio');
    expect(contactHref({ type: 'instagram', value: 'asva.studio', label: '' })).toBe('https://instagram.com/asva.studio');
  });

  it('rejects unsafe or malformed values', () => {
    expect(contactHref({ type: 'link', value: 'javascript:alert(1)', label: '' })).toBeNull();
    expect(contactHref({ type: 'link', value: 'http://insecure.example', label: '' })).toBeNull();
    expect(contactHref({ type: 'email', value: 'not-an-email', label: '' })).toBeNull();
    expect(contactHref({ type: 'website', value: 'a" onclick="x', label: '' })).toBeNull();
    expect(contactHref({ type: 'telegram', value: 'x y', label: '' })).toBeNull();
  });
});
