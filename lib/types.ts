// ─────────────────────────────────────────────────────────────
// Sift — shared types
// ─────────────────────────────────────────────────────────────

/** A document in the corpus. */
export interface Doc {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  source: string;
  year: number | null;
}

export type SearchMode = 'vector' | 'keyword' | 'hybrid';

/** Optional metadata pre-filters applied inside the search query. */
export interface SearchFilters {
  category?: string | null;
  minYear?: number | null;
}

/** One ranked search result. */
export interface SearchHit {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  year: number | null;
  /** Final ranking score (cosine similarity, ts_rank, or fused RRF). */
  score: number;
  /** Rank in the vector leg (hybrid mode only). */
  vectorRank: number | null;
  /** Rank in the keyword leg (hybrid mode only). */
  keywordRank: number | null;
}

/** What the search API returns — results plus full query transparency. */
export interface SearchResponse {
  mode: SearchMode;
  query: string;
  hits: SearchHit[];
  /** The exact SQL that produced the results. */
  sql: string;
  /** `EXPLAIN ANALYZE` output for that SQL. */
  plan: string;
  timings: {
    embedMs: number;
    queryMs: number;
    totalMs: number;
  };
}
