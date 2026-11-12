import Link from 'next/link';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="display display-md">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-mute">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, children, actions, className = '' }: { title?: string; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <section className={`border border-line bg-paper ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="font-semibold">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const TONES: Record<string, string> = {
  paid: 'bg-ok/15 text-ok', delivered: 'bg-ok/15 text-ok', published: 'bg-ok/15 text-ok', active: 'bg-ok/15 text-ok', succeeded: 'bg-ok/15 text-ok',
  cancelled: 'bg-danger/10 text-danger', failed: 'bg-danger/10 text-danger', suspended: 'bg-danger/10 text-danger', refunded: 'bg-danger/10 text-danger',
  pending: 'bg-brass/20 text-brass-deep', unpaid: 'bg-brass/20 text-brass-deep', partially_refunded: 'bg-brass/20 text-brass-deep',
};

export function Status({ value, label }: { value: string; label?: string }) {
  return <span className={`tag whitespace-nowrap ${TONES[value] ?? 'bg-sand'}`}>{label ?? value.replace(/_/g, ' ')}</span>;
}

export function Pager({ page, total, perPage, href }: { page: number; total: number; perPage: number; href: (page: number) => string }) {
  const pages = Math.max(Math.ceil(total / perPage), 1);
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-5 flex items-center justify-between gap-3 text-[0.9375rem]">
      <p className="text-mute">
        Page {page} of {pages}, {total} in total
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className="btn btn-secondary btn-sm">
            Previous
          </Link>
        )}
        {page < pages && (
          <Link href={href(page + 1)} className="btn btn-secondary btn-sm">
            Next
          </Link>
        )}
      </div>
    </nav>
  );
}

/** Wrapper that lets wide tables scroll inside their panel instead of the page. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="-mx-5 overflow-x-auto px-5">{children}</div>;
}

export const th = 'whitespace-nowrap border-b border-line-strong py-2 pr-4 text-left text-[0.8125rem] font-semibold text-mute';
export const td = 'border-b border-line py-3 pr-4 align-middle text-[0.9375rem]';
