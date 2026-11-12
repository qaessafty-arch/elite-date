'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { CartView } from '@/lib/cart';
import { formatMoney } from '@/lib/money';
import { toggleWishlistAction } from '@/app/actions/cart';

type Toast = { id: number; message: string; tone: 'info' | 'error' };

type StoreContext = {
  cart: CartView;
  setCart: (cart: CartView) => void;
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  wishlist: ReadonlySet<string>;
  toggleWishlist: (productId: string, name: string) => void;
  money: (cents: number) => string;
  notify: (message: string, tone?: Toast['tone']) => void;
  brandName: string;
};

const Ctx = createContext<StoreContext | null>(null);

export function useStore(): StoreContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

export function StoreProvider({
  initialCart,
  initialWishlist,
  currency,
  locale,
  brandName,
  children,
}: {
  initialCart: CartView;
  initialWishlist: string[];
  currency: string;
  locale: string;
  brandName: string;
  children: React.ReactNode;
}) {
  const [cart, setCart] = useState(initialCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [wishlist, setWishlist] = useState(() => new Set(initialWishlist));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [, startTransition] = useTransition();
  const nextId = useRef(1);

  // Server-rendered cart wins after navigation (e.g. after checkout empties the bag).
  useEffect(() => setCart(initialCart), [initialCart]);

  const notify = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const toggleWishlist = useCallback(
    (productId: string, name: string) => {
      const wasSaved = wishlist.has(productId);
      setWishlist((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(productId);
        else next.add(productId);
        return next;
      });
      startTransition(async () => {
        const res = await toggleWishlistAction(productId);
        if (!res.ok) {
          setWishlist((prev) => {
            const next = new Set(prev);
            if (wasSaved) next.add(productId);
            else next.delete(productId);
            return next;
          });
          notify(res.error, 'error');
        } else {
          notify(res.saved ? `${name} saved to your wishlist` : `${name} removed from your wishlist`);
        }
      });
    },
    [wishlist, notify],
  );

  const value = useMemo<StoreContext>(
    () => ({
      cart,
      setCart,
      cartOpen,
      openCart: () => setCartOpen(true),
      closeCart: () => setCartOpen(false),
      searchOpen,
      setSearchOpen,
      wishlist,
      toggleWishlist,
      money: (cents: number) => formatMoney(cents, currency, locale),
      notify,
      brandName,
    }),
    [cart, cartOpen, searchOpen, wishlist, toggleWishlist, currency, locale, notify, brandName],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`ticker-in pointer-events-auto max-w-md rounded-[2px] px-4 py-3 text-sm font-medium shadow-lg ${
              t.tone === 'error' ? 'bg-danger text-white' : 'bg-ink text-bone'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
