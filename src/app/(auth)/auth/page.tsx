'use client';

import { useState, useEffect, useRef } from 'react';
import { Shield, Loader2, Check, Smartphone, User, Sparkles, MapPin, ArrowRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { PhoneInput } from '@/components/shared/phone-input';
import { US_PHONE_LENGTH } from '@/lib/phone';
import type { UserProfile } from '@/lib/types';

/* ──────────────────────────────────────────────
   Pending booking context (sessionStorage)
   ────────────────────────────────────────────── */

interface PendingBooking {
  nailDesignId: string;
  nailMasterId: string;
  requestedDateTime: string;
  clientNotes?: string;
  description?: string;
  price?: string;
  masterName?: string;
  masterCity?: string;
}

function readPendingBooking(): PendingBooking | null {
  try {
    const raw = sessionStorage.getItem('pending_booking');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/* ──────────────────────────────────────────────
   Styles
   ────────────────────────────────────────────── */

const inputClass =
  'w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all text-left';

/* ══════════════════════════════════════════════
   AuthPage — passwordless OTP auth

   Пользователь просто вводит телефон. Система сама
   определяет — новый он или вернувшийся. Новым
   показывается шаг с именем и возрастом после
   верификации кода. Вернувшиеся заходят сразу.
   ══════════════════════════════════════════════ */

type Step = 'phone' | 'code' | 'name';

interface DemoAccount {
  role: 'admin' | 'client' | 'nailmaster';
  label: string;
  phone: string;
}

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, getToken, refresh } = useAuth();
  const queryAs = searchParams.get('as');       // 'master' → регистрация мастером
  const queryMode = searchParams.get('mode');    // 'login' → явный вход в существующий аккаунт
  const registerAs = queryAs === 'master' ? 'nailmaster' : 'client';
  const isExplicitLogin = queryMode === 'login';

  /* ── Form state ─────────────────────────── */

  // Явный вход → сбрасываем контекст букинга (пользователь хочет войти, а не записаться)
  useEffect(() => {
    if (isExplicitLogin) sessionStorage.removeItem('pending_booking');
  }, [isExplicitLogin]);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [codeExpiry, setCodeExpiry] = useState(0);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [demoCode, setDemoCode] = useState('000000');
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const formTopRef = useRef<HTMLDivElement>(null);

  /* ── Derived ────────────────────────────── */

  const fullPhone = `${countryCode}${phone.replace(/\D/g, '')}`;
  // Явный вход — букинг не показываем (пользователь хочет войти в аккаунт, а не записаться)
  const bookingCtx = (!isExplicitLogin && registerAs === 'client') ? readPendingBooking() : null;
  const hasBookingContext = !!(bookingCtx?.description);
  const isBecomingMaster = registerAs === 'nailmaster';

  /* ── Auto-scroll to top on step change ──── */

  useEffect(() => {
    if (step !== 'phone') {
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [step]);

  /* ── Countdown timer ────────────────────── */

  useEffect(() => {
    if (codeExpiry <= 0) return;
    const t = setInterval(() => setCodeExpiry((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [codeExpiry]);

  /* ── Тестовые учётки для быстрого входа ─── */

  useEffect(() => {
    let active = true;
    fetch('/api/auth/demo-accounts', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (!active || !json.success || !json.data?.enabled) return;
        setDemoAccounts(json.data.accounts || []);
        setDemoCode(json.data.code || '000000');
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  /* ── API helper ─────────────────────────── */

  const callAuth = async (data: Record<string, unknown>) => {
    setLoading(true);
    setError('');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const currentToken = getToken();
      if (currentToken) headers['Authorization'] = `Bearer ${currentToken}`;

      // action=send → request-code, action=verify → verify-code
      const endpoint = data.action === 'send'
        ? '/api/auth/request-code'
        : '/api/auth/verify-code';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      const json = await res.json();
      setLoading(false);
      return json;
    } catch {
      setError('Ошибка соединения');
      setLoading(false);
      return null;
    }
  };

  /* ── Persist auth ───────────────────────── */

  const persistAuth = (data: { token: string; refreshToken: string; user: Record<string, unknown> }) => {
    login({
      token: data.token,
      refreshToken: data.refreshToken,
      user: data.user as unknown as UserProfile,
    });
  };

  /* ── Быстрый вход за тестовую учётку ─────── */

  const quickLogin = async (account: DemoAccount) => {
    if (demoLoading || loading) return;
    setDemoLoading(account.role);
    setError('');
    try {
      const sendRes = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: account.phone }),
      });
      const sendJson = await sendRes.json();
      if (!sendJson.success) throw new Error(sendJson.error || 'Не удалось получить код');

      const verifyRes = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: account.phone, code: demoCode, role: account.role }),
      });
      const verifyJson = await verifyRes.json();
      if (!verifyJson.success) throw new Error(verifyJson.error || 'Не удалось войти');

      persistAuth(verifyJson.data);
      router.replace(account.role === 'admin' ? '/admin' : '/profile');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка быстрого входа');
    } finally {
      setDemoLoading(null);
    }
  };

  /* ── Complete new-user registration ─────── */

  const completeRegistration = async (token: string) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fullName: fullName.trim(),
          age: parseInt(age),
          role: registerAs,
        }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error || 'Ошибка сохранения профиля');
        setLoading(false);
        return;
      }

      // Профиль обновлён на сервере — перечитываем сессию (fullName, role)
      await refresh();

      // Если был букинг — создаём заказ
      const ctx = readPendingBooking();
      if (ctx && registerAs === 'client') {
        try {
          const bookingRes = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              nailDesignId: ctx.nailDesignId,
              nailMasterId: ctx.nailMasterId,
              requestedDateTime: ctx.requestedDateTime,
              clientNotes: ctx.clientNotes,
              description: ctx.description,
              price: ctx.price,
            }),
          });
          if (bookingRes.ok) {
            sessionStorage.removeItem('pending_booking');
            sessionStorage.setItem('just_booked', '1');
            router.push('/profile?tab=orders');
            return;
          }
        } catch { /* заказ не создался — но профиль уже готов */ }
      }

      // Мастер — чистим бронь, идём домой
      if (registerAs === 'nailmaster') {
        sessionStorage.removeItem('pending_booking');
      }

      if (window.history.length > 1) router.back();
      else router.push('/');
    } catch {
      setError('Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 1: Request SMS code ───────────── */

  const requestCode = async () => {
    const digits = phone.replace(/\D/g, '');

    if (digits.length !== US_PHONE_LENGTH) {
      setError(`Введите номер телефона полностью (${US_PHONE_LENGTH} цифр)`);
      return;
    }

    const json = await callAuth({ phone: fullPhone, action: 'send' });
    if (json?.success) {
      setStep('code');
      setCodeExpiry(json.data?.expiresIn || 300);
      setCode(['', '', '', '', '', '']);
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
    } else if (json) {
      setError(json.error || 'Ошибка отправки кода');
    }
  };

  /* ── Code input ─────────────────────────── */

  const handleCodeInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...code];
    next[index] = value.slice(-1);
    setCode(next);

    if (value && index < 5) codeInputRefs.current[index + 1]?.focus();
    if (!value && index > 0) codeInputRefs.current[index - 1]?.focus();

    if (index === 5 && value) {
      const fullCode = [...next.slice(0, 5), value].join('');
      setTimeout(() => verifyCode(fullCode), 200);
    }
  };

  /* ── Step 2: Verify code ────────────────── */

  const verifyCode = async (manualCode?: string) => {
    const finalCode = manualCode || code.join('');
    if (finalCode.length < 6) {
      setError('Введите 6 цифр кода');
      return;
    }

    const json = await callAuth({
      phone: fullPhone, code: finalCode, action: 'verify', role: registerAs,
    });

    if (!json?.success) {
      setError(json?.error || 'Неверный код');
      return;
    }

    persistAuth(json.data);

    if (json.data.isNew) {
      // Новый пользователь → шаг с именем и возрастом
      setStep('name');
    } else {
      // Вернувшийся пользователь (в т.ч. гость → клиент после подтверждения телефона)
      // Если был отложенный букинг — создаём заказ
      const ctx = readPendingBooking();
      if (ctx && registerAs === 'client') {
        try {
          const bookingRes = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${json.data.token}` },
            body: JSON.stringify({
              nailDesignId: ctx.nailDesignId,
              nailMasterId: ctx.nailMasterId,
              requestedDateTime: ctx.requestedDateTime,
              clientNotes: ctx.clientNotes,
              description: ctx.description,
              price: ctx.price,
            }),
          });
          if (bookingRes.ok) {
            sessionStorage.removeItem('pending_booking');
            sessionStorage.setItem('just_booked', '1');
            router.push('/profile?tab=orders');
            return;
          }
        } catch { /* заказ не создался — но профиль уже готов */ }
      }

      if (window.history.length > 1) router.back();
      else router.push('/');
    }
  };

  /* ── Step 3: Save name + age (new users) ── */

  const handleCompleteProfile = async () => {
    if (fullName.trim().length < 2) {
      setError('Введите имя');
      return;
    }
    const ageNum = parseInt(age);
    if (!age || isNaN(ageNum) || ageNum < 14 || ageNum > 120) {
      setError('Укажите возраст от 14 до 120 лет');
      return;
    }

    const token = getToken();
    if (!token) { setError('Сессия истекла. Попробуйте снова.'); return; }

    await completeRegistration(token);
  };

  /* ══════════════════════════════════════════
     Render
     ══════════════════════════════════════════ */

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        {/* ── Booking context banner ── */}
        {hasBookingContext && step === 'phone' && (
          <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Вы записываетесь на маникюр
              </span>
            </div>
            <p className="text-sm font-semibold text-foreground">
              &laquo;{bookingCtx.description}&raquo;
            </p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              {bookingCtx.masterName && (
                <span className="inline-flex items-center gap-1">
                  <User className="h-3 w-3 opacity-60" />{bookingCtx.masterName}
                </span>
              )}
              {bookingCtx.masterCity && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3 opacity-60" />{bookingCtx.masterCity}
                </span>
              )}
              {bookingCtx.price && (
                <span className="font-semibold text-primary">
                  ${parseInt(bookingCtx.price).toLocaleString('en-US')}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground/70">
              Подтвердите телефон — и запись будет создана
            </p>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20 flex items-start gap-2">
            <Shield className="h-4 w-4 shrink-0 mt-0.5" />{error}
          </div>
        )}

        <div ref={formTopRef} className="rounded-2xl border border-border/40 bg-card p-6 shadow-sm">
          {/* ══════════════════════════════════════
              Step 1: Phone
              ══════════════════════════════════════ */}
          {step === 'phone' && (
            <>
              <div className="text-center mb-6">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/[0.06]">
                  <Smartphone className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-xl font-bold">
                  {isBecomingMaster
                    ? 'Стать мастером'
                    : isExplicitLogin
                      ? 'Вход в аккаунт'
                      : hasBookingContext
                        ? 'Подтвердите телефон'
                        : 'Добро пожаловать'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1.5">
                  {isBecomingMaster
                    ? 'Введите номер телефона для создания аккаунта мастера'
                    : isExplicitLogin
                      ? 'Введите номер телефона, привязанный к вашему аккаунту'
                      : hasBookingContext
                        ? 'Остался последний шаг до записи'
                        : 'Введите номер телефона, чтобы войти или создать аккаунт'}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Номер телефона
                  </label>
                  <PhoneInput
                    value={phone}
                    onChange={setPhone}
                    countryCode={countryCode}
                    onCountryCodeChange={(code) => { setCountryCode(code); setPhone(''); }}
                    onEnter={requestCode}
                    autoFocus
                    inputClassName={`flex-1 ${inputClass}`}
                  />
                </div>

                <button
                  onClick={requestCode}
                  disabled={loading}
                  className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Получить код
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </button>

                <p className="text-center text-[11px] text-muted-foreground/60">
                  Отправим 6-значный код для подтверждения. Без спама, без паролей.
                </p>

                {demoAccounts.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-border/60" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Тестовый вход
                      </span>
                      <div className="h-px flex-1 bg-border/60" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {demoAccounts.map((account) => (
                        <button
                          key={account.role}
                          type="button"
                          onClick={() => quickLogin(account)}
                          disabled={!!demoLoading || loading}
                          className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border/60 py-2.5 text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors"
                        >
                          {account.role === 'admin'
                            ? <Shield className="h-4 w-4" />
                            : account.role === 'nailmaster'
                              ? <Sparkles className="h-4 w-4" />
                              : <User className="h-4 w-4" />}
                          {demoLoading === account.role ? 'Вход...' : account.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-center text-[11px] text-muted-foreground/60">
                      Быстрый вход для тестовых учётных записей
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ══════════════════════════════════════
              Step 2: Code verification
              ══════════════════════════════════════ */}
          {step === 'code' && (
            <>
              <div className="text-center mb-6">
                <div className="h-10 w-10 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Код отправлен</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Мы отправили 6-значный код на номер{' '}
                  <span className="font-medium text-foreground">{fullPhone}</span>
                </p>
                <button
                  onClick={() => { setStep('phone'); setCode(['', '', '', '', '', '']); }}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Неверный номер? Изменить
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex justify-center gap-2">
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { codeInputRefs.current[i] = el; }}
                      value={digit}
                      onChange={(e) => handleCodeInput(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !digit && i > 0) {
                          codeInputRefs.current[i - 1]?.focus();
                        }
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      autoComplete="one-time-code"
                      className="h-12 w-10 rounded-xl border border-border/60 bg-background text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                    />
                  ))}
                </div>

                <button
                  onClick={() => verifyCode()}
                  disabled={loading || code.join('').length < 6}
                  className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
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

          {/* ══════════════════════════════════════
              Step 3: Name + Age (new users only)
              ══════════════════════════════════════ */}
          {step === 'name' && (
            <>
              <div className="text-center mb-6">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/[0.06]">
                  <User className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-xl font-bold">
                  {isBecomingMaster
                    ? 'Создание профиля мастера'
                    : isExplicitLogin
                      ? 'Новый аккаунт'
                      : 'Почти готово!'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1.5">
                  {isBecomingMaster
                    ? 'Клиенты увидят ваше имя. Возраст нужен для подбора безопасных материалов.'
                    : isExplicitLogin
                      ? 'Этот номер телефона ещё не зарегистрирован. Создайте аккаунт.'
                      : 'Ещё пара деталей.'}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Ваше имя
                  </label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    type="text"
                    autoFocus
                    className={inputClass}
                    placeholder="Анна"
                    autoComplete="given-name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Возраст
                  </label>
                  <input
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    type="number"
                    min={14}
                    max={120}
                    className={inputClass}
                    placeholder="25"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground/60">
                    Обязательно — некоторые материалы имеют возрастные ограничения
                  </p>
                </div>

                <button
                  onClick={handleCompleteProfile}
                  disabled={loading || fullName.trim().length < 2 || !age}
                  className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isBecomingMaster ? 'Начать как мастер' : hasBookingContext ? 'Завершить запись' : 'Создать аккаунт'}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        {step === 'phone' && (
          <div className="text-center mt-6 space-y-2">
            <button
              onClick={() => {
                sessionStorage.removeItem('pending_booking');
                if (window.history.length > 1) router.back();
                else router.push('/');
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Назад
            </button>
            {!isBecomingMaster && (
              <p className="text-[11px] text-muted-foreground/50">
                Нажимая «Получить код», вы соглашаетесь с условиями использования
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
