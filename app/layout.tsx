import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
