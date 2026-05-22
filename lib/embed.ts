import OpenAI from 'openai';

// ─────────────────────────────────────────────────────────────
// Embeddings via OpenAI text-embedding-3-small (1536 dimensions).
// ─────────────────────────────────────────────────────────────

export const EMBED_MODEL = 'text-embedding-3-small';
export const EMBED_DIM = 1536;

let _client: OpenAI | null = null;

function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

/** Embed a single piece of text. */
export async function embed(text: string): Promise<number[]> {
  const res = await client().embeddings.create({
    model: EMBED_MODEL,
    input: text,
  });
  return res.data[0].embedding;
}

/** Embed many texts in one request. */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await client().embeddings.create({
    model: EMBED_MODEL,
    input: texts,
  });
  return res.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/** Format a vector for a Postgres `halfvec` / `vector` literal. */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}
