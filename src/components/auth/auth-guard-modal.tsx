'use client';

import Link from 'next/link';
import { useModal } from '@/hooks/use-modal';
import { X, LogIn, Sparkles } from 'lucide-react';

interface AuthGuardModalProps {
  open: boolean;
  onClose: () => void;
  action?: string; // e.g. "записаться к мастеру", "оставить комментарий"
}

export function AuthGuardModal({ open, onClose, action = 'выполнить это действие' }: AuthGuardModalProps) {
  const { dialogRef, handleKeyDown } = useModal(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Требуется авторизация"
        className="relative z-10 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-background p-6 shadow-xl modal-enter text-center"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <button onClick={onClose} aria-label="Закрыть" className="absolute top-4 right-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted/50 transition-colors">
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/[0.06] ring-2 ring-primary/[0.08]">
          <LogIn className="h-8 w-8 text-primary" />
        </div>

        <h3 className="font-display text-xl mb-2">Войдите в аккаунт</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Чтобы {action}, нужно авторизоваться. Это быстро и бесплатно.
        </p>

        <div className="space-y-2.5">
          <Link
            href="/auth"
            onClick={onClose}
            className="block w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Войти или зарегистрироваться
          </Link>
        </div>
      </div>
    </div>
  );
}

// Re-export from shared API client for backwards compatibility
export { getAuthToken, isGuest, isAuthenticated } from '@/lib/api';
