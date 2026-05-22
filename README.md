# Sift — Hybrid Retrieval on pgvector

Sift is a search engine that does retrieval the way a production system
should: it runs **vector search**, **keyword search**, and a **hybrid** of the
two over the same corpus in Postgres — and shows you the exact SQL, the
`EXPLAIN ANALYZE` plan, and the latency behind every result.

It is not a RAG chatbot. It is the **retrieval layer** that a good RAG system
is built on, made inspectable.

**Live demo:** https://sift-orpin.vercel.app

---

## The three modes

| Mode | How it works | Good at |
|---|---|---|
| **Vector** | HNSW approximate-nearest-neighbour on a 1536-d embedding (`embedding <=> query`) | meaning, paraphrase, no shared words |
| **Keyword** | Postgres full-text search over a `tsvector`, ranked by `ts_rank_cd` | exact terms, identifiers, acronyms |
| **Hybrid** | both legs fused with **Reciprocal Rank Fusion** (k = 60) | robust across every query style |

Switch modes on the same query and watch the ranking change — vector finds
*"how do systems keep running when a machine fails"* → *Circuit breakers*;
keyword nails *"HNSW ef_search"*; hybrid gets both right.

---

## What makes it a pgvector showcase

- **`halfvec(1536)`** — embeddings are stored as half-precision vectors, so the
  column and its index take roughly half the space of `vector(1536)` with
  negligible recall loss.
- **HNSW index** (`halfvec_cosine_ops`, `m = 16`, `ef_construction = 64`) for
  approximate nearest-neighbour search, with `hnsw.ef_search` set per query via
  `SET LOCAL` to tune recall against latency.
- **Generated `tsvector` column** + **GIN index** for full-text search, parsed
  with `websearch_to_tsquery`.
- **Reciprocal Rank Fusion in pure SQL** — two CTEs (`vector_leg`,
  `keyword_leg`), each capped at 50 candidates, fused by
  `sum(1 / (60 + rank))` and re-sorted.
- **Metadata pre-filtering** — category and year filters are applied *inside*
  the search query, in both fusion legs, so they constrain the scan rather than
  filtering afterwards.
- **The query inspector** — every search returns the SQL it ran and its
  `EXPLAIN (ANALYZE, BUFFERS)` plan, surfaced in the UI.

---

## Architecture

```
  Browser ──▶ Next.js (App Router) on Vercel
                │
                ├─ POST /api/search { query, mode, filters }
                │     │
                │     ├─ lib/embed.ts   OpenAI text-embedding-3-small (1536-d)
                │     └─ lib/search.ts  build SQL · run · EXPLAIN · time it
                │
                └──────────────────────▶ Postgres + pgvector (Neon)
                   documents:  halfvec(1536) embedding  +  HNSW index
                               tsvector (generated)     +  GIN index
```

The corpus is 84 curated software-engineering documents (`lib/corpus.ts`);
`scripts/seed.ts` embeds them with OpenAI and loads them.

---

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Postgres + pgvector** (Neon) via `postgres.js` — hand-written SQL, no ORM
- **OpenAI** `text-embedding-3-small` for embeddings
- **Tailwind CSS v4** · **Vercel** hosting

---

## Project structure

```
sift/
├── lib/
│   ├── schema.sql    documents table — halfvec + HNSW + tsvector + GIN
│   ├── corpus.ts     the 84-document knowledge base
│   ├── embed.ts      OpenAI embeddings
│   ├── search.ts     the engine — vector / keyword / hybrid RRF + EXPLAIN
│   ├── repo.ts       corpus stats
│   ├── db.ts / types.ts
├── app/
│   ├── page.tsx              the shell
│   ├── search-console.tsx    the interactive search UI + query inspector
│   └── api/search/route.ts
└── scripts/
    ├── migrate.mjs   applies schema.sql
    └── seed.ts       embeds + loads the corpus
```

---

## Run it locally

Requires Node 20+, pnpm, a Postgres database with `pgvector`, and an
OpenAI API key.

```bash
pnpm install
cat > .env.local <<EOF
DATABASE_URL=postgres://…
OPENAI_API_KEY=sk-…
EOF

node --env-file=.env.local scripts/migrate.mjs   # create the table + indexes
node --env-file=.env.local scripts/seed.ts       # embed + load the corpus
pnpm dev
```

---

## Design notes

- **`EXPLAIN ANALYZE` runs the query a second time**, so it is timed and
  reported separately — `totalMs` reflects only the real search.
- **HNSW is approximate.** `ef_search` is the knob: higher means better recall
  and higher latency. Sift sets it with `SET LOCAL` so the choice is per query,
  not per connection.
- **RRF needs no score normalisation** — it fuses on rank position alone, which
  is exactly why it pairs cosine distance and `ts_rank` cleanly.

---

## License

MIT
