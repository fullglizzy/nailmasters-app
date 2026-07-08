'use client';

import { useState, useEffect } from 'react';
import { X, Camera, Plus, Shield, Home } from 'lucide-react';
import { useModal } from '@/hooks/use-modal';
import { MASTER_SPECIALTIES, CITIES } from '@/data/specialties';

interface Props { open: boolean; onClose: () => void; onSaved: () => void; }

interface ProfileData {
  id: string; email: string; username: string; role: string;
  fullName: string | null; phone: string | null; avatarUrl: string | null;
  age?: number | null;
  address?: string | null; description?: string | null; experience?: string | null;
  city?: string | null; specialties?: string[] | null; workFormat?: string[] | null;
  sterilization?: boolean; disposableTools?: boolean; sterilizationPhoto?: string | null;
  latitude?: number | null; longitude?: number | null;
}

export function EditProfileModal({ open, onClose, onSaved }: Props) {
  const { dialogRef, handleKeyDown } = useModal(open, onClose);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [experience, setExperience] = useState('');
  const [city, setCity] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialtyInput, setSpecialtyInput] = useState('');
  const [workFormat, setWorkFormat] = useState<string[]>([]);
  const [sterilization, setSterilization] = useState(false);
  const [disposableTools, setDisposableTools] = useState(false);

  // Load profile
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const token = localStorage.getItem('token');
    fetch('/api/auth/profile', { headers: { Authorization: `Bearer ${token!}` } })
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          const p = json.data;
          setProfile(p);
          setFullName(p.fullName || '');
          setUsername(p.username || '');
          setPhone(p.phone || '');
          setAge(p.age ? String(p.age) : '');
          setLocation(p.address || '');
          setDescription(p.description || '');
          setExperience(p.experience || '');
          setCity(p.city || '');
          setSpecialties(p.specialties || []);
          setWorkFormat(p.workFormat || []);
          setSterilization(p.sterilization || false);
          setDisposableTools(p.disposableTools || false);
        }
      })
      .finally(() => setLoading(false));
  }, [open]);

  const isMaster = profile?.role === 'nailmaster';

  const handleSave = async () => {
    setSaving(true); setError('');
    const token = localStorage.getItem('token');
    try {
      // Base update
      const baseBody: Record<string, unknown> = { fullName, username, age: age ? Number(age) : undefined, phone: phone || undefined };

      // Master-specific update
      if (isMaster) {
        Object.assign(baseBody, { description, experience, city, specialties, workFormat, sterilization, disposableTools, address: location });
      }

      const res = await fetch(isMaster ? '/api/masters/profile' : '/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(baseBody),
      });
      const json = await res.json();
      if (json.success) { onSaved(); onClose(); }
      else setError(json.error || 'Ошибка');
    } catch { setError('Ошибка соединения'); }
    finally { setSaving(false); }
  };

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = localStorage.getItem('token');
    const fd = new FormData(); fd.append('avatar', file);
    try {
      const res = await fetch('/api/auth/avatar', { method: 'PUT', headers: { Authorization: `Bearer ${token!}` }, body: fd });
      const json = await res.json();
      if (json.success) {
        setProfile(prev => prev ? { ...prev, avatarUrl: json.data.avatarUrl } : prev);
        onSaved();
      }
    } catch {}
  };

  const addSpecialty = () => {
    if (specialtyInput && !specialties.includes(specialtyInput)) {
      setSpecialties(prev => [...prev, specialtyInput]);
    }
    setSpecialtyInput('');
  };

  const toggleWorkFormat = (fmt: string) => {
    setWorkFormat(prev => prev.includes(fmt) ? prev.filter(f => f !== fmt) : [...prev, fmt]);
  };

  if (!open) return null;

  const inputClass = "w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all";
  const chipClass = (active: boolean) => `rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 hover:bg-surface cursor-pointer'}`;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Редактировать профиль" className="relative z-10 w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-background p-6 shadow-xl modal-enter" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-xl">Редактировать профиль</h2>
          <button onClick={onClose} aria-label="Закрыть" className="rounded-full p-1.5 hover:bg-muted/50 transition-colors"><X className="h-5 w-5" /></button>
        </div>

        {loading ? <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div> : (
          <div className="space-y-5">
            {error && <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">{error}</div>}

            {/* Avatar */}
            <div className="flex justify-center">
              <label className="relative cursor-pointer group">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary overflow-hidden border-2 border-border/40">
                  {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : (fullName || username).charAt(0).toUpperCase()}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-5 w-5 text-white" />
                </div>
                <input type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
              </label>
            </div>

            {/* Common fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5">Имя пользователя</label>
                <input value={username} onChange={e => setUsername(e.target.value)} className={inputClass} placeholder="username" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">Полное имя</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} placeholder="Иван Иванов" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5">Телефон</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} placeholder="+79000000000" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">Возраст</label>
                <input value={age} onChange={e => setAge(e.target.value)} type="number" min="14" max="120" className={inputClass} placeholder="25" />
              </div>
            </div>

            {!isMaster && (
              <div>
                <label className="block text-xs font-medium mb-1.5">Адрес</label>
                <input value={location} onChange={e => setLocation(e.target.value)} className={inputClass} placeholder="Город, улица" />
              </div>
            )}

            {/* Master-specific fields */}
            {isMaster && (
              <>
                <div className="border-t pt-5">
                  <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />Данные мастера</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium mb-1.5">О себе</label>
                      <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={inputClass} placeholder="Опишите ваш опыт, стиль работы, особенности..." />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium mb-1.5">Опыт</label>
                        <input value={experience} onChange={e => setExperience(e.target.value)} className={inputClass} placeholder="5 лет" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5">Город</label>
                        <select value={city} onChange={e => setCity(e.target.value)} className={inputClass}>
                          <option value="">Выберите город</option>
                          {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1.5">Адрес</label>
                      <input value={location} onChange={e => setLocation(e.target.value)} className={inputClass} placeholder="Улица, дом, салон" />
                    </div>

                    {/* Specialties */}
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Специализации</label>
                      <div className="flex gap-2 mb-2">
                        <select value={specialtyInput} onChange={e => setSpecialtyInput(e.target.value)} className={inputClass}>
                          <option value="">Выберите...</option>
                          {MASTER_SPECIALTIES.filter(s => !specialties.includes(s)).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button onClick={addSpecialty} disabled={!specialtyInput} className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                      </div>
                      {specialties.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {specialties.map(s => (
                            <span key={s} onClick={() => setSpecialties(prev => prev.filter(x => x !== s))} className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium cursor-pointer hover:bg-destructive/20 hover:text-destructive">
                              {s} <X className="h-3 w-3" />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Work format */}
                    <div>
                      <label className="block text-xs font-medium mb-1.5">Формат работы</label>
                      <div className="flex gap-2">
                        {['salon', 'home'].map(f => (
                          <button key={f} onClick={() => toggleWorkFormat(f)} className={chipClass(workFormat.includes(f))}>
                            <Home className="h-3.5 w-3.5 inline mr-1" />{f === 'salon' ? 'В салоне' : 'На дому'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sterilization toggles */}
                    <div className="space-y-3">
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="text-sm">Стерилизация инструментов</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={sterilization}
                          onClick={() => setSterilization(!sterilization)}
                          className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${sterilization ? 'bg-secondary' : 'bg-muted'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${sterilization ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="text-sm">Одноразовые материалы</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={disposableTools}
                          onClick={() => setDisposableTools(!disposableTools)}
                          className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${disposableTools ? 'bg-secondary' : 'bg-muted'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${disposableTools ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <button onClick={onClose} className="flex-1 rounded-full border py-2.5 text-sm font-medium hover:bg-accent transition-colors">Отмена</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
