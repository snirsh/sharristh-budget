import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { WebVitals } from '@/components/analytics/WebVitals';
import { Sidebar } from '@/components/layout/Sidebar';
import { ThemeProvider } from '@/lib/theme';
import { TRPCProvider } from '@/lib/trpc/provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'Sharristh Budget',
  description: 'Family budget tracker for two partners',
  icons: {
    icon: '/favicon.svg',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (theme === 'dark' || (!theme && prefersDark)) {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans antialiased">
        <WebVitals />
        <ThemeProvider>
          <TRPCProvider>
            <div className="flex min-h-screen">
              <Suspense>
                <Sidebar />
              </Suspense>
              <main className="flex-1 overflow-auto pt-16 lg:pt-0">
                <div className="container mx-auto max-w-7xl p-6">{children}</div>
              </main>
            </div>
          </TRPCProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
