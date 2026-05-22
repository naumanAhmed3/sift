import type { Metadata } from 'next';
import { Fraunces, Figtree, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  style: ['normal', 'italic'],
  display: 'swap',
});

const sans = Figtree({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Sift — Hybrid Retrieval on pgvector',
  description:
    'A hybrid search engine on Postgres + pgvector: HNSW vector search, full-text search, and Reciprocal Rank Fusion — with a query inspector that shows the SQL, the EXPLAIN plan and the latency.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
