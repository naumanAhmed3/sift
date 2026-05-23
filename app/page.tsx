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
      {/* Masthead */}
      <header className="border-b border-line">
        <div className="max-w-4xl mx-auto px-7 h-16 flex items-baseline gap-4">
          <span className="font-display text-[26px] font-semibold tracking-[-0.02em] leading-none self-center">
            Sift
          </span>
          <span className="hidden sm:block font-display italic text-[15px] text-muted self-center">
            hybrid retrieval, made legible
          </span>
          {stats && (
            <span className="ml-auto self-center font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              {stats.total} documents indexed
            </span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-7">
        {/* Hero */}
        <section className="pt-14 pb-9 rise">
          <h1 className="font-display text-[33px] sm:text-[52px] leading-[1.07] sm:leading-[1.05] tracking-[-0.025em] font-semibold max-w-2xl">
            Search that
            <br />
            shows its <span className="italic text-accent">work</span>.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-muted max-w-xl">
            Vector, keyword, and hybrid retrieval over one corpus on Postgres
            and pgvector — returned with the exact SQL, the query plan, and the
            latency behind every result.
          </p>
        </section>

        <div className="pb-20">
          {dbError || !stats ? (
            <p className="rounded-md bg-card border border-line px-5 py-4 text-[14px] text-accent">
              Could not reach the database. Check the DATABASE_URL configuration.
            </p>
          ) : (
            <SearchConsole stats={stats} />
          )}
        </div>
      </main>
    </div>
  );
}
