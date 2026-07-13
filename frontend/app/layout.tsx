import type { Metadata } from 'next';
import '@fontsource-variable/manrope';
import '@fontsource/dm-serif-display';
import './globals.css';
import { AuthProvider } from '@/components/auth/auth-provider';
import { ThemeProvider } from '@/components/theme/theme-provider';

export const metadata: Metadata = {
  title: 'Ledger | Personal finance, clearly',
  description: 'A calmer way to understand spending, budgets, and savings.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
