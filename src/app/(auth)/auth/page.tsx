'use client';

import { useState, useEffect, useRef } from 'react';
import { Shield, Loader2, Check, Smartphone, User, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const PHONE_CODES: Record<string, { length: number; placeholder: string; flag: string }> = {
  '+7': { length: 10, placeholder: '(999) 123-45-67', flag: '🇷🇺' },
  '+380': { length: 9, placeholder: '(67) 123-45-67', flag: '🇺🇦' },
  '+375': { length: 9, placeholder: '(29) 123-45-67', flag: '🇧🇾' },
};

type Step = 'phone' | 'code' | 'name';

export default function AuthPage() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+7');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeExpiry, setCodeExpiry] = useState(0);
  const [isNewUser, setIsNewUser] = useState(false);
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryAs = searchParams.get('as'); // 'master' or nothing
  const registerAs = queryAs === 'master' ? 'nailmaster' : 'client';

  // Таймер обратного отсчёта
  useEffect(() => {
    if (codeExpiry <= 0) return;
    const t = setInterval(() => setCodeExpiry(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [codeExpiry]);

  const fullPhone = `${countryCode}${phone.replace(/\D/g, '')}`;

  const formatPhone = (code: string, digits: string) => {
    const rule = PHONE_CODES[code] || PHONE_CODES['+7'];
    const groups = [3, 3, 2, 2];
    const parts: string[] = [];
    let idx = 0;
    for (const g of groups) { if (idx >= digits.length) break; parts.push(digits.slice(idx, idx + g)); idx += g; }
    if (parts.length > 0) { const [first, ...rest] = parts; return `(${first}) ${rest.join('-')}`.trim(); }
    return parts.join(' ').trim();
  };

  const handlePhoneChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    const rule = PHONE_CODES[countryCode] || PHONE_CODES['+7'];
    if (digits.length <= rule.length) setPhone(formatPhone(countryCode, digits));
  };

  // Шаг 1: запрос кода
  const callAuth = async (data: Record<string, unknown>) => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      setLoading(false);
      return json;
    } catch { setError('Ошибка соединения'); setLoading(false); return null; }
  };

  const requestCode = async () => {
    const digits = phone.replace(/\D/g, '');
    const rule = PHONE_CODES[countryCode] || PHONE_CODES['+7'];
    if (digits.length !== rule.length) { setError(`Введите телефон полностью (${rule.length} цифр)`); return; }

    const json = await callAuth({ phone: fullPhone, action: 'send' });
    if (json?.success) {
      setStep('code');
      setCodeExpiry(json.data.expiresIn || 300);
      setCode(['', '', '', '', '', '']);
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
    } else if (json) {
      setError(json.error || 'Ошибка');
    }
  };

  // Обработка ввода кода
  const handleCodeInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...code];
    next[index] = value.slice(-1);
    setCode(next);

    // Авто-переход
    if (value && index < 5) codeInputRefs.current[index + 1]?.focus();
    if (!value && index > 0) codeInputRefs.current[index - 1]?.focus();

    // Авто-отправка при заполнении
    if (index === 5 && value) {
      const fullCode = [...next.slice(0, 5), value].join('');
      setTimeout(() => verifyCode(fullCode), 200);
    }
  };

  // Шаг 2: проверка кода
  const verifyCode = async (manualCode?: string) => {
    const finalCode = manualCode || code.join('');
    if (finalCode.length < 6) { setError('Введите 6 цифр'); return; }

    const json = await callAuth({ phone: fullPhone, code: finalCode, action: 'verify', role: registerAs });
    if (json?.success) {
      localStorage.setItem('token', json.data.token);
      localStorage.setItem('refreshToken', json.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(json.data.user));
      localStorage.removeItem('guest_likes');
      localStorage.setItem('guest_created', '1');
      window.dispatchEvent(new Event('auth-change'));

      if (json.data.isNew) {
        setIsNewUser(true);
        setStep('name');
      } else {
        if (window.history.length > 1) router.back(); else router.push('/');
      }
    } else if (json) {
      setError(json.error || 'Неверный код');
    }
  };

  // Шаг 3: имя и возраст для нового пользователя
  const completeRegistration = async () => {
    if (fullName.trim().length < 2) { setError('Введите имя'); return; }
    const ageNum = parseInt(age);
    if (!age || isNaN(ageNum) || ageNum < 14 || ageNum > 120) { setError('Подтвердите возраст (от 14 лет)'); return; }
    if (!ageConfirmed) { setError('Подтвердите возраст'); return; }
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fullName: fullName.trim(), age: ageNum, role: registerAs }),
      });
      const json = await res.json();
      if (json.success) {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        user.fullName = fullName.trim();
        user.role = registerAs;
        localStorage.setItem('user', JSON.stringify(user));
        window.dispatchEvent(new Event('auth-change'));
        // Если был сохранён контекст букинга — создаём заказ
        const bookingCtx = sessionStorage.getItem('pending_booking');
        if (bookingCtx) {
          try {
            const ctx = JSON.parse(bookingCtx);
            const bookingRes = await fetch('/api/orders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify(ctx),
            });
            if (bookingRes.ok) { sessionStorage.removeItem('pending_booking'); sessionStorage.setItem('just_booked', '1'); router.push('/profile?tab=orders'); return; }
          } catch {}
        }
        if (window.history.length > 1) router.back(); else router.push('/');
      } else {
        setError(json.error || 'Ошибка');
      }
    } catch { setError('Ошибка соединения'); }
    finally { setLoading(false); }
  };

  const inputClass = "w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all text-center";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-1.5 text-2xl font-bold tracking-tight">
            <span className="font-display text-primary">Nail</span>
            <span className="font-display">Masters</span>
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20 flex items-start gap-2">
            <Shield className="h-4 w-4 shrink-0 mt-0.5" />{error}
          </div>
        )}

        <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-sm">
          {/* ── Шаг 1: Телефон ── */}
          {step === 'phone' && (
            <>
              <div className="text-center mb-6">
                <Smartphone className="h-10 w-10 mx-auto mb-3 text-primary" />
                <h2 className="text-xl font-bold">Вход или регистрация</h2>
                <p className="text-sm text-muted-foreground mt-1">Введите номер телефона</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Телефон</label>
                  <div className="flex gap-2">
                    <select value={countryCode} onChange={e => { setCountryCode(e.target.value); setPhone(''); }}
                      className="w-[5.5rem] rounded-xl border border-border/60 bg-background px-2.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer">
                      {Object.entries(PHONE_CODES).map(([code, rule]) => (
                        <option key={code} value={code}>{rule.flag} {code}</option>
                      ))}
                    </select>
                    <input value={phone} onChange={e => handlePhoneChange(e.target.value)} type="tel" autoFocus
                      className={`flex-1 ${inputClass} text-left`} placeholder={PHONE_CODES[countryCode]?.placeholder || '(999) 123-45-67'}
                      onKeyDown={e => { if (e.key === 'Enter') requestCode(); }} />
                  </div>
                </div>

                <button onClick={requestCode} disabled={loading}
                  className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Получить код
                </button>
              </div>
            </>
          )}

          {/* ── Шаг 2: Код ── */}
          {step === 'code' && (
            <>
              <div className="text-center mb-6">
                <div className="h-10 w-10 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Код подтверждения</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Отправлен на <span className="font-medium text-foreground">{fullPhone}</span>
                </p>
                <button onClick={() => { setStep('phone'); setCode(['', '', '', '', '', '']); }} className="text-xs text-primary hover:underline mt-1">
                  Изменить номер
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex justify-center gap-2">
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => { codeInputRefs.current[i] = el; }}
                      value={digit}
                      onChange={e => handleCodeInput(i, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Backspace' && !digit && i > 0) codeInputRefs.current[i - 1]?.focus();
                      }}
                      type="text" inputMode="numeric" maxLength={1} autoComplete="one-time-code"
                      className="h-12 w-10 rounded-xl border border-border/60 bg-background text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                    />
                  ))}
                </div>

                <button onClick={() => verifyCode()} disabled={loading || code.join('').length < 6}
                  className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Подтвердить
                </button>

                {codeExpiry > 0 && (
                  <p className="text-center text-xs text-muted-foreground">
                    Повторный код через {Math.floor(codeExpiry / 60)}:{String(codeExpiry % 60).padStart(2, '0')}
                  </p>
                )}
                {codeExpiry === 0 && (
                  <button onClick={requestCode} className="w-full text-center text-xs text-primary hover:underline">
                    Отправить код повторно
                  </button>
                )}

                <div className="rounded-lg bg-muted/30 p-3 text-center">
                  <p className="text-[11px] text-muted-foreground">Тестовый режим</p>
                  <p className="text-sm font-mono font-bold text-foreground">000000</p>
                </div>
              </div>
            </>
          )}

          {/* ── Шаг 3: Имя и возраст ── */}
          {step === 'name' && (
            <>
              <div className="text-center mb-6">
                <Sparkles className="h-10 w-10 mx-auto mb-3 text-primary" />
                <h2 className="text-xl font-bold">Добро пожаловать!</h2>
                <p className="text-sm text-muted-foreground mt-1">Расскажите о себе</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Ваше имя</label>
                  <input value={fullName} onChange={e => setFullName(e.target.value)} type="text" autoFocus
                    className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-left" placeholder="Анна" />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Возраст <span className="font-normal text-muted-foreground/60">— для персонализации</span>
                  </label>
                  <input value={age} onChange={e => setAge(e.target.value)} type="number" min="14" max="120"
                    className="w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-left" placeholder="25" />
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input type="checkbox" checked={ageConfirmed} onChange={e => setAgeConfirmed(e.target.checked)}
                      className="h-4 w-4 rounded border-border/60 text-primary focus:ring-primary/30" />
                    <span className="text-xs text-muted-foreground">Подтверждаю, что мне есть 14 лет</span>
                  </label>
                </div>

                <button onClick={completeRegistration} disabled={loading || fullName.trim().length < 2 || !age || !ageConfirmed}
                  className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Продолжить
                </button>
              </div>
            </>
          )}
        </div>

        {/* Назад */}
        {step === 'phone' && (
          <p className="text-center mt-6">
            <button onClick={() => {
              if (window.history.length > 1) router.back(); else router.push('/');
            }} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Назад
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
