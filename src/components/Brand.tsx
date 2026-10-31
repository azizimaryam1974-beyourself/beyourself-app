/** Wortmarke "beyourself" mit goldener Weg-Linie. */
export function Brand({ sub = true, id = "b" }: { sub?: boolean; id?: string }) {
  return (
    <span className="brand" aria-label="beyourself Fahrschule">
      <span className="brand-word" aria-hidden>beyourself</span>
      <svg className="brand-road" viewBox="0 0 160 8" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={`brand-g-${id}`} x1="0" x2="1">
            <stop offset="0" stopColor="#b98f4a" />
            <stop offset="0.5" stopColor="#ecd6a3" />
            <stop offset="1" stopColor="#5f9ea0" />
          </linearGradient>
        </defs>
        <path d="M1 6 C 40 6, 55 2, 80 2 S 125 6, 159 3" fill="none" stroke={`url(#brand-g-${id})`} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {sub && <small aria-hidden>Fahrschule</small>}
    </span>
  );
}
