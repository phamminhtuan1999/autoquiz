import type { Metadata } from 'next';
import { Sora, Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import './globals.css';

const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AutoQuiz',
  description: 'Upload a document. AI drafts the quiz. You approve it.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sora.variable} ${plusJakartaSans.variable} ${geistMono.variable} min-h-screen antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
