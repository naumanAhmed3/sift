'use client';

import { useState } from 'react';
import type { CorpusStats } from '@/lib/repo';
import type { SearchHit, SearchMode, SearchResponse } from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// The Sift search console — query input, mode + filters, results,
// and the query inspector (SQL · EXPLAIN plan · latency).
// ─────────────────────────────────────────────────────────────

const MODES: { id: SearchMode; label: string; blurb: string }[] = [
  {
    id: 'vector',
    label: 'Vector',
    blurb:
      'HNSW approximate-nearest-neighbour over the 1536-d embedding. Matches meaning, not words.',
  },
  {
    id: 'keyword',
    label: 'Keyword',
    blurb:
      'Postgres full-text search over the tsvector with ts_rank_cd. Exact lexical matching.',
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    blurb:
      'Both legs fused with Reciprocal Rank Fusion (k = 60) — robust across query styles.',
  },
];

const EXAMPLES = [
  'how do systems keep running when a machine fails',
  'HNSW ef_search',
  'reciprocal rank fusion',
  'stop one slow service taking down everything',
  'vector index recall versus latency',
];

export function SearchConsole({ stats }: { stats: CorpusStats }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('hybrid');
  const [category, setCategory] = useState('');
  const [minYear, setMinYear] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);

  const yearOptions = [];
  for (let y = stats.years.min; y <= stats.years.max; y++) yearOptions.push(y);

  async function run(overrides?: {
    mode?: SearchMode;
    category?: string;
    minYear?: number;
    query?: string;
  }) {
    const q = (overrides?.query ?? query).trim();
    if (!q) return;
    if (overrides?.query !== undefined) setQuery(q);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: q,
          mode: overrides?.mode ?? mode,
          category: (overrides?.category ?? category) || null,
          minYear: (overrides?.minYear ?? minYear) || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const activeMode = MODES.find((m) => m.id === mode)!;

  return (
    <>
      {/* Search card */}
      <section className="rounded-2xl bg-surface ring-1 ring-edge p-5 sf-fade">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
          className="flex items-center gap-2.5"
        >
          <div className="flex-1 flex items-center gap-2.5 rounded-xl bg-ink ring-1 ring-edge focus-within:ring-brand/50 px-3.5 h-11 transition">
            <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 text-neutral-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the knowledge base…"
              className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-neutral-600"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-11 px-5 rounded-xl bg-brand text-ink text-sm font-semibold hover:brightness-110 disabled:opacity-60 transition inline-flex items-center gap-2"
          >
            {loading && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-ink/30 border-t-ink sf-spin" />
            )}
            Search
          </button>
        </form>

        {/* Mode toggle */}
        <div className="mt-3.5 flex items-center gap-3 flex-wrap">
          <div className="inline-flex rounded-lg bg-ink ring-1 ring-edge p-0.5">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id);
                  if (result || query.trim()) run({ mode: m.id });
                }}
                className={`px-3 h-8 rounded-md text-[12.5px] font-medium transition ${
                  mode === m.id
                    ? 'bg-brand text-ink'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              if (result) run({ category: e.target.value });
            }}
            className="h-8 rounded-lg bg-ink ring-1 ring-edge px-2.5 text-[12.5px] text-neutral-300 outline-none"
          >
            <option value="">All categories</option>
            {stats.categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>

          <select
            value={minYear}
            onChange={(e) => {
              const y = Number(e.target.value);
              setMinYear(y);
              if (result) run({ minYear: y });
            }}
            className="h-8 rounded-lg bg-ink ring-1 ring-edge px-2.5 text-[12.5px] text-neutral-300 outline-none"
          >
            <option value={0}>Any year</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y} or later
              </option>
            ))}
          </select>
        </div>

        <p className="mt-2.5 text-[12px] text-neutral-500 leading-relaxed">
          {activeMode.blurb}
        </p>

        {/* Examples */}
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-neutral-600">try</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => run({ query: ex })}
              className="text-[11.5px] rounded-full bg-surface-2 ring-1 ring-edge px-2.5 py-1 text-neutral-400 hover:text-white hover:ring-brand/40 transition"
            >
              {ex}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <p className="mt-4 rounded-lg bg-red-500/10 ring-1 ring-red-500/25 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Results */}
      {result && (
        <section className="mt-5 sf-fade">
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <h2 className="text-sm font-semibold text-neutral-300">
              {result.hits.length} result{result.hits.length === 1 ? '' : 's'}
            </h2>
            <div className="flex items-center gap-2.5 text-[11px] font-mono text-neutral-500">
              {result.timings.embedMs > 0 && (
                <span>embed {result.timings.embedMs.toFixed(0)}ms</span>
              )}
              <span className="text-edge">·</span>
              <span>query {result.timings.queryMs.toFixed(1)}ms</span>
              <span className="text-edge">·</span>
              <span className="text-neutral-400">
                total {result.timings.totalMs.toFixed(0)}ms
              </span>
            </div>
            <button
              onClick={() => setShowSql((s) => !s)}
              className="ml-auto text-[12px] text-brand hover:underline"
            >
              {showSql ? 'Hide' : 'Inspect'} query ↓
            </button>
          </div>

          {showSql && <QueryInspector result={result} />}

          <div className="space-y-2.5">
            {result.hits.map((hit, i) => (
              <ResultCard key={hit.id} hit={hit} rank={i + 1} mode={result.mode} />
            ))}
            {result.hits.length === 0 && (
              <p className="text-[13px] text-neutral-500 rounded-xl bg-surface ring-1 ring-edge px-4 py-8 text-center">
                No documents matched. Keyword search needs a lexical overlap —
                try Hybrid or Vector mode.
              </p>
            )}
          </div>
        </section>
      )}

      {!result && !error && (
        <p className="mt-8 text-center text-[13px] text-neutral-600">
          Search {stats.total} documents across vector, keyword and hybrid
          retrieval — and inspect the exact SQL behind every result.
        </p>
      )}
    </>
  );
}

function QueryInspector({ result }: { result: SearchResponse }) {
  return (
    <div className="mb-3 rounded-xl bg-surface ring-1 ring-edge overflow-hidden">
      <div className="px-4 py-2 border-b border-edge-soft text-[11px] font-mono uppercase tracking-wide text-neutral-500">
        SQL executed
      </div>
      <pre className="px-4 py-3 text-[11.5px] font-mono text-neutral-300 overflow-x-auto leading-relaxed">
        {result.sql}
      </pre>
      <div className="px-4 py-2 border-y border-edge-soft text-[11px] font-mono uppercase tracking-wide text-neutral-500">
        EXPLAIN ANALYZE
      </div>
      <pre className="px-4 py-3 text-[11px] font-mono text-neutral-400 overflow-x-auto leading-relaxed max-h-72">
        {result.plan}
      </pre>
    </div>
  );
}

function ResultCard({
  hit,
  rank,
  mode,
}: {
  hit: SearchHit;
  rank: number;
  mode: SearchMode;
}) {
  return (
    <div className="rounded-xl bg-surface ring-1 ring-edge hover:ring-neutral-600 p-4 transition">
      <div className="flex items-start gap-3">
        <span className="text-[12px] font-mono text-neutral-600 w-5 text-right pt-0.5 shrink-0">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-[14px] text-neutral-100">
              {hit.title}
            </h3>
            <span className="text-[10.5px] font-mono text-brand bg-brand/10 ring-1 ring-brand/20 rounded px-1.5 py-0.5">
              {hit.category}
            </span>
            {hit.year && (
              <span className="text-[10.5px] font-mono text-neutral-600">
                {hit.year}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[12.5px] text-neutral-400 leading-relaxed">
            {hit.content}
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <ScoreBadges hit={hit} mode={mode} />
            <span className="text-edge">·</span>
            {hit.tags.map((t) => (
              <span key={t} className="text-[10.5px] font-mono text-neutral-600">
                #{t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreBadges({ hit, mode }: { hit: SearchHit; mode: SearchMode }) {
  if (mode === 'vector') {
    return (
      <span className="text-[11px] font-mono text-neutral-300">
        cosine similarity{' '}
        <span className="text-brand">{(hit.score * 100).toFixed(1)}%</span>
      </span>
    );
  }
  if (mode === 'keyword') {
    return (
      <span className="text-[11px] font-mono text-neutral-300">
        ts_rank <span className="text-kw">{hit.score.toFixed(4)}</span>
      </span>
    );
  }
  // hybrid
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-mono">
      <span className="text-neutral-300">
        RRF <span className="text-brand">{hit.score.toFixed(4)}</span>
      </span>
      <span
        className={`rounded px-1.5 py-0.5 ring-1 ${
          hit.vectorRank
            ? 'text-vec bg-vec/10 ring-vec/25'
            : 'text-neutral-600 ring-edge'
        }`}
      >
        vec {hit.vectorRank ? `#${hit.vectorRank}` : '—'}
      </span>
      <span
        className={`rounded px-1.5 py-0.5 ring-1 ${
          hit.keywordRank
            ? 'text-kw bg-kw/10 ring-kw/25'
            : 'text-neutral-600 ring-edge'
        }`}
      >
        kw {hit.keywordRank ? `#${hit.keywordRank}` : '—'}
      </span>
    </span>
  );
}
