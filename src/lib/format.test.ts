import { describe, expect, it } from 'vitest';
import { formatMillions, fromDigits, parseWholeNumber, toDigits } from './format';

describe('parseWholeNumber', () => {
  it('parses latin, Persian and Arabic digits with separators', () => {
    expect(parseWholeNumber('60000000')).toBe(60_000_000);
    expect(parseWholeNumber('۶۰,۰۰۰,۰۰۰')).toBe(60_000_000);
    expect(parseWholeNumber('٦٠٬٠٠٠٬٠٠٠')).toBe(60_000_000);
    expect(parseWholeNumber(' 1 234 ')).toBe(1234);
  });

  it('rejects non-integers', () => {
    expect(parseWholeNumber('')).toBeNull();
    expect(parseWholeNumber('-5')).toBeNull();
    expect(parseWholeNumber('1.5')).toBeNull();
    expect(parseWholeNumber('abc')).toBeNull();
  });
});

describe('digits', () => {
  it('round-trips through 8 digit wheels', () => {
    expect(toDigits(1234)).toEqual([0, 0, 0, 0, 1, 2, 3, 4]);
    expect(fromDigits(toDigits(59_876_543))).toBe(59_876_543);
    expect(toDigits(-3)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('formatMillions', () => {
  it('uses locale digits', () => {
    expect(formatMillions(60_000_000, 'fa')).toBe('۶۰M');
    expect(formatMillions(15_000_000, 'ar')).toBe('١٥M');
  });
});
