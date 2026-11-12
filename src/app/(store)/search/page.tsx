import type { Metadata } from 'next';
import Link from 'next/link';
import { Catalogue } from '@/components/store/Catalogue';
import type { RawParams } from '@/lib/catalog-params';

export const metadata: Metadata = { title: 'Search', robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 80) ?? '';
  if (!q) {
    return (
      <div className="shell py-20 text-center">
        <h1 className="display display-lg">Search the shop</h1>
        <p className="lede mx-auto mt-3">Type what you are looking for, such as “overcoat”, “denim” or “wool”.</p>
        <form action="/search" role="search" className="mx-auto mt-8 flex max-w-lg gap-2">
          <label htmlFor="search-page-q" className="sr-only">
            Search products
          </label>
          <input id="search-page-q" name="q" type="search" className="input" placeholder="Search coats, denim, hoodies" maxLength={80} required />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
        <p className="mt-6">
          <Link href="/shop" className="link">
            Or browse everything
          </Link>
        </p>
      </div>
    );
  }
  return (
    <Catalogue
      title={`Results for “${q}”`}
      searchParams={sp}
      basePath="/search"
      emptyHint="Check the spelling or try a broader word like “jacket”. Clearing filters keeps your search term."
    />
  );
}
