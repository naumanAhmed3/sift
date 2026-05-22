-- Sift schema — a hybrid retrieval store on pgvector.
-- Apply with: node --env-file=.env.local scripts/migrate.mjs

create extension if not exists vector;

create table if not exists documents (
  id         text primary key,
  title      text not null,
  content    text not null,
  category   text not null,
  tags       text[] not null default '{}',
  source     text not null default '',
  year       integer,

  -- 1536-d OpenAI embedding stored as halfvec: half-precision floats,
  -- so the vector column and its HNSW index take ~half the space of
  -- vector(1536) with negligible recall loss.
  embedding  halfvec(1536),

  -- Full-text search vector, kept in sync automatically as a stored
  -- generated column over the title and content.
  tsv        tsvector generated always as (
               to_tsvector(
                 'english',
                 coalesce(title, '') || ' ' || coalesce(content, '')
               )
             ) stored,

  created_at timestamptz not null default now()
);

-- HNSW index for approximate nearest-neighbour vector search (cosine).
-- m / ef_construction trade index build time and size against recall.
create index if not exists documents_embedding_idx
  on documents using hnsw (embedding halfvec_cosine_ops)
  with (m = 16, ef_construction = 64);

-- GIN index backing full-text search.
create index if not exists documents_tsv_idx
  on documents using gin (tsv);

-- Btree for the metadata pre-filter.
create index if not exists documents_category_idx
  on documents (category);
