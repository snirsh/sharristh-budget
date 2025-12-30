import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { TRPCProvider } from '@/lib/trpc/provider';
import { ThemeProvider } from '@/lib/theme';
import { Sidebar } from '@/components/layout/Sidebar';

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
        <ThemeProvider>
          <TRPCProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 overflow-auto">
                <div className="container mx-auto max-w-7xl p-6">
                  {children}
                </div>
              </main>
            </div>
          </TRPCProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

