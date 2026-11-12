import { NextResponse } from 'next/server';
import { searchSuggestions } from '@/lib/catalog';
import { limitByIp } from '@/lib/rate-limit';

export async function GET(request: Request) {
  if (!(await limitByIp('search', 90))) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const q = new URL(request.url).searchParams.get('q') ?? '';
  return NextResponse.json(await searchSuggestions(q), { headers: { 'Cache-Control': 'private, max-age=30' } });
}
