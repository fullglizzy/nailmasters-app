'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <svg className="h-10 w-10 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h1 className="font-display text-2xl">Что-то пошло не так</h1>
        <p className="text-muted-foreground">
          Произошла ошибка при загрузке страницы. Попробуйте обновить или вернуться на главную.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Попробовать снова
          </button>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-full border border-border/60 px-6 text-sm font-medium hover:bg-surface transition-colors"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
