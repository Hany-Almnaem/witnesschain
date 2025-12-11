import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { Providers } from '@/components/providers';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: {
    default: 'WitnessChain',
    template: '%s | WitnessChain',
  },
  description:
    'Decentralized platform for preserving human rights evidence using Filecoin',
  keywords: [
    'human rights',
    'evidence',
    'filecoin',
    'decentralized',
    'blockchain',
    'privacy',
  ],
  authors: [{ name: 'WitnessChain' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'WitnessChain',
    description:
      'Decentralized platform for preserving human rights evidence using Filecoin',
    siteName: 'WitnessChain',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WitnessChain',
    description:
      'Decentralized platform for preserving human rights evidence using Filecoin',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
