import type { Metadata } from 'next';
import { TrackForm } from '@/components/store/TrackForm';

export const metadata: Metadata = { title: 'Track an order', description: 'Check the status of your order with your order number and email.' };

export default function TrackPage() {
  return (
    <div className="shell max-w-4xl pb-10 pt-8 md:pt-12">
      <h1 className="display display-lg">Track an order</h1>
      <p className="lede mt-3">Enter the order number from your confirmation email and the email address you ordered with.</p>
      <div className="mt-8">
        <TrackForm />
      </div>
    </div>
  );
}
