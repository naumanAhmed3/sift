import { db } from './db';
import { embed, toVectorLiteral } from './embed';
import type {
  SearchFilters,
  SearchHit,
  SearchMode,
  SearchResponse,
} from './types';

// ─────────────────────────────────────────────────────────────
// The retrieval engine. Three modes over the same corpus:
//   • vector  — HNSW approximate nearest-neighbour on the embedding
//   • keyword — Postgres full-text search over the tsvector
//   • hybrid  — both, fused with Reciprocal Rank Fusion
// Every search also returns the exact SQL and its EXPLAIN plan.
// ─────────────────────────────────────────────────────────────

const K = 12; // results returned
const CANDIDATES = 50; // per-leg candidates fed into the fusion
const RRF_K = 60; // Reciprocal Rank Fusion constant
const EF_SEARCH = 100; // HNSW recall/latency knob

const SELECT_COLS = 'id, title, content, category, tags, year';

interface Built {
  text: string;
  params: unknown[];
}

/** Build a metadata filter fragment, appending params. */
function filterFragment(
  filters: SearchFilters,
  params: unknown[],
): string {
  let sql = '';
  if (filters.category) {
    params.push(filters.category);
    sql += ` and category = $${params.length}`;
  }
  if (filters.minYear) {
    params.push(filters.minYear);
    sql += ` and year >= $${params.length}`;
  }
  return sql;
}

function buildVector(vec: string, filters: SearchFilters): Built {
  const params: unknown[] = [vec];
  const f = filterFragment(filters, params);
  const text =
    `select ${SELECT_COLS},\n` +
    `       (1 - (embedding <=> $1::halfvec))::float8 as score\n` +
    `from documents\n` +
    `where embedding is not null${f}\n` +
    `order by embedding <=> $1::halfvec\n` +
    `limit ${K}`;
  return { text, params };
}

function buildKeyword(query: string, filters: SearchFilters): Built {
  const params: unknown[] = [query];
  const f = filterFragment(filters, params);
  const text =
    `select ${SELECT_COLS},\n` +
    `       ts_rank_cd(tsv, websearch_to_tsquery('english', $1))::float8 as score\n` +
    `from documents\n` +
    `where tsv @@ websearch_to_tsquery('english', $1)${f}\n` +
    `order by score desc\n` +
    `limit ${K}`;
  return { text, params };
}

function buildHybrid(
  vec: string,
  query: string,
  filters: SearchFilters,
): Built {
  const params: unknown[] = [vec, query];
  const f = filterFragment(filters, params); // shared by both legs
  const text =
    `with vector_leg as (\n` +
    `  select id, row_number() over (order by embedding <=> $1::halfvec) as rank\n` +
    `  from documents\n` +
    `  where embedding is not null${f}\n` +
    `  order by embedding <=> $1::halfvec\n` +
    `  limit ${CANDIDATES}\n` +
    `),\n` +
    `keyword_leg as (\n` +
    `  select id, row_number() over (\n` +
    `    order by ts_rank_cd(tsv, websearch_to_tsquery('english', $2)) desc\n` +
    `  ) as rank\n` +
    `  from documents\n` +
    `  where tsv @@ websearch_to_tsquery('english', $2)${f}\n` +
    `  limit ${CANDIDATES}\n` +
    `)\n` +
    `select d.${SELECT_COLS.split(', ').join(', d.')},\n` +
    `       (coalesce(1.0 / (${RRF_K} + v.rank), 0)\n` +
    `        + coalesce(1.0 / (${RRF_K} + k.rank), 0))::float8 as score,\n` +
    `       v.rank::int as vector_rank,\n` +
    `       k.rank::int as keyword_rank\n` +
    `from documents d\n` +
    `left join vector_leg v on v.id = d.id\n` +
    `left join keyword_leg k on k.id = d.id\n` +
    `where v.id is not null or k.id is not null\n` +
    `order by score desc\n` +
    `limit ${K}`;
  return { text, params };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toHit(r: any): SearchHit {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    category: r.category,
    tags: r.tags,
    year: r.year,
    score: Number(r.score),
    vectorRank: r.vector_rank == null ? null : Number(r.vector_rank),
    keywordRank: r.keyword_rank == null ? null : Number(r.keyword_rank),
  };
}

export async function search(
  query: string,
  mode: SearchMode,
  filters: SearchFilters,
): Promise<SearchResponse> {
  const t0 = performance.now();

  // 1 — embed the query (skipped for pure keyword search).
  let embedMs = 0;
  let vecLiteral = '';
  if (mode !== 'keyword') {
    const e0 = performance.now();
    vecLiteral = toVectorLiteral(await embed(query));
    embedMs = performance.now() - e0;
  }

  // 2 — build the SQL for the chosen mode.
  const built =
    mode === 'vector'
      ? buildVector(vecLiteral, filters)
      : mode === 'keyword'
        ? buildKeyword(query, filters)
        : buildHybrid(vecLiteral, query, filters);

  // 3 — run it (and EXPLAIN it) inside one transaction so the HNSW
  //     recall knob can be set with SET LOCAL.
  const sql = db();
  let rows: any[] = [];
  let plan = '';
  let queryMs = 0;
  let totalMs = 0;

  await sql.begin(async (tx) => {
    if (mode !== 'keyword') {
      await tx.unsafe(`set local hnsw.ef_search = ${EF_SEARCH}`);
    }
    const q0 = performance.now();
    rows = await tx.unsafe(built.text, built.params as any[]);
    queryMs = performance.now() - q0;
    // The search itself is done here — the EXPLAIN below is extra work
    // for the inspector and is deliberately left out of totalMs.
    totalMs = performance.now() - t0;

    const planRows = await tx.unsafe(
      `explain (analyze, buffers, format text) ${built.text}`,
      built.params as any[],
    );
    plan = planRows.map((r: any) => r['QUERY PLAN']).join('\n');
  });

  return {
    mode,
    query,
    hits: rows.map(toHit),
    sql: built.text,
    plan,
    timings: { embedMs, queryMs, totalMs },
  };
}
