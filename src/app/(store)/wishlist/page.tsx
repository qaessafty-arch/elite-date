import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGrid } from '@/components/store/ProductCard';
import { getCurrentUser } from '@/lib/auth';
import { getWishlistIds } from '@/lib/cart';
import { getProductsByIds } from '@/lib/catalog';

export const metadata: Metadata = { title: 'Wishlist', robots: { index: false } };

export default async function WishlistPage() {
  const [ids, user] = await Promise.all([getWishlistIds(), getCurrentUser()]);
  const products = await getProductsByIds(ids);
  return (
    <div className="shell pb-10 pt-8 md:pt-12">
      <h1 className="display display-lg">Wishlist</h1>
      {products.length === 0 ? (
        <div className="mt-6">
          <p className="lede">Nothing saved yet. Tap the heart on any piece to keep it here.</p>
          <Link href="/shop" className="btn btn-primary mt-6">
            Browse the shop
          </Link>
        </div>
      ) : (
        <>
          <p className="lede mt-3">
            {products.length} saved {products.length === 1 ? 'piece' : 'pieces'}.
            {!user && ' Sign in to keep this list on every device.'}
          </p>
          {!user && (
            <Link href="/account/login?next=/wishlist" className="link mt-2 inline-block font-medium">
              Sign in or create an account
            </Link>
          )}
          <div className="mt-10">
            <ProductGrid products={products} priorityCount={4} />
          </div>
        </>
      )}
    </div>
  );
}
