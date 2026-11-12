import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="shell py-28 text-center">
      <h1 className="display display-lg">We could not find that page</h1>
      <p className="lede mx-auto mt-3">The link may be old, or the piece may have sold through. Try the shop or search.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/shop" className="btn btn-primary">
          Shop everything
        </Link>
        <Link href="/search" className="btn btn-secondary">
          Search
        </Link>
      </div>
    </div>
  );
}
