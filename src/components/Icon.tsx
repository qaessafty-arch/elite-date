const PATHS = {
  search: <path d="M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Zm4.7-1.8L20 20" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c.8-3.6 3.8-5.6 7.5-5.6s6.700 2 7.500 5.600" />
    </>
  ),
  heart: <path d="M12 20s-7.500-4.500-7.500-10A4.300 4.300 0 0 1 12 7.400 4.300 4.300 0 0 1 19.500 10c0 5.500-7.500 10-7.500 10Z" />,
  bag: (
    <>
      <path d="M5 8h14l-1 12H6L5 8Z" />
      <path d="M9 8V6.500a3 3 0 0 1 6 0V8" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  check: <path d="m5 12.500 4.500 4.500L19 7.500" />,
  filter: <path d="M4 7h16M7 12h10M10 17h4" />,
  truck: (
    <>
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
      <circle cx="7.500" cy="17.500" r="1.600" />
      <circle cx="17.500" cy="17.500" r="1.600" />
    </>
  ),
  returns: <path d="M4 9h11a4.500 4.500 0 0 1 0 9H8M4 9l4-4M4 9l4 4" />,
  ruler: <path d="M3 16 16 3l5 5L8 21l-5-5Zm5-5 2 2m1-5 2 2m1-5 2 2" />,
  star: <path d="m12 4 2.400 5.200 5.600.600-4.200 3.800 1.200 5.600L12 16.400 7 19.200l1.200-5.600L4 9.800l5.600-.600L12 4Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="3.800" />
      <path d="M12 3v2.200M12 18.800V21M3 12h2.200M18.800 12H21M5.600 5.600l1.600 1.600M16.800 16.800l1.600 1.600M5.600 18.400l1.600-1.600M16.800 7.200l1.600-1.600" />
    </>
  ),
  moon: <path d="M19.500 14.500A8 8 0 0 1 9.500 4.500a8 8 0 1 0 10 10Z" />,
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />,
  zoom: <path d="M10.500 17a6.500 6.500 0 1 1 0-13 6.500 6.500 0 0 1 0 13Zm4.700-1.800L20 20M10.500 8v5M8 10.500h5" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 20,
  filled = false,
  className,
}: {
  name: IconName;
  size?: number;
  filled?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
