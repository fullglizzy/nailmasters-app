'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import { X, Camera, AlertTriangle } from 'lucide-react';
import { useModal } from '@/hooks/use-modal';
import { useProfile, profileKeys } from '@/hooks/api';
import { useAuth } from '@/components/providers/auth-provider';
import { MasterProfileForm, emptyMasterProfileValues, type MasterProfileValues } from '@/components/master/master-profile-form';
import { logger } from '@/lib/logger';

/* ── Types ──────────────────────────────────────────────── */

interface Props { open: boolean; onClose: () => void; onSaved: () => void; }

/* ═════════════════════════════════════════════════════════
   Component
   ═════════════════════════════════════════════════════════ */

export function EditProfileModal({ open, onClose, onSaved }: Props) {
  const { dialogRef, handleKeyDown } = useModal(open, onClose);
  const { data: profile, isLoading: loading } = useProfile();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);

  const [values, setValues] = useState<MasterProfileValues>(emptyMasterProfileValues);
  const initialLocation = useRef('');
  const initialCity = useRef('');

  const isMaster = profile?.role === 'nailmaster';

  /* ── Populate form on open ──────────────────────────── */

  const prevOpen = useRef(false);
  useEffect(() => {
    if (!open || !profile || loading) return;
    if (!prevOpen.current) {
      const p = profile;
      const next: MasterProfileValues = {
        fullName: p.fullName || '',
        age: p.age ? String(p.age) : '',
        description: p.description || '',
        city: p.city || '',
        experience: p.experience || '',
        address: p.address || '',
        specialties: p.specialties || [],
        workFormat: p.workFormat || [],
        startingPrice: p.startingPrice != null ? String(p.startingPrice) : '',
        sterilization: p.sterilization || false,
        disposableTools: p.disposableTools || false,
        latitude: p.latitude != null ? Number(p.latitude) : null,
        longitude: p.longitude != null ? Number(p.longitude) : null,
      };
      setValues(next);
      setError('');
      initialLocation.current = next.address;
      initialCity.current = next.city;
    }
    prevOpen.current = open;
  }, [open, profile, loading]);

  const updateValues = (patch: Partial<MasterProfileValues>) => {
    setValues((prev) => ({ ...prev, ...patch }));
  };

  /* ── Validation ─────────────────────────────────────── */

  const addressChanged = values.address !== initialLocation.current || values.city !== initialCity.current;

  const validate = (): string | null => {
    if (!values.fullName.trim()) return 'Введите имя';
    const ageNum = parseInt(values.age);
    if (values.age && (isNaN(ageNum) || ageNum < 14 || ageNum > 120)) return 'Возраст должен быть от 14 до 120 лет';

    if (isMaster) {
      if (!values.city) return 'Выберите город';
      if (!values.address.trim()) return 'Укажите адрес';
      if (addressChanged && (values.latitude == null || values.longitude == null)) {
        return 'Проверьте адрес — выберите его из подсказок';
      }
      if (!values.experience) return 'Укажите опыт работы';
      if (values.specialties.length === 0) return 'Выберите хотя бы одну специализацию';
      if (values.workFormat.length === 0) return 'Выберите формат работы';
    }

    return null; // valid
  };

  /* ── Save ───────────────────────────────────────────── */

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      return;
    }

    setSaving(true); setError('');
    const token = getToken();
    try {
      const body: Record<string, unknown> = {
        fullName: values.fullName,
        age: values.age ? Number(values.age) : undefined,
      };

      if (isMaster) {
        Object.assign(body, {
          description: values.description,
          experience: values.experience,
          city: values.city,
          specialties: values.specialties,
          workFormat: values.workFormat,
          sterilization: values.sterilization,
          disposableTools: values.disposableTools,
          startingPrice: values.startingPrice ? Number(values.startingPrice) : undefined,
          address: values.address,
          ...(values.latitude != null && values.longitude != null
            ? { latitude: values.latitude, longitude: values.longitude }
            : {}),
        });
      }

      const endpoint = isMaster ? '/api/masters/profile' : '/api/auth/profile';
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) { onSaved(); onClose(); }
      else setError(json.error || 'Ошибка сохранения');
    } catch {
      setError('Ошибка соединения');
    } finally {
      setSaving(false);
    }
  };

  /* ── Avatar upload ──────────────────────────────────── */

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = getToken();
    const fd = new FormData(); fd.append('avatar', file);
    try {
      const res = await fetch('/api/auth/avatar', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token!}` },
        body: fd,
      });
      const json = await res.json();
      if (json.success) {
        queryClient.invalidateQueries({ queryKey: profileKeys.all });
        onSaved();
      }
    } catch (err) { logger.error(err, 'Avatar upload failed'); }
  };

  /* ── Style ──────────────────────────────────────────── */

  const inputClass = 'w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div
        ref={dialogRef} role="dialog" aria-modal="true" aria-label="Редактировать профиль"
        className="relative z-10 w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-background p-6 shadow-xl modal-enter"
        onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-xl">Редактировать профиль</h2>
          <button onClick={onClose} aria-label="Закрыть" className="rounded-full p-1.5 hover:bg-muted/50 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-5">
            {error && (
              <div ref={errorRef} className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{error}
              </div>
            )}

            {/* Avatar */}
            <div className="flex justify-center">
              <label className="relative cursor-pointer group">
                <div className="relative h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary overflow-hidden ring-2 ring-border/40">
                  {profile?.avatarUrl ? (
                    <Image src={profile.avatarUrl} alt="" fill sizes="80px" className="object-cover" />
                  ) : (
                    <span>{(values.fullName || '?').charAt(0).toUpperCase()}</span>
                  )}
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-5 w-5 text-white" />
                  </div>
                </div>
                <input type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
              </label>
            </div>

            {isMaster ? (
              <MasterProfileForm value={values} onChange={updateValues} />
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Полное имя *
                  </label>
                  <input
                    value={values.fullName}
                    onChange={(e) => updateValues({ fullName: e.target.value })}
                    className={inputClass}
                    placeholder="Анна Иванова"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Возраст</label>
                  <input
                    value={values.age}
                    onChange={(e) => updateValues({ age: e.target.value })}
                    type="number"
                    min={14}
                    max={120}
                    className={inputClass}
                    placeholder="25"
                  />
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <button onClick={onClose} className="flex-1 rounded-full border py-2.5 text-sm font-medium hover:bg-accent transition-colors">
                Отмена
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
