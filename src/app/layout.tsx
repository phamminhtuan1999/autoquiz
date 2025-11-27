import type { Metadata } from 'next';
import Link from 'next/link';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
});

export const metadata: Metadata = {
  title: 'AutoQuiz – Document to Quiz SaaS',
  description: 'Convert PDFs into quizzes with Supabase auth, Stripe credits, and Gemini AI.'
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-slate-50">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-slate-50 text-slate-900 antialiased`}>
        <div className="border-b border-slate-200 bg-white/80 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-8">
            <Link href="/" className="text-lg font-semibold text-slate-900">
              AutoQuiz
            </Link>
            <div className="flex gap-4 text-sm font-medium text-slate-600">
              <Link href="/dashboard" className="hover:text-slate-900">
                Dashboard
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-slate-900"
              >
                Docs
              </a>
            </div>
          </nav>
        </div>
        {children}
      </body>
    </html>
  );
}
