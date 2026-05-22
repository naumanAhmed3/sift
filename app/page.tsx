import { corpusStats, type CorpusStats } from '@/lib/repo';
import { SearchConsole } from './search-console';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let stats: CorpusStats | null = null;
  let dbError = false;
  try {
    stats = await corpusStats();
  } catch {
    dbError = true;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-edge-soft">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-brand/15 ring-1 ring-brand/30 text-brand">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 5h18l-7 8.5V20l-4 1.5v-8z" />
            </svg>
          </span>
          <div>
            <h1 className="font-semibold tracking-tight leading-tight">Sift</h1>
            <p className="text-[11.5px] text-neutral-500 leading-tight">
              hybrid retrieval on Postgres + pgvector
            </p>
          </div>
          {stats && (
            <span className="ml-auto text-[11px] font-mono text-neutral-600 hidden sm:block">
              {stats.total} documents · HNSW + full-text indexed
            </span>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {dbError || !stats ? (
          <p className="rounded-lg bg-red-500/10 ring-1 ring-red-500/25 px-4 py-3 text-sm text-red-300">
            Could not reach the database. Check the DATABASE_URL configuration.
          </p>
        ) : (
          <SearchConsole stats={stats} />
        )}
      </main>
    </div>
  );
}
