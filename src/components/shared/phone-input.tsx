'use client';

import { useRef } from 'react';
import {
  US_PHONE_LENGTH,
  US_PHONE_PLACEHOLDER,
  formatUsPhone,
  usNationalDigits,
} from '@/lib/phone';

const PHONE_CODES: Record<string, { length: number; placeholder: string; flag: string }> = {
  '+1': { length: US_PHONE_LENGTH, placeholder: US_PHONE_PLACEHOLDER, flag: '🇺🇸' },
};

const defaultInputClass =
  'w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all text-left disabled:opacity-60';

interface PhoneInputProps {
  /** Отформатированное значение, например (555) 123-4567. */
  value: string;
  /** Возвращает отформатированное значение. */
  onChange: (value: string) => void;
  countryCode?: string;
  onCountryCodeChange?: (code: string) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
  disabled?: boolean;
  inputClassName?: string;
}

/**
 * Ввод телефона США с маской (XXX) XXX-XXXX и сохранением позиции курсора.
 * Тот же UX, что на странице /auth.
 */
export function PhoneInput({
  value,
  onChange,
  countryCode,
  onCountryCodeChange,
  onEnter,
  autoFocus,
  disabled,
  inputClassName,
}: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedCode = countryCode ?? '+1';
  const rule = PHONE_CODES[selectedCode] ?? PHONE_CODES['+1'];
  const currentFormatted = formatUsPhone(value);

  const getCursorPos = (oldVal: string, newVal: string, oldPos: number, digitsAdded: number) => {
    const oldMaskBefore = oldVal.slice(0, oldPos).replace(/\d/g, '').length;
    const digitPos = oldPos - oldMaskBefore + digitsAdded;
    let digitCount = 0;
    for (let i = 0; i < newVal.length; i++) {
      if (/\d/.test(newVal[i])) {
        if (digitCount === digitPos) return i + 1;
        digitCount++;
      }
    }
    return newVal.length;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const oldDigits = usNationalDigits(currentFormatted);
    const newDigits = usNationalDigits(input.value);

    if (newDigits.length > rule.length) return; // блокируем переполнение

    const formatted = formatUsPhone(newDigits);
    const added = newDigits.length - oldDigits.length;
    const cursorPos = getCursorPos(currentFormatted, formatted, input.selectionStart || 0, added > 0 ? added : 0);

    onChange(formatted);

    // Возвращаем курсор после ре-рендера
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(cursorPos, cursorPos);
    });
  };

  // Backspace/Delete через символы маски
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onEnter?.();
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      const input = e.currentTarget;
      const cursorPos = input.selectionStart || 0;
      const charBefore = currentFormatted[cursorPos - 1];

      if (e.key === 'Backspace' && charBefore && !/\d/.test(charBefore)) {
        e.preventDefault();
        const before = currentFormatted.slice(0, cursorPos - 1);
        const after = currentFormatted.slice(cursorPos);
        const newDigits = usNationalDigits(before + after);
        const formatted = formatUsPhone(newDigits);
        const targetDigits = usNationalDigits(currentFormatted.slice(0, cursorPos)).length - 1;

        onChange(formatted);

        requestAnimationFrame(() => {
          if (!inputRef.current) return;
          let pos = 0;
          let count = 0;
          for (let i = 0; i < formatted.length; i++) {
            if (/\d/.test(formatted[i])) {
              if (count === targetDigits) { pos = i + 1; break; }
              count++;
            }
          }
          inputRef.current.setSelectionRange(pos || formatted.length, pos || formatted.length);
        });
      }
    }
  };

  return (
    <div className="flex gap-2">
      <select
        value={selectedCode}
        onChange={(e) => {
          onCountryCodeChange?.(e.target.value);
          onChange('');
        }}
        className="w-[4.5rem] shrink-0 rounded-xl border border-border/60 bg-background px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer disabled:opacity-60"
        disabled={disabled}
        aria-label="Код страны"
      >
        {Object.entries(PHONE_CODES).map(([code, r]) => (
          <option key={code} value={code}>{r.flag} {code}</option>
        ))}
      </select>
      <input
        ref={inputRef}
        value={currentFormatted}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        type="tel"
        inputMode="numeric"
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={rule.placeholder}
        className={inputClassName ?? defaultInputClass}
      />
    </div>
  );
}
