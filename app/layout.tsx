import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Renji — Startup Idea Validator',
  description:
    'Free AI-powered startup idea validator. Analyze market demand, competition, and opportunity in seconds using real Hacker News data.',
  openGraph: {
    title: 'Renji — Startup Idea Validator',
    description: 'Validate your startup idea with real market data. Free, instant, AI-powered.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full bg-zinc-50 text-zinc-900 antialiased">{children}</body>
    </html>
  );
}
