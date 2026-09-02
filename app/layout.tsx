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
  metadataBase: new URL('https://tandem-listening-lab.alx21.chatgpt.site'),
  title: 'tandem — Your ears are the eval.',
  description:
    'A local-first blind listening lab where your browser agent stages safe EQ experiments and you listen, vote, and approve.',
  applicationName: 'tandem',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'tandem — Your ears are the eval.',
    description:
      'A local-first blind listening lab for genuine human-agent collaboration.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'tandem — Your ears are the eval.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'tandem — Your ears are the eval.',
    description:
      'A local-first blind listening lab for genuine human-agent collaboration.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
