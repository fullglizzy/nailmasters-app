'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Upload,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useModal } from '@/hooks/use-modal';
import { useAuth } from '@/components/providers/auth-provider';
import { adminKeys, masterKeys } from '@/hooks/api';
import type {
  MasterImportIssue,
  MasterImportPreview,
  MasterImportResult,
  MasterImportScheduleRow,
  MasterImportServiceRow,
  MasterImportStatus,
} from '@/lib/types';

type Step = 'pick' | 'preview' | 'result';
type PreviewTab = 'masters' | 'services' | 'schedule';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ImportApiResponse {
  success: boolean;
  error?: string;
  message?: string;
  data?: MasterImportPreview | MasterImportResult;
}

const MAX_FILE_BYTES_LABEL = '5 МБ';

const DAY_NAMES: Record<string, string> = {
  mon: 'пн',
  tue: 'вт',
  wed: 'ср',
  thu: 'чт',
  fri: 'пт',
  sat: 'сб',
  sun: 'вс',
};

const STATUS_META: Record<MasterImportStatus, { label: string; className: string }> = {
  ready: {
    label: 'Готов',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  },
  duplicate: {
    label: 'Уже есть',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  },
  skipped: {
    label: 'Пропущен',
    className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  },
  error: {
    label: 'Ошибка',
    className: 'bg-destructive/10 text-destructive',
  },
};

const TONES = {
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  destructive: 'bg-destructive/10 text-destructive',
  muted: 'bg-muted text-muted-foreground',
} as const;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function StatusBadge({ status }: { status: MasterImportStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function IssuesCell({
  errors,
  warnings,
}: {
  errors: MasterImportIssue[];
  warnings: MasterImportIssue[];
}) {
  if (errors.length === 0 && warnings.length === 0) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }

  return (
    <div className="space-y-0.5">
      {errors.map((issue, index) => (
        <p key={`e-${index}`} className="text-[11px] leading-snug text-destructive">
          {issue.column && <span className="font-semibold">{issue.column}: </span>}
          {issue.message}
        </p>
      ))}
      {warnings.map((issue, index) => (
        <p key={`w-${index}`} className="text-[11px] leading-snug text-amber-700 dark:text-amber-400">
          {issue.column && <span className="font-semibold">{issue.column}: </span>}
          {issue.message}
        </p>
      ))}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  detail: string;
  tone: keyof typeof TONES;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg ${TONES[tone]}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="text-xl font-bold leading-none">{value}</div>
      <div className="mt-1 text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[10px] leading-snug text-muted-foreground/80">{detail}</div>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap p-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-2 align-top text-xs ${className}`}>{children}</td>;
}

export function MasterImportModal({ open, onClose }: Props) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MasterImportPreview | null>(null);
  const [result, setResult] = useState<MasterImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [tab, setTab] = useState<PreviewTab>('masters');
  const [dragActive, setDragActive] = useState(false);

  const close = useCallback(() => {
    if (loading) {
      toast.info('Дождитесь завершения операции');
      return;
    }
    onClose();
  }, [loading, onClose]);

  const { dialogRef, handleKeyDown } = useModal(open, close);

  useEffect(() => {
    if (!open) return;
    setStep('pick');
    setFile(null);
    setPreview(null);
    setResult(null);
    setLoading(false);
    setDownloading(false);
    setError('');
    setSkipInvalid(false);
    setTab('masters');
    setDragActive(false);
  }, [open]);

  const invalidateLists = () => {
    queryClient.invalidateQueries({ queryKey: adminKeys.masters() });
    queryClient.invalidateQueries({ queryKey: adminKeys.stats() });
    queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    queryClient.invalidateQueries({ queryKey: masterKeys.all });
  };

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      const token = getToken();
      const response = await fetch('/api/admin/masters/import/template', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error('template');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'nailmasters-master-import-template.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Шаблон скачан');
    } catch {
      toast.error('Не удалось скачать шаблон');
    } finally {
      setDownloading(false);
    }
  };

  const requestImport = async (target: File, dryRun: boolean, skip: boolean) => {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', target);
    formData.append('dryRun', String(dryRun));
    formData.append('skipInvalid', String(skip));

    const response = await fetch('/api/admin/masters/import', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    let json: ImportApiResponse | null = null;
    try {
      json = (await response.json()) as ImportApiResponse;
    } catch {
      json = null;
    }

    return { response, json };
  };

  const runPreview = async (target: File) => {
    setLoading(true);
    setError('');
    setPreview(null);
    setResult(null);

    try {
      const { response, json } = await requestImport(target, true, false);
      if (!response.ok || !json?.success || !json.data) {
        setStep('pick');
        setError(json?.error || 'Не удалось проверить файл');
        return;
      }
      setPreview(json.data as MasterImportPreview);
      setStep('preview');
      setTab('masters');
    } catch {
      setStep('pick');
      setError('Не удалось проверить файл. Проверьте соединение и попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const selectFile = (target: File | undefined) => {
    if (!target) return;
    setError('');

    if (!/\.xlsx$/i.test(target.name)) {
      setFile(null);
      setError('Выберите файл Excel в формате .xlsx');
      return;
    }
    if (target.size > 5 * 1024 * 1024) {
      setFile(null);
      setError('Файл больше 5 МБ. Разделите его на части.');
      return;
    }

    setFile(target);
    void runPreview(target);
  };

  const runImport = async () => {
    if (!file || !preview) return;

    setLoading(true);
    setError('');

    try {
      const { response, json } = await requestImport(file, false, skipInvalid);

      if (!response.ok || !json?.success || !json.data) {
        if (json?.data && 'summary' in json.data) {
          setPreview(json.data as MasterImportPreview);
        }
        setError(json?.error || 'Не удалось выполнить импорт');
        return;
      }

      setResult(json.data as MasterImportResult);
      setStep('result');
      invalidateLists();
      toast.success(json.message || 'Импорт завершён');
    } catch {
      setError('Не удалось выполнить импорт. Проверьте соединение и повторите попытку.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep('pick');
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
    setSkipInvalid(false);
    setTab('masters');
    if (inputRef.current) inputRef.current.value = '';
  };

  if (!open) return null;

  const errorCount = preview
    ? preview.summary.errorMasters + preview.summary.errorServices + preview.summary.errorSchedules
    : 0;
  const canImport =
    !!preview && preview.summary.readyMasters > 0 && (errorCount === 0 || skipInvalid) && !loading;

  const tabs: { id: PreviewTab; label: string; count: number }[] = preview
    ? [
        { id: 'masters', label: 'Мастера', count: preview.summary.masterRows },
        { id: 'services', label: 'Услуги', count: preview.summary.serviceRows },
        { id: 'schedule', label: 'Расписание', count: preview.summary.scheduleRows },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center" onClick={close}>
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Импорт мастеров из Excel"
        onKeyDown={handleKeyDown}
        onClick={(event) => event.stopPropagation()}
        className="relative z-10 flex h-full w-full flex-col bg-background shadow-xl sm:h-[92vh] sm:max-w-5xl sm:rounded-2xl modal-enter"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold sm:text-xl">Импорт мастеров из Excel</h2>
              <p className="truncate text-xs text-muted-foreground">
                Шаблон → проверка файла → импорт
              </p>
            </div>
          </div>
          <button
            onClick={close}
            disabled={loading}
            aria-label="Закрыть"
            className="shrink-0 rounded-full p-1.5 transition-colors hover:bg-muted/50 disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button
                onClick={() => setError('')}
                aria-label="Скрыть ошибку"
                className="shrink-0 rounded-full p-0.5 hover:bg-destructive/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Step 1: pick file */}
          {step === 'pick' && (
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Download className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold">1. Скачайте шаблон</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Три листа: «Мастера» (обязательный), «Услуги» и «Расписание» (необязательные).
                      Внутри — инструкция, примеры и выпадающие списки.
                    </p>
                    <button
                      onClick={downloadTemplate}
                      disabled={downloading}
                      className="mt-3 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {downloading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {downloading ? 'Формируем...' : 'Скачать шаблон .xlsx'}
                    </button>
                  </div>
                </div>
              </div>

              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  selectFile(event.dataTransfer.files?.[0]);
                }}
                className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
                  dragActive ? 'border-primary bg-primary/5' : 'border-border/60 bg-card/50'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    <p className="mt-3 text-sm font-medium">Проверяем файл...</p>
                    <p className="mt-1 text-xs text-muted-foreground">{file?.name}</p>
                  </>
                ) : (
                  <>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Upload className="h-6 w-6" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold">2. Загрузите заполненный файл</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Перетащите .xlsx сюда или выберите файл. До {MAX_FILE_BYTES_LABEL}, не более 500 мастеров.
                    </p>
                    <button
                      onClick={() => inputRef.current?.click()}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Upload className="h-4 w-4" />Выбрать файл
                    </button>
                    {file && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {file.name} · {formatFileSize(file.size)}
                      </p>
                    )}
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(event) => {
                    selectFile(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                  className="hidden"
                />
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
                <p className="text-xs font-medium">Как это работает</p>
                <ul className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
                  <li>• Файл проверяется на сервере: обязательные колонки, телефоны, города, специализации.</li>
                  <li>• Дубликаты по телефону и уже существующие мастера не импортируются.</li>
                  <li>• Вы увидите отчёт по каждой строке и сможете импортировать только корректные.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 2: preview */}
          {step === 'preview' && preview && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">Проверка: {file?.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Ничего не сохранено. Проверьте отчёт и запустите импорт.
                  </p>
                </div>
                <button
                  onClick={reset}
                  disabled={loading}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />Другой файл
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                <SummaryCard
                  icon={Users}
                  label="Мастера"
                  value={preview.summary.masterRows}
                  detail={`${preview.summary.readyMasters} к импорту · ${preview.summary.errorMasters} ошибок · ${preview.summary.duplicateMasters} уже есть`}
                  tone={preview.summary.errorMasters > 0 ? 'destructive' : 'emerald'}
                />
                <SummaryCard
                  icon={Wrench}
                  label="Услуги"
                  value={preview.summary.serviceRows}
                  detail={`${preview.summary.readyServices} к импорту · ${preview.summary.errorServices} ошибок · ${preview.summary.skippedServices} пропущено`}
                  tone={preview.summary.errorServices > 0 ? 'destructive' : 'emerald'}
                />
                <SummaryCard
                  icon={CalendarDays}
                  label="Расписание"
                  value={preview.summary.readySchedules}
                  detail={`${preview.summary.scheduleSlots} слотов · ${preview.summary.errorSchedules} ошибок`}
                  tone={preview.summary.errorSchedules > 0 ? 'destructive' : 'emerald'}
                />
                <SummaryCard
                  icon={AlertTriangle}
                  label="Без координат"
                  value={preview.summary.withoutCoordinates}
                  detail="Не попадут в «Рядом», пока не указать адрес"
                  tone={preview.summary.withoutCoordinates > 0 ? 'amber' : 'muted'}
                />
              </div>

              <div className="flex gap-1 overflow-x-auto border-b pb-0 hide-scrollbar">
                {tabs.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={`shrink-0 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                      tab === item.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {item.label}
                    <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {item.count}
                    </span>
                  </button>
                ))}
              </div>

              {tab === 'masters' && (
                <>
                  <div className="space-y-2 md:hidden">
                    {preview.masters.length === 0 ? (
                      <div className="rounded-xl border bg-card p-4 text-center text-xs text-muted-foreground">
                        На листе «Мастера» нет строк
                      </div>
                    ) : (
                      preview.masters.map((master) => (
                        <div key={master.row} className="space-y-2 rounded-xl border bg-card p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="break-words text-xs font-semibold">{master.display.fullName || '—'}</p>
                              <p className="break-words text-[11px] text-muted-foreground">
                                {master.data?.phone || master.display.phone || '—'} ·{' '}
                                {master.data?.profile.city || master.display.city || '—'}
                              </p>
                            </div>
                            <StatusBadge status={master.status} />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Строка {master.row}</span>
                            <span>
                              {master.data?.profile.startingPrice != null
                                ? `от $${master.data.profile.startingPrice}`
                                : 'цена не указана'}
                            </span>
                          </div>
                          {(master.errors.length > 0 || master.warnings.length > 0) && (
                            <IssuesCell errors={master.errors} warnings={master.warnings} />
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="hidden overflow-x-auto rounded-xl border md:block">
                    <table className="w-full min-w-[760px] text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <Th>Стр.</Th>
                          <Th>Статус</Th>
                          <Th>ФИО</Th>
                          <Th>Телефон</Th>
                          <Th>Город</Th>
                          <Th>Цена от</Th>
                          <Th>Проблемы</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.masters.map((master) => (
                          <tr key={master.row} className="border-t">
                            <Td className="text-muted-foreground">{master.row}</Td>
                            <Td><StatusBadge status={master.status} /></Td>
                            <Td className="font-medium">{master.display.fullName || '—'}</Td>
                            <Td className="whitespace-nowrap">{master.data?.phone || master.display.phone || '—'}</Td>
                            <Td>{master.data?.profile.city || master.display.city || '—'}</Td>
                            <Td>{master.data?.profile.startingPrice != null ? `$${master.data.profile.startingPrice}` : '—'}</Td>
                            <Td className="min-w-[220px]">
                              <IssuesCell errors={master.errors} warnings={master.warnings} />
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {tab === 'services' && (
                <>
                  <div className="space-y-2 md:hidden">
                    {preview.services.length === 0 ? (
                      <div className="rounded-xl border bg-card p-4 text-center text-xs text-muted-foreground">
                        Лист «Услуги» пуст — услуги можно добавить позже
                      </div>
                    ) : (
                      preview.services.map((service: MasterImportServiceRow) => (
                        <div key={service.row} className="space-y-2 rounded-xl border bg-card p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="break-words text-xs font-semibold">{service.name || '—'}</p>
                              <p className="break-words text-[11px] text-muted-foreground">
                                {service.phone || '—'}
                              </p>
                            </div>
                            <StatusBadge status={service.status} />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Строка {service.row}</span>
                            <span>
                              {service.price != null ? `$${service.price}` : '—'}
                              {service.duration != null ? ` · ${service.duration} мин` : ''}
                            </span>
                          </div>
                          {(service.errors.length > 0 || service.warnings.length > 0) && (
                            <IssuesCell errors={service.errors} warnings={service.warnings} />
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="hidden overflow-x-auto rounded-xl border md:block">
                    <table className="w-full min-w-[720px] text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <Th>Стр.</Th>
                          <Th>Статус</Th>
                          <Th>Мастер</Th>
                          <Th>Услуга</Th>
                          <Th>Цена</Th>
                          <Th>Длит.</Th>
                          <Th>Проблемы</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.services.map((service: MasterImportServiceRow) => (
                          <tr key={service.row} className="border-t">
                            <Td className="text-muted-foreground">{service.row}</Td>
                            <Td><StatusBadge status={service.status} /></Td>
                            <Td className="whitespace-nowrap">{service.phone || '—'}</Td>
                            <Td className="font-medium">{service.name || '—'}</Td>
                            <Td>{service.price != null ? `$${service.price}` : '—'}</Td>
                            <Td>{service.duration != null ? `${service.duration} мин` : '—'}</Td>
                            <Td className="min-w-[220px]">
                              <IssuesCell errors={service.errors} warnings={service.warnings} />
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {tab === 'schedule' && (
                <>
                  <div className="space-y-2 md:hidden">
                    {preview.schedule.length === 0 ? (
                      <div className="rounded-xl border bg-card p-4 text-center text-xs text-muted-foreground">
                        Лист «Расписание» пуст — слоты можно создать позже
                      </div>
                    ) : (
                      preview.schedule.map((item: MasterImportScheduleRow) => (
                        <div key={item.row} className="space-y-2 rounded-xl border bg-card p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="break-words text-xs font-semibold">{item.phone || '—'}</p>
                              <p className="break-words text-[11px] text-muted-foreground">
                                {item.pattern
                                  ? `${item.pattern.startDate} ${item.pattern.startTime}–${item.pattern.endTime}` +
                                    (item.pattern.repeatDays.length
                                      ? ` · ${item.pattern.repeatDays.map((day) => DAY_NAMES[day] ?? day).join(', ')}`
                                      : '')
                                  : '—'}
                              </p>
                            </div>
                            <StatusBadge status={item.status} />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Строка {item.row}</span>
                            <span>{item.slotsCount ? `${item.slotsCount} слотов` : 'слоты не созданы'}</span>
                          </div>
                          {(item.errors.length > 0 || item.warnings.length > 0) && (
                            <IssuesCell errors={item.errors} warnings={item.warnings} />
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="hidden overflow-x-auto rounded-xl border md:block">
                    <table className="w-full min-w-[760px] text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <Th>Стр.</Th>
                          <Th>Статус</Th>
                          <Th>Мастер</Th>
                          <Th>Шаблон</Th>
                          <Th>Слотов</Th>
                          <Th>Проблемы</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.schedule.map((item: MasterImportScheduleRow) => (
                          <tr key={item.row} className="border-t">
                            <Td className="text-muted-foreground">{item.row}</Td>
                            <Td><StatusBadge status={item.status} /></Td>
                            <Td className="whitespace-nowrap">{item.phone || '—'}</Td>
                            <Td>
                              {item.pattern
                                ? `${item.pattern.startDate} ${item.pattern.startTime}–${item.pattern.endTime}` +
                                  (item.pattern.repeatDays.length
                                    ? ` · ${item.pattern.repeatDays.map((day) => DAY_NAMES[day] ?? day).join(', ')}`
                                    : '')
                                : '—'}
                            </Td>
                            <Td>{item.slotsCount || '—'}</Td>
                            <Td className="min-w-[220px]">
                              <IssuesCell errors={item.errors} warnings={item.warnings} />
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {preview.summary.readyMasters === 0 && (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                  Нет новых мастеров для импорта: все строки уже есть в базе или содержат ошибки.
                </div>
              )}

              {errorCount > 0 && (
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                  <input
                    type="checkbox"
                    checked={skipInvalid}
                    onChange={(event) => setSkipInvalid(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <span>
                    <span className="block text-xs font-semibold">Импортировать только корректные строки</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      Без этой галочки импорт заблокирован, пока в файле есть ошибки.
                    </span>
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Step 3: result */}
          {step === 'result' && result && (
            <div className="space-y-4">
              <div className="flex flex-col items-center rounded-2xl border bg-card p-5 text-center">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${
                    result.totals.mastersFailed > 0
                      ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-emerald-500/10 text-emerald-600'
                  }`}
                >
                  {result.totals.mastersFailed > 0 ? (
                    <AlertTriangle className="h-6 w-6" />
                  ) : (
                    <CheckCircle2 className="h-6 w-6" />
                  )}
                </div>
                <h3 className="mt-3 text-base font-semibold">
                  {result.totals.mastersFailed > 0 ? 'Импорт завершён с замечаниями' : 'Импорт завершён'}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Создано мастеров: {result.totals.mastersCreated}. Список обновится автоматически.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <SummaryCard icon={Users} label="Мастера" value={result.totals.mastersCreated} detail="создано" tone="emerald" />
                <SummaryCard icon={Wrench} label="Услуги" value={result.totals.servicesCreated} detail="создано" tone="emerald" />
                <SummaryCard icon={CalendarDays} label="Слоты" value={result.totals.slotsCreated} detail="создано" tone="emerald" />
                <SummaryCard
                  icon={AlertTriangle}
                  label="Не импортировано"
                  value={result.totals.mastersSkipped + result.totals.mastersFailed}
                  detail={`${result.totals.mastersSkipped} пропущено · ${result.totals.mastersFailed} с ошибками`}
                  tone={result.totals.mastersFailed > 0 ? 'destructive' : 'amber'}
                />
              </div>

              {result.failed.length > 0 && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                  <h4 className="text-xs font-semibold text-destructive">Строки с ошибками</h4>
                  <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto">
                    {result.failed.map((item) => (
                      <div key={`failed-${item.row}`} className="text-[11px] leading-snug">
                        <span className="font-semibold">Строка {item.row}:</span>{' '}
                        {item.fullName || '—'} {item.phone ? `(${item.phone})` : ''} — {item.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.skipped.length > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400">Пропущенные строки</h4>
                  <div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto">
                    {result.skipped.map((item) => (
                      <div key={`skipped-${item.row}`} className="text-[11px] leading-snug">
                        <span className="font-semibold">Строка {item.row}:</span>{' '}
                        {item.fullName || '—'} {item.phone ? `(${item.phone})` : ''} — {item.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {step === 'preview' && preview ? (
            <>
              <div className="text-[11px] text-muted-foreground">
                К импорту: <span className="font-semibold text-foreground">{preview.summary.readyMasters}</span> мастеров
                {preview.summary.readyServices > 0 && <> · {preview.summary.readyServices} услуг</>}
                {preview.summary.scheduleSlots > 0 && <> · {preview.summary.scheduleSlots} слотов</>}
                {errorCount > 0 && <> · ошибок: {errorCount}</>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={close}
                  disabled={loading}
                  className="flex-1 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50 sm:flex-none"
                >
                  Отмена
                </button>
                <button
                  onClick={runImport}
                  disabled={!canImport}
                  title={
                    !canImport && errorCount > 0 && !skipInvalid
                      ? 'Исправьте ошибки или включите импорт корректных строк'
                      : undefined
                  }
                  className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />Импортируем...
                    </span>
                  ) : (
                    `Импортировать ${preview.summary.readyMasters}`
                  )}
                </button>
              </div>
            </>
          ) : step === 'result' ? (
            <>
              <div className="text-[11px] text-muted-foreground">
                Мастеров создано: <span className="font-semibold text-foreground">{result?.totals.mastersCreated ?? 0}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={reset}
                  className="flex-1 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent sm:flex-none"
                >
                  Импортировать ещё
                </button>
                <button
                  onClick={close}
                  className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:flex-none"
                >
                  Готово
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-[11px] text-muted-foreground">
                Файл до {MAX_FILE_BYTES_LABEL}. Шаблон уже содержит инструкцию и примеры.
              </div>
              <button
                onClick={close}
                disabled={loading}
                className="rounded-full border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
              >
                Отмена
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
