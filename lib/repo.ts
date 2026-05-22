import { db } from './db';
import { CATEGORIES } from './corpus';

// ─────────────────────────────────────────────────────────────
// Small read helpers for the dashboard shell.
// ─────────────────────────────────────────────────────────────

export interface CorpusStats {
  total: number;
  categories: { name: string; count: number }[];
  years: { min: number; max: number };
}

export async function corpusStats(): Promise<CorpusStats> {
  const [total] = await db()`select count(*)::int as n from documents`;
  const rows = await db()`
    select category, count(*)::int as n from documents group by category`;
  const [span] = await db()`
    select min(year)::int as lo, max(year)::int as hi from documents`;

  const byCat: Record<string, number> = {};
  for (const r of rows) byCat[r.category] = r.n;

  return {
    total: total.n,
    categories: CATEGORIES.map((c) => ({ name: c, count: byCat[c] ?? 0 })),
    years: { min: span?.lo ?? 2015, max: span?.hi ?? 2025 },
  };
}
