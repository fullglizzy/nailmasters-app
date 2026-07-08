'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { useState, type ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 минута
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster
          position="top-right"
          closeButton
          expand={false}
          gap={8}
          toastOptions={{
            duration: 4000,
            className: 'sonner-toast',
            classNames: {
              toast: '!bg-card !text-foreground !border !border-border/40 !shadow-lg !rounded-xl',
              title: '!text-sm !font-semibold',
              description: '!text-xs !text-muted-foreground',
              closeButton: '!text-muted-foreground hover:!text-foreground !left-auto !right-2',
              success: '!border-l-secondary',
              error: '!border-l-destructive',
              warning: '!border-l-gold',
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
