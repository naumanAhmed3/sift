// Embeds the corpus with OpenAI and loads it into Postgres.
// Run: node --env-file=.env.local scripts/seed.ts
import postgres from 'postgres';
import OpenAI from 'openai';
import { corpus } from '../lib/corpus.ts';

const url = process.env.DATABASE_URL;
const apiKey = process.env.OPENAI_API_KEY;
if (!url || !apiKey) {
  console.error('DATABASE_URL and OPENAI_API_KEY must both be set');
  process.exit(1);
}

const sql = postgres(url, { ssl: 'require' });
const openai = new OpenAI({ apiKey });
const docs = corpus();

console.log(`embedding ${docs.length} documents…`);
const inputs = docs.map((d) => `${d.title}\n\n${d.content}`);
const res = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: inputs,
});
const embeddings = res.data
  .sort((a, b) => a.index - b.index)
  .map((d) => d.embedding);

console.log('loading into Postgres…');
await sql`truncate documents`;
for (let i = 0; i < docs.length; i++) {
  const d = docs[i];
  const vec = `[${embeddings[i].join(',')}]`;
  await sql`
    insert into documents (id, title, content, category, tags, source, year, embedding)
    values (${d.id}, ${d.title}, ${d.content}, ${d.category}, ${d.tags},
            ${d.source}, ${d.year}, ${vec}::halfvec)`;
}

console.log(`✓ seeded ${docs.length} documents`);
await sql.end();
