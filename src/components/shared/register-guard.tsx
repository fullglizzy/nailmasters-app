'use client';

import Link from 'next/link';
import { UserPlus } from 'lucide-react';

export function RegisterGuard({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div className="relative z-10 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-background p-8 shadow-xl modal-enter text-center" onClick={e => e.stopPropagation()}>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gold/10">
          <UserPlus className="h-8 w-8 text-gold" />
        </div>
        <h3 className="text-xl font-bold mb-2">Требуется регистрация</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Эта функция доступна только зарегистрированным пользователям. Это быстро и бесплатно!
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-full border py-2.5 text-sm font-medium hover:bg-accent">
            Позже
          </button>
          <Link href="/auth" className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 text-center">
            Зарегистрироваться
          </Link>
        </div>
      </div>
    </div>
  );
}

// Hook to check if guest and trigger guard
export function useGuestGuard() {
  if (typeof window === 'undefined') return false;
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return user.isGuest === true;
}
