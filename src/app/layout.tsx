import type { Metadata } from 'next';
import Link from 'next/link';
import { Fredoka, Nunito } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { AuthButton } from '@/components/auth-button';

const fredoka = Fredoka({
  variable: '--font-fredoka',
  subsets: ['latin'],
  display: 'swap',
});

const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AutoQuiz – Fun & Fast Learning',
  description: 'Turn dense documents into playful quizzes in seconds.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fredoka.variable} ${nunito.variable} min-h-screen bg-[#EEF2FF] dark:bg-[#0F172A] text-[#1E1B4B] dark:text-[#E2E8F0] antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="sticky top-0 z-50 border-b border-indigo-100 dark:border-indigo-900/50 bg-white/70 dark:bg-indigo-950/80 backdrop-blur-md transition-colors duration-300">
            <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-8">
              <Link href="/" className="font-heading text-2xl font-bold text-indigo-600 dark:text-indigo-400 transition-transform hover:scale-105">
                AutoQuiz
              </Link>
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex gap-6 font-body text-sm font-bold text-indigo-900/70 dark:text-indigo-200/70">
                  <Link href="/dashboard" className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">
                    Dashboard
                  </Link>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noreferrer"
                    className="transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    Docs
                  </a>
                </div>
                <AuthButton />
                <ThemeToggle />
              </div>
            </nav>
          </div>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
