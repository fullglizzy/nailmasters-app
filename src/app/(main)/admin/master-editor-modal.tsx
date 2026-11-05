'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { X, Camera, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useModal } from '@/hooks/use-modal';
import { useAuth } from '@/components/providers/auth-provider';
import {
  useAdminMaster,
  useCreateMaster,
  useUpdateMaster,
  useAddMasterService,
  useUpdateMasterService,
  useDeleteMasterService,
  useAddMasterSchedule,
  useDeleteMasterSchedule,
} from '@/hooks/api';
import {
  MasterProfileForm,
  emptyMasterProfileValues,
  type MasterProfileValues,
} from '@/components/master/master-profile-form';
import { ServicesEditor } from '@/components/master/services-editor';
import {
  ScheduleEditor,
  ScheduleBatchForm,
  defaultScheduleBatchValues,
  type ScheduleBatchValues,
} from '@/components/master/schedule-editor';
import { apiGet } from '@/lib/api';
import { formatUsPhone, toUsE164, usNationalDigits } from '@/lib/phone';
import { PhoneInput } from '@/components/shared/phone-input';
import type { AdminCreateMasterInput, AdminUpdateMasterInput, CreateServiceInput } from '@/lib/validators';
import type { ScheduleSlot } from '@/lib/types';

type Tab = 'profile' | 'services' | 'schedule';

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  masterId?: string;
  onClose: () => void;
  onSaved: () => void;
}

const inputClass = 'w-full rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all';
const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5';

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span>
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 h-6 w-11 rounded-full transition-colors duration-200 ${checked ? 'bg-secondary' : 'bg-muted'}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </label>
  );
}

export function MasterEditorModal({ open, mode, masterId, onClose, onSaved }: Props) {
  const { dialogRef, handleKeyDown } = useModal(open, onClose);
  const { getToken } = useAuth();

  const { data, isLoading } = useAdminMaster(open && mode === 'edit' ? masterId : undefined);
  const createMaster = useCreateMaster();
  const updateMaster = useUpdateMaster(masterId ?? '');
  const addService = useAddMasterService(masterId ?? '');
  const updateService = useUpdateMasterService(masterId ?? '');
  const deleteService = useDeleteMasterService(masterId ?? '');
  const addSchedule = useAddMasterSchedule(masterId ?? '');
  const deleteSchedule = useDeleteMasterSchedule(masterId ?? '');

  const [tab, setTab] = useState<Tab>('profile');
  const [values, setValues] = useState<MasterProfileValues>(emptyMasterProfileValues);
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [isModerated, setIsModerated] = useState(true);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleValues, setScheduleValues] = useState<ScheduleBatchValues>(defaultScheduleBatchValues);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const populatedRef = useRef<string | null>(null);

  const updateValues = (patch: Partial<MasterProfileValues>) => {
    setValues((prev) => ({ ...prev, ...patch }));
  };

  /* ── Заполнение формы при открытии ───────────────────── */

  useEffect(() => {
    if (!open) {
      populatedRef.current = null;
      return;
    }

    if (mode === 'create') {
      if (populatedRef.current === 'create') return;
      populatedRef.current = 'create';
      setTab('profile');
      setValues(emptyMasterProfileValues());
      setPhone('');
      setUsername('');
      setAvatarUrl(null);
      setIsActive(true);
      setIsModerated(true);
      setScheduleEnabled(true);
      setScheduleValues(defaultScheduleBatchValues());
      setError('');
      return;
    }

    if (data && populatedRef.current !== data.user.id) {
      populatedRef.current = data.user.id;
      const p = data.profile;
      setValues({
        fullName: p.fullName || '',
        age: data.user.age ? String(data.user.age) : '',
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
      });
      setPhone(formatUsPhone(data.user.phone || ''));
      setUsername(data.user.username || '');
      setAvatarUrl(data.user.avatarUrl);
      setIsActive(p.isActive);
      setIsModerated(p.isModerated);
      setTab('profile');
      setError('');
    }
  }, [open, mode, data]);

  /* ── Аватар ──────────────────────────────────────────── */

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setError('');
    try {
      const token = getToken();
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('/api/designs/upload-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json();
      if (json.success) setAvatarUrl(json.data.url);
      else setError(json.error || 'Не удалось загрузить аватар');
    } catch {
      setError('Ошибка загрузки аватара');
    } finally {
      setAvatarUploading(false);
    }
  };

  /* ── Валидация ───────────────────────────────────────── */

  const validate = (): string | null => {
    const digits = usNationalDigits(phone);
    if (!phone.trim()) return 'Введите телефон';
    if (digits.length !== 10) return 'Введите номер полностью: 10 цифр';
    if (username.trim() && username.trim().length < 3) return 'Username должен быть не короче 3 символов';
    if (!values.fullName.trim()) return 'Введите имя мастера';
    if (values.age) {
      const ageNum = parseInt(values.age);
      if (isNaN(ageNum) || ageNum < 14 || ageNum > 120) return 'Возраст должен быть от 14 до 120 лет';
    }
    if (!values.city) return 'Выберите город';
    if (!values.address.trim()) return 'Укажите адрес';
    if (!values.experience.trim()) return 'Укажите опыт работы';
    if (!values.specialties.length) return 'Выберите хотя бы одну специализацию';
    const price = Number(values.startingPrice);
    if (!values.startingPrice || Number.isNaN(price) || price <= 0) return 'Укажите цену от';
    if (!values.workFormat.length) return 'Выберите формат работы';
    return null;
  };

  const buildProfile = () => ({
    fullName: values.fullName.trim(),
    address: values.address.trim(),
    description: values.description.trim() || undefined,
    experience: values.experience.trim(),
    city: values.city,
    specialties: values.specialties,
    startingPrice: Number(values.startingPrice),
    workFormat: values.workFormat as ('salon' | 'home')[],
    sterilization: values.sterilization,
    disposableTools: values.disposableTools,
    ...(values.latitude != null && values.longitude != null
      ? { latitude: values.latitude, longitude: values.longitude }
      : {}),
  });

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    const normalized = toUsE164(phone);

    try {
      if (mode === 'create') {
        const payload: AdminCreateMasterInput = {
          phone: normalized,
          username: username.trim() || undefined,
          age: values.age ? Number(values.age) : undefined,
          avatarUrl: avatarUrl || undefined,
          isActive,
          isModerated,
          profile: buildProfile(),
          // Услуги создаются/редактируются после создания мастера на вкладке «Услуги»
          services: [],
          schedule: scheduleEnabled ? scheduleValues : undefined,
        };
        await createMaster.mutateAsync(payload);
        toast.success(`Мастер создан. Вход: ${normalized}, код 000000`);
      } else {
        const payload: AdminUpdateMasterInput = {
          phone: normalized,
          username: username.trim() || undefined,
          age: values.age ? Number(values.age) : undefined,
          avatarUrl: avatarUrl ?? null,
          isActive,
          isModerated,
          profile: buildProfile(),
        };
        await updateMaster.mutateAsync(payload);
        toast.success('Данные мастера обновлены');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  /* ── Услуги ──────────────────────────────────────────── */

  const handleAddService = async (input: CreateServiceInput) => {
    await addService.mutateAsync(input);
  };

  const handleUpdateService = async (serviceId: string, input: Partial<CreateServiceInput>) => {
    await updateService.mutateAsync({ serviceId, ...input });
  };

  const handleDeleteService = async (serviceId: string) => {
    await deleteService.mutateAsync(serviceId);
  };

  if (!open) return null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: 'Профиль' },
    ...(mode === 'edit'
      ? [{ id: 'services' as Tab, label: `Услуги${data ? ` (${data.services.length})` : ''}` }]
      : []),
    { id: 'schedule', label: 'Расписание' },
  ];

  const services = data?.services ?? [];
  const modalTitle = mode === 'create' ? 'Новый мастер' : 'Редактировать мастера';

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={modalTitle}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex h-full w-full flex-col bg-background shadow-xl sm:h-[90vh] sm:max-w-3xl sm:rounded-2xl modal-enter"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="font-bold text-lg sm:text-xl truncate">{modalTitle}</h2>
            {mode === 'edit' && data && (
              <p className="text-xs text-muted-foreground truncate">{data.profile.fullName} · {data.user.phone}</p>
            )}
          </div>
          <button onClick={onClose} aria-label="Закрыть" className="shrink-0 rounded-full p-1.5 hover:bg-muted/50 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto hide-scrollbar border-b px-2 sm:px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-3 sm:px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-[1px] transition-colors ${
                tab === t.id ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {error && (
            <div className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{error}
            </div>
          )}

          {mode === 'edit' && isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              {tab === 'profile' && (
                <div className="space-y-6">
                  {/* Account */}
                  <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-4">
                    <h3 className="font-semibold text-sm">Учётная запись</h3>

                    <div className="flex items-center gap-4">
                      <div className="relative h-16 w-16 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary overflow-hidden ring-2 ring-border/40">
                        {avatarUrl ? (
                          <Image src={avatarUrl} alt="" fill sizes="64px" className="object-cover" />
                        ) : (
                          <span>{(values.fullName || '?').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <label className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors ${avatarUploading ? 'opacity-50' : 'hover:bg-accent'}`}>
                        <span className="inline-flex items-center gap-2">
                          {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                          {avatarUploading ? 'Загрузка...' : 'Загрузить фото'}
                        </span>
                        <input type="file" accept="image/*" onChange={handleAvatar} className="hidden" disabled={avatarUploading} />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Телефон *</label>
                        <PhoneInput
                          value={phone}
                          onChange={setPhone}
                          inputClassName={inputClass}
                          disabled={saving}
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground">Формат США: +1 и 10 цифр. Используется для входа по OTP</p>
                      </div>
                      <div>
                        <label className={labelClass}>Username</label>
                        <input
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className={inputClass}
                          placeholder="anna_nails"
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground">Если пусто — сгенерируется автоматически</p>
                      </div>
                    </div>

                    <div className="space-y-3 pt-1">
                      <Toggle checked={isActive} onChange={setIsActive} label="Активен" hint="Показывать в каталоге" />
                      <Toggle checked={isModerated} onChange={setIsModerated} label="Проверен" hint="Попадает в «Популярное» и «Рядом»" />
                    </div>
                  </div>

                  <MasterProfileForm value={values} onChange={updateValues} />
                </div>
              )}

              {mode === 'edit' && tab === 'services' && (
                <ServicesEditor
                  services={services}
                  onAdd={handleAddService}
                  onUpdate={handleUpdateService}
                  onDelete={handleDeleteService}
                />
              )}

              {tab === 'schedule' && (
                <div className="space-y-4">
                  {mode === 'create' ? (
                    <>
                      <label className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-card p-3.5 cursor-pointer">
                        <span>
                          <span className="block text-sm font-medium">Создать расписание</span>
                          <span className="block text-[11px] text-muted-foreground">Слоты создадутся вместе с мастером</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={scheduleEnabled}
                          onChange={(e) => setScheduleEnabled(e.target.checked)}
                          className="h-4 w-4 accent-primary"
                        />
                      </label>
                      {scheduleEnabled && (
                        <ScheduleBatchForm
                          value={scheduleValues}
                          onChange={(patch) => setScheduleValues((prev) => ({ ...prev, ...patch }))}
                          onSubmit={() => {}}
                          hideSubmit
                          showWeeks
                        />
                      )}
                    </>
                  ) : masterId ? (
                    <ScheduleEditor
                      loadSlots={() => apiGet<ScheduleSlot[]>(`/api/admin/masters/${masterId}/schedule`)}
                      addBatch={(v) => addSchedule.mutateAsync(v)}
                      deleteSlot={(slotId) => deleteSchedule.mutateAsync(slotId)}
                      showWeeks
                    />
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <button onClick={onClose} className="flex-1 rounded-full border py-2.5 text-sm font-medium hover:bg-accent transition-colors">
            {mode === 'create' ? 'Отмена' : 'Закрыть'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Сохранение...' : mode === 'create' ? 'Создать мастера' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
