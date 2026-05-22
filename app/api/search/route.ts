import { NextResponse } from 'next/server';
import { search } from '@/lib/search';
import type { SearchMode } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MODES: SearchMode[] = ['vector', 'keyword', 'hybrid'];

// POST /api/search — run a query and return results + query transparency.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (!query) {
      return NextResponse.json({ error: 'Empty query' }, { status: 400 });
    }
    const mode: SearchMode = MODES.includes(body.mode) ? body.mode : 'hybrid';
    const result = await search(query, mode, {
      category: body.category || null,
      minYear: typeof body.minYear === 'number' ? body.minYear : null,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Search failed' },
      { status: 500 },
    );
  }
}
