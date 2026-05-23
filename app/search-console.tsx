'use client';

import { useState } from 'react';
import type { CorpusStats } from '@/lib/repo';
import type { SearchHit, SearchMode, SearchResponse } from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// The Sift search console — query, mode, filters, results, and the
// query inspector (SQL · EXPLAIN plan · latency).
// ─────────────────────────────────────────────────────────────

const MODES: { id: SearchMode; label: string; blurb: string }[] = [
  {
    id: 'vector',
    label: 'Vector',
    blurb:
      'HNSW approximate-nearest-neighbour over the 1536-dimension embedding. It matches meaning, not words.',
  },
  {
    id: 'keyword',
    label: 'Keyword',
    blurb:
      'Postgres full-text search over the tsvector, ranked by ts_rank_cd. Exact lexical matching.',
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    blurb:
      'Both legs fused with Reciprocal Rank Fusion (k = 60) — steady across every kind of query.',
  },
];

const EXAMPLES = [
  'how do systems keep running when a machine fails',
  'HNSW ef_search',
  'reciprocal rank fusion',
  'stop one slow service taking down everything',
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

  const years: number[] = [];
  for (let y = stats.years.min; y <= stats.years.max; y++) years.push(y);

  async function run(o?: {
    mode?: SearchMode;
    category?: string;
    minYear?: number;
    query?: string;
  }) {
    const q = (o?.query ?? query).trim();
    if (!q) return;
    if (o?.query !== undefined) setQuery(q);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: q,
          mode: o?.mode ?? mode,
          category: (o?.category ?? category) || null,
          minYear: (o?.minYear ?? minYear) || null,
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

  const active = MODES.find((m) => m.id === mode)!;

  return (
    <div className="rise" style={{ animationDelay: '80ms' }}>
      {/* Search field */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="flex items-stretch gap-2.5"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask the knowledge base a question…"
          className="flex-1 h-14 rounded-lg bg-card border border-line px-5 text-[16px] outline-none transition placeholder:text-muted placeholder:italic focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading}
          className="h-14 px-7 rounded-lg bg-accent text-card text-[14px] font-medium tracking-wide hover:opacity-90 disabled:opacity-50 transition inline-flex items-center gap-2.5"
        >
          {loading && (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-card/40 border-t-card spin" />
          )}
          Search
        </button>
      </form>

      {/* Mode tabs + filters */}
      <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-2 border-b border-line">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setMode(m.id);
              if (result || query.trim()) run({ mode: m.id });
            }}
            className={`pb-2.5 -mb-px border-b-2 font-display text-[19px] tracking-[-0.01em] transition ${
              mode === m.id
                ? 'border-accent text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {m.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 pb-2.5 text-[12px] min-w-0">
          <Select
            value={category}
            onChange={(v) => {
              setCategory(v);
              if (result) run({ category: v });
            }}
          >
            <option value="">All categories</option>
            {stats.categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} · {c.count}
              </option>
            ))}
          </Select>
          <Select
            value={String(minYear)}
            onChange={(v) => {
              setMinYear(Number(v));
              if (result) run({ minYear: Number(v) });
            }}
          >
            <option value="0">Any year</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}+
              </option>
            ))}
          </Select>
        </div>
      </div>

      <p className="mt-3 text-[13.5px] leading-relaxed text-muted italic font-display">
        {active.blurb}
      </p>

      {/* Examples */}
      <div className="mt-3 flex items-center gap-x-4 gap-y-1.5 flex-wrap text-[12.5px]">
        <span className="font-mono uppercase tracking-[0.14em] text-[10.5px] text-muted">
          Try
        </span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => run({ query: ex })}
            className="text-muted hover:text-accent underline decoration-line underline-offset-[3px] hover:decoration-accent transition"
          >
            {ex}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-6 rounded-md bg-card border border-line px-5 py-4 text-[14px] text-accent">
          {error}
        </p>
      )}

      {/* Results */}
      {result && (
        <section className="mt-9">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 pb-3 border-b border-line">
            <h2 className="font-display text-[20px] tracking-[-0.01em]">
              {result.hits.length} result{result.hits.length === 1 ? '' : 's'}
            </h2>
            <span className="font-mono text-[11px] text-muted">
              {result.timings.embedMs > 0 &&
                `embed ${result.timings.embedMs.toFixed(0)}ms · `}
              query {result.timings.queryMs.toFixed(1)}ms · total{' '}
              {result.timings.totalMs.toFixed(0)}ms
            </span>
            <button
              onClick={() => setShowSql((s) => !s)}
              className="ml-auto text-[12.5px] text-accent hover:opacity-70 transition"
            >
              {showSql ? 'Hide query' : 'Inspect query'}
            </button>
          </div>

          {showSql && <QueryInspector result={result} />}

          <ol>
            {result.hits.map((hit, i) => (
              <ResultEntry
                key={hit.id}
                hit={hit}
                rank={i + 1}
                mode={result.mode}
                delay={i * 45}
              />
            ))}
          </ol>
          {result.hits.length === 0 && (
            <p className="py-10 text-center text-[14px] text-muted italic font-display">
              Nothing matched. Keyword search needs a lexical overlap — try
              Hybrid or Vector.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-transparent border-b border-line text-muted hover:text-ink focus:text-ink focus:border-accent outline-none pb-0.5 transition cursor-pointer"
    >
      {children}
    </select>
  );
}

function QueryInspector({ result }: { result: SearchResponse }) {
  return (
    <div className="grow my-4 rounded-lg overflow-hidden bg-code">
      <Block label="SQL executed">{result.sql}</Block>
      <div className="h-px bg-white/10" />
      <Block label="EXPLAIN ANALYZE" max>
        {result.plan}
      </Block>
    </div>
  );
}

function Block({
  label,
  max,
  children,
}: {
  label: string;
  max?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-4 pt-3 pb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
        {label}
      </div>
      <pre
        className={`px-4 pb-3.5 font-mono text-[11.5px] leading-relaxed text-[#cdc8bd] overflow-x-auto ${
          max ? 'max-h-72' : ''
        }`}
      >
        {children}
      </pre>
    </div>
  );
}

function ResultEntry({
  hit,
  rank,
  mode,
  delay,
}: {
  hit: SearchHit;
  rank: number;
  mode: SearchMode;
  delay: number;
}) {
  return (
    <li
      className="rise grid grid-cols-[2.2rem_1fr] gap-x-4 py-5 border-b border-line-soft"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="font-mono text-[12px] text-muted pt-1.5 tabular-nums">
        {String(rank).padStart(2, '0')}
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h3 className="font-display text-[19px] tracking-[-0.01em] leading-snug">
            {hit.title}
          </h3>
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent">
            {hit.category}
          </span>
          {hit.year && (
            <span className="font-mono text-[11px] text-muted">{hit.year}</span>
          )}
        </div>
        <p className="mt-1.5 text-[14px] leading-[1.65] text-ink/75">
          {hit.content}
        </p>
        <div className="mt-2.5 flex items-center gap-3 flex-wrap">
          <Scores hit={hit} mode={mode} />
          {hit.tags.map((t) => (
            <span key={t} className="font-mono text-[11px] text-muted">
              {t}
            </span>
          ))}
        </div>
      </div>
    </li>
  );
}

function Scores({ hit, mode }: { hit: SearchHit; mode: SearchMode }) {
  if (mode === 'vector') {
    return (
      <span className="font-mono text-[11.5px]">
        <span className="text-muted">cosine </span>
        <span className="text-accent font-medium">
          {(hit.score * 100).toFixed(1)}%
        </span>
      </span>
    );
  }
  if (mode === 'keyword') {
    return (
      <span className="font-mono text-[11.5px]">
        <span className="text-muted">ts_rank </span>
        <span className="text-kw font-medium">{hit.score.toFixed(4)}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2.5 font-mono text-[11.5px]">
      <span>
        <span className="text-muted">RRF </span>
        <span className="text-accent font-medium">{hit.score.toFixed(4)}</span>
      </span>
      <span className={hit.vectorRank ? 'text-vec' : 'text-muted/50'}>
        vec {hit.vectorRank ? hit.vectorRank : '—'}
      </span>
      <span className={hit.keywordRank ? 'text-kw' : 'text-muted/50'}>
        kw {hit.keywordRank ? hit.keywordRank : '—'}
      </span>
    </span>
  );
}
