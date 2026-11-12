import type { Metadata } from 'next';
import { BagPage } from '@/components/store/BagPage';

export const metadata: Metadata = { title: 'Your bag', robots: { index: false } };

export default function CartPage() {
  return <BagPage />;
}
