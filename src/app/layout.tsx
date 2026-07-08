import type { Metadata, Viewport } from 'next';
import { Manrope, Yeseva_One } from 'next/font/google';
import { Providers } from '@/components/providers/providers';
import { AppHeader } from '@/components/layout/app-header';
import { BottomNavigation } from '@/components/layout/bottom-nav';
import { GuestSessionProvider } from '@/components/providers/guest-provider';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-sans',
  display: 'swap',
});

const yesevaOne = Yeseva_One({
  weight: '400',
  subsets: ['latin', 'cyrillic'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'NailMasters — Каталог дизайнов маникюра',
    template: '%s | NailMasters',
  },
  description: 'Платформа для каталогизации и заказа дизайнов маникюра. Найдите своего мастера или вдохновение для нового дизайна.',
  keywords: ['маникюр', 'дизайн ногтей', 'nail masters', 'каталог маникюра', 'nail design', 'мастер маникюра', 'запись на маникюр'],
  authors: [{ name: 'NailMasters' }],
  robots: { index: true, follow: true },
  openGraph: { type: 'website', locale: 'ru_RU', siteName: 'NailMasters', title: 'NailMasters — Каталог дизайнов маникюра', description: 'Найдите своего мастера или вдохновение для нового дизайна.' },
};

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F1EC' },
    { media: '(prefers-color-scheme: dark)', color: '#13101A' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${manrope.variable} ${yesevaOne.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <a href="#main-content" className="skip-to-content">
          Перейти к содержимому
        </a>
        <Providers>
          <GuestSessionProvider>
            <AppHeader />
            <main id="main-content" className="pb-20 md:pb-0">{children}</main>
            <BottomNavigation />
          </GuestSessionProvider>
        </Providers>
      </body>
    </html>
  );
}
