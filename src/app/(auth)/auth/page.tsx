'use client';

import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, ChevronLeft, Loader2, Shield, Sparkles, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const PHONE_RULES: Record<string, { length: number; placeholder: string; flag: string; name: string }> = {
  '+7': { length: 10, placeholder: '(999) 123-45-67', flag: '🇷🇺', name: 'Россия' },
  '+380': { length: 9, placeholder: '(67) 123-45-67', flag: '🇺🇦', name: 'Украина' },
  '+375': { length: 9, placeholder: '(29) 123-45-67', flag: '🇧🇾', name: 'Беларусь' },
  '+1': { length: 10, placeholder: '(555) 123-4567', flag: '🇺🇸', name: 'США' },
  '+44': { length: 10, placeholder: '1234 567 890', flag: '🇬🇧', name: 'Великобритания' },
  '+49': { length: 10, placeholder: '0123 456 789', flag: '🇩🇪', name: 'Германия' },
};

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Слабый', color: 'bg-destructive' };
  if (score <= 3) return { score, label: 'Средний', color: 'bg-gold' };
  return { score, label: 'Надёжный', color: 'bg-secondary' };
}

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<'client' | 'nailmaster'>('client');
  const [step, setStep] = useState<'role' | 'details'>('details');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [countryCode, setCountryCode] = useState('+7');

  useEffect(() => { if (mode === 'register') setStep('role'); else setStep('details'); }, [mode]);
  useEffect(() => { emailRef.current?.focus(); }, [mode, step]);

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) setFieldErrors(prev => { const next = { ...prev }; delete next[field]; return next; });
  };

  const pwStrength = mode === 'register' && password ? passwordStrength(password) : null;

  const formatPhone = (code: string, digits: string) => {
    const rule = PHONE_RULES[code] || PHONE_RULES['+7'];
    const groups = code === '+1' ? [3, 3, 4] : [3, 3, 2, 2];
    const parts: string[] = [];
    let idx = 0;
    for (const g of groups) { if (idx >= digits.length) break; parts.push(digits.slice(idx, idx + g)); idx += g; }
    if (['+7', '+380', '+375'].includes(code) && parts.length > 0) { const [first, ...rest] = parts; return `(${first}) ${rest.join('-')}`.trim(); }
    return parts.join(' ').trim();
  };

  const handlePhoneChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    const rule = PHONE_RULES[countryCode] || PHONE_RULES['+7'];
    if (digits.length <= rule.length) setPhone(formatPhone(countryCode, digits));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (mode === 'register') {
      if (!email.includes('@') || email.length < 5) errs.email = 'Введите корректный email';
      if (password.length < 8) errs.password = 'Минимум 8 символов';
      if (!username || username.length < 3) errs.username = 'Минимум 3 символа';
      const digits = phone.replace(/\D/g, '');
      const rule = PHONE_RULES[countryCode] || PHONE_RULES['+7'];
      if (digits.length !== rule.length) errs.phone = `Должно быть ${rule.length} цифр`;
    } else {
      if (!email.trim()) errs.email = 'Введите email или телефон';
      if (!password) errs.password = 'Введите пароль';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true); setError('');
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body = mode === 'register'
        ? { email, password, username, role, fullName: fullName || undefined, phone: `${countryCode}${phone.replace(/\D/g, '')}`, age: age ? Number(age) : undefined,
            guestLikeIds: JSON.parse(localStorage.getItem('guest_likes') || '[]') }
        : { login: email, password };
      // Pass existing guest token so server can convert instead of creating new
      const existingToken = localStorage.getItem('token');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(existingToken ? { Authorization: `Bearer ${existingToken}` } : {}) },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) { setError(json.error || 'Ошибка'); return; }
      localStorage.setItem('token', json.data.token);
      localStorage.setItem('refreshToken', json.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(json.data.user));
      localStorage.removeItem('guest_likes');
      localStorage.setItem('guest_created', '1');
      window.dispatchEvent(new Event('auth-change'));
      if (window.history.length > 1) router.back(); else router.push('/');
    } catch { setError('Ошибка соединения с сервером'); }
    finally { setLoading(false); }
  };

  const handleGuest = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register-guest', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        localStorage.setItem('token', json.data.token);
        localStorage.setItem('refreshToken', json.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(json.data.user));
        window.dispatchEvent(new Event('auth-change'));
        if (window.history.length > 1) router.back(); else router.push('/');
      }
    } catch { setError('Ошибка'); }
    finally { setLoading(false); }
  };

  const inputClass = "w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all";
  const inputErrorClass = "w-full rounded-xl border border-destructive/50 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-destructive/30 focus:border-destructive/40 transition-all";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-block font-display text-3xl">
            <span className="text-primary">Nail</span>Masters
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === 'login' ? 'Войдите, чтобы продолжить' : 'Присоединяйтесь к платформе'}
          </p>
        </div>

        {/* Mode tabs */}
        <div className="flex rounded-full border border-border/60 bg-muted/40 p-1">
          {(['login', 'register'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setFieldErrors({}); }}
              className={`flex-1 rounded-full py-2.5 text-sm font-medium transition-all ${
                mode === m ? 'bg-background shadow-sm border border-border/30' : 'text-muted-foreground hover:text-foreground'
              }`}>{m === 'login' ? 'Вход' : 'Регистрация'}</button>
          ))}
        </div>

        {/* ── Registration: Step 1 — role picker ── */}
        {mode === 'register' && step === 'role' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="text-center">
              <h2 className="font-display text-xl mb-1">Кто вы?</h2>
              <p className="text-sm text-muted-foreground">Это определит возможности вашего аккаунта</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: 'client', icon: '💅', title: 'Клиент', desc: 'Искать дизайны и записываться к мастерам', benefits: ['Просмотр каталога', 'Запись к мастерам', 'Избранное и отзывы'] },
                { key: 'nailmaster', icon: '✨', title: 'Мастер', desc: 'Публиковать работы и принимать заказы', benefits: ['Портфолио дизайнов', 'Управление заказами', 'Расписание и услуги'] },
              ] as const).map(r => (
                <button key={r.key} onClick={() => { setRole(r.key); setStep('details'); }}
                  className={`rounded-2xl border-2 p-5 text-left transition-all hover:border-primary/40 ${
                    role === r.key ? 'border-primary bg-primary/[0.03] shadow-sm' : 'border-border/40'
                  }`}>
                  <div className="text-3xl mb-2">{r.icon}</div>
                  <div className="font-semibold text-sm">{r.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{r.desc}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setMode('login')} className="w-full text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-1">
              <ChevronLeft className="h-4 w-4" />Уже есть аккаунт? Войти
            </button>
          </div>
        )}

        {/* ── Login / Registration: Step 2 — form ── */}
        {(mode === 'login' || step === 'details') && (
          <div className={mode === 'register' ? 'animate-in fade-in slide-in-from-left-2 duration-300' : ''}>
            {mode === 'register' && step === 'details' && (
              <div className="flex items-center gap-2 mb-5">
                <button onClick={() => setStep('role')} className="rounded-full p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm font-medium">{role === 'client' ? 'Регистрация клиента' : 'Регистрация мастера'}</span>
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20 flex items-start gap-2">
                <Shield className="h-4 w-4 shrink-0 mt-0.5" />{error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Login field */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  {mode === 'login' ? 'Телефон или email' : 'Email'}
                </label>
                <input
                  ref={emailRef}
                  value={email}
                  onChange={e => { setEmail(e.target.value); clearFieldError('email'); }}
                  type="text" required autoComplete={mode === 'login' ? 'username' : 'email'}
                  className={fieldErrors.email ? inputErrorClass : inputClass}
                  placeholder={mode === 'login' ? '+7 (999) 123-45-67 или email' : 'you@example.com'}
                />
                {fieldErrors.email && <p className="text-xs text-destructive mt-1">{fieldErrors.email}</p>}
              </div>

              {/* Registration fields */}
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Имя пользователя</label>
                    <input value={username} onChange={e => { setUsername(e.target.value); clearFieldError('username'); }} type="text" required minLength={3} autoComplete="username"
                      className={fieldErrors.username ? inputErrorClass : inputClass} placeholder="Ваш никнейм" />
                    {fieldErrors.username && <p className="text-xs text-destructive mt-1">{fieldErrors.username}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Полное имя</label>
                    <input value={fullName} onChange={e => setFullName(e.target.value)} type="text" autoComplete="name"
                      className={inputClass} placeholder="Иван Иванов" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Телефон</label>
                    <div className="flex gap-2">
                      <select value={countryCode} onChange={e => { setCountryCode(e.target.value); setPhone(''); }}
                        className="w-[5.5rem] rounded-xl border border-border/60 bg-background px-2.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer"
                        style={{ backgroundImage: 'none' }}>
                        {Object.entries(PHONE_RULES).map(([code, rule]) => (
                          <option key={code} value={code}>{rule.flag} {code}</option>
                        ))}
                      </select>
                      <input value={phone} onChange={e => { handlePhoneChange(e.target.value); clearFieldError('phone'); }} type="tel"
                        className={`flex-1 ${fieldErrors.phone ? inputErrorClass : inputClass}`} placeholder={PHONE_RULES[countryCode]?.placeholder || '(999) 123-45-67'} />
                    </div>
                    {fieldErrors.phone && <p className="text-xs text-destructive mt-1">{fieldErrors.phone}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Возраст</label>
                    <input value={age} onChange={e => setAge(e.target.value)} type="number" min="14" max="120"
                      className={inputClass} placeholder="25" />
                  </div>
                </>
              )}

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Пароль</label>
                  {mode === 'login' && (
                    <button type="button" tabIndex={-1} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                      Забыли пароль?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input value={password} onChange={e => { setPassword(e.target.value); clearFieldError('password'); }}
                    type={showPassword ? 'text' : 'password'} required minLength={8}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className={`${fieldErrors.password ? inputErrorClass : inputClass} pr-11`} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Password strength (register only) */}
                {pwStrength && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= pwStrength.score ? pwStrength.color : 'bg-muted'}`} />
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      {pwStrength.score >= 4 && <Check className="h-3 w-3 text-secondary" />}
                      {pwStrength.label}
                      {pwStrength.score < 4 && <span> — добавьте цифры, заглавные буквы или символы</span>}
                    </p>
                  </div>
                )}
                {fieldErrors.password && <p className="text-xs text-destructive mt-1">{fieldErrors.password}</p>}
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading}
                className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? (mode === 'login' ? 'Входим...' : 'Регистрируем...') : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
              </button>
            </form>
          </div>
        )}

        {/* ── Guest card ── */}
        <div className="rounded-2xl border border-border/40 bg-card/50 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">Хотите просто посмотреть?</p>
          <button onClick={handleGuest} disabled={loading}
            className="rounded-full border border-border/60 px-5 py-1.5 text-xs font-medium hover:bg-surface hover:border-border transition-all disabled:opacity-50">
            <Sparkles className="h-3 w-3 inline mr-1" />Продолжить как гость
          </button>
        </div>
      </div>
    </div>
  );
}
