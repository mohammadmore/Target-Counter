import { describe, expect, it } from 'vitest';
import { caretAfterDigits, groupDigits } from './NumberInput';
import { timeAgo } from '../page/chrome';

describe('number grouping', () => {
  it('groups thousands in each language', () => {
    expect(groupDigits(1250000000000, 'en')).toBe('1,250,000,000,000');
    expect(groupDigits(60000000, 'fa')).toBe('۶۰٬۰۰۰٬۰۰۰');
  });

  it('keeps the caret after the same digit when separators are inserted', () => {
    // typed "12345|" → "12,345|"
    expect(caretAfterDigits('12,345', 5)).toBe(6);
    // caret after the 2nd digit of "1,234" → "1,2|34"
    expect(caretAfterDigits('1,234', 2)).toBe(3);
    expect(caretAfterDigits('۱۲٬۳۴۵', 3)).toBe(4);
    expect(caretAfterDigits('12', 0)).toBe(0);
  });
});

describe('timeAgo', () => {
  const now = 1_800_000_000_000;
  it('speaks the page language', () => {
    expect(timeAgo(now / 1000 - 10, 'en', now)).toBe('just now');
    expect(timeAgo(now / 1000 - 7200, 'en', now)).toBe('2 hours ago');
    expect(timeAgo(now / 1000 - 3 * 86400, 'fa', now)).toContain('۳');
  });
});
