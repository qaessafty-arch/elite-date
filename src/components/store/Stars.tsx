export function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  const pct = Math.max(0, Math.min(rating / 5, 1)) * 100;
  const star = 'm12 3 2.7 5.9 6.3.7-4.7 4.3 1.3 6.3L12 17l-5.600 3.200 1.300-6.300L3 9.600l6.300-.700L12 3Z';
  const row = (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
          <path d={star} fill="currentColor" />
        </svg>
      ))}
    </>
  );
  return (
    <span className="relative inline-flex" role="img" aria-label={`Rated ${rating.toFixed(1)} out of 5`}>
      <span className="flex text-line-strong">{row}</span>
      <span className="absolute inset-y-0 left-0 flex overflow-hidden text-brass" style={{ width: `${pct}%` }}>
        {row}
      </span>
    </span>
  );
}
