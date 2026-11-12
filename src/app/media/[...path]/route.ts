import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Serves admin-uploaded images from storage/uploads. Only names this app generated are accepted. */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const name = path.length === 1 ? path[0] : '';
  if (!/^[a-f0-9]{32}\.webp$/.test(name)) return new Response('Not found', { status: 404 });
  try {
    const file = await readFile(join(process.cwd(), 'storage', 'uploads', name));
    return new Response(new Uint8Array(file), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
