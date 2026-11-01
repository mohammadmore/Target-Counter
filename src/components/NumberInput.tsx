import { useEffect, useRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { formatNumber, parseWholeNumber, type Lang } from '../lib/format';

const DIGIT = /[0-9۰-۹٠-٩]/;

/** Formats with thousands separators in the given language ("60000000" → "۶۰٬۰۰۰٬۰۰۰"). */
export function groupDigits(value: number, lang: Lang) {
  return formatNumber(value, lang, { useGrouping: true, maximumFractionDigits: 0 });
}

/** Caret position in `formatted` that sits after the `digitsBefore`-th digit. */
export function caretAfterDigits(formatted: string, digitsBefore: number) {
  if (digitsBefore <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (DIGIT.test(formatted[i]) && ++seen === digitsBefore) return i + 1;
  }
  return formatted.length;
}

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number | null;
  onChange: (value: number | null) => void;
  lang: Lang;
}

/**
 * Whole-number input that groups thousands while typing (so 1,250,000,000,000
 * is readable) and accepts Latin, Persian and Arabic digits. Keeps the caret
 * next to the digit the user was editing.
 */
export default function NumberInput({ value, onChange, lang, onBlur, ...rest }: NumberInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => (value === null ? '' : groupDigits(value, lang)));
  const pendingCaret = useRef<number | null>(null);

  // Follow outside changes (wheels, resets) unless they match what's typed.
  useEffect(() => {
    if (parseWholeNumber(text) !== value) setText(value === null ? '' : groupDigits(value, lang));
  }, [value, lang]);

  useEffect(() => {
    if (pendingCaret.current !== null && ref.current && document.activeElement === ref.current) {
      ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = null;
  });

  return (
    <input
      {...rest}
      ref={ref}
      inputMode="numeric"
      autoComplete="off"
      dir="ltr"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        const caret = e.target.selectionStart ?? raw.length;
        const digitsBefore = raw.slice(0, caret).split('').filter((c) => DIGIT.test(c)).length;
        const parsed = parseWholeNumber(raw);
        if (raw.trim() === '') {
          setText('');
          onChange(null);
          return;
        }
        if (parsed === null) {
          setText(raw); // keep what they typed; the parent shows the validation message
          onChange(null);
          return;
        }
        const formatted = groupDigits(parsed, lang);
        pendingCaret.current = caretAfterDigits(formatted, digitsBefore);
        setText(formatted);
        onChange(parsed);
      }}
      onBlur={(e) => {
        if (value !== null) setText(groupDigits(value, lang));
        onBlur?.(e);
      }}
    />
  );
}
