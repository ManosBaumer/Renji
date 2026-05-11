import type { Metadata } from 'next';
import { Instrument_Serif, Inter, JetBrains_Mono } from 'next/font/google';
import { DocumentScrollbar } from '@/components/DocumentScrollbar';
import { PersistentVeilBackground } from '@/components/PersistentVeilBackground';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  variable: '--font-instrument-serif',
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Renji',
  description:
    'Real signals from Hacker News, Reddit, GitHub and more — quietly scored into demand, competition and opportunity.',
  openGraph: {
    title: 'Renji — validate your idea with real data',
    description:
      'Real signals from Hacker News, Reddit, GitHub and more — quietly scored into demand, competition and opportunity.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSerif.variable} ${jetbrains.variable} h-full`}
    >
      <body className="renji-body min-h-full antialiased">
        <PersistentVeilBackground />
        {children}
        <DocumentScrollbar />
      </body>
    </html>
  );
}
