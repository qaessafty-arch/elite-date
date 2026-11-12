import { getCurrentUser } from '@/lib/auth';
import { getCartView, getWishlistIds } from '@/lib/cart';
import { listCategories } from '@/lib/catalog';
import { getSettings } from '@/lib/settings';
import { AnnouncementBar } from '@/components/store/AnnouncementBar';
import { CartDrawer } from '@/components/store/CartDrawer';
import { Footer } from '@/components/store/Footer';
import { Header, type NavData } from '@/components/store/Header';
import { SearchOverlay } from '@/components/store/SearchOverlay';
import { StoreProvider } from '@/components/store/StoreProvider';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, user, cart, wishlist, categories] = await Promise.all([
    getSettings(),
    getCurrentUser(),
    getCartView(),
    getWishlistIds(),
    listCategories(),
  ]);

  const nav: NavData = {
    departments: categories.filter((c) => c.kind === 'department').map(({ slug, name }) => ({ slug, name })),
    types: categories.filter((c) => c.kind === 'type').map(({ slug, name }) => ({ slug, name })),
    collections: categories
      .filter((c) => c.kind === 'collection')
      .map(({ slug, name, description, imageUrl }) => ({ slug, name, description, imageUrl })),
  };

  return (
    <StoreProvider
      initialCart={cart}
      initialWishlist={wishlist}
      currency={settings.locale.currency}
      locale={settings.locale.locale}
      brandName={settings.brand.name}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:bg-ink focus:px-4 focus:py-2 focus:text-bone"
      >
        Skip to content
      </a>
      {settings.announcement.enabled && <AnnouncementBar messages={settings.announcement.messages} />}
      <Header nav={nav} signedIn={!!user} />
      <main id="main">{children}</main>
      <Footer settings={settings} />
      <CartDrawer />
      <SearchOverlay popular={nav.collections.slice(0, 4).map(({ slug, name }) => ({ slug, name }))} />
    </StoreProvider>
  );
}
