/** Einheitliche Linien-Symbole (24×24) für Kacheln, Leere Zustände usw. */
export type IconName = "road" | "car" | "cal" | "clock" | "wait" | "coin" | "chat" | "live" | "book" | "bell" | "pay" | "check" | "flag" | "lang" | "history" | "plus" | "star" | "id" | "help" | "receipt";

const P: Record<IconName, React.ReactNode> = {
  road: <path d="M8 21 10 3M16 21 14 3M12 6v2M12 11v2M12 16v2" />,
  car: <><path d="M5 16h14l-1.5-5.2A2 2 0 0 0 15.6 9H8.4a2 2 0 0 0-1.9 1.8Z" /><path d="M5 16v3h2.5v-2M19 16v3h-2.5v-2" /><circle cx="8" cy="13.5" r="0.6" /><circle cx="16" cy="13.5" r="0.6" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  wait: <><path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9" /></>,
  coin: <><ellipse cx="12" cy="7" rx="7" ry="3" /><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" /></>,
  chat: <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1Z" />,
  live: <><rect x="3" y="6" width="13" height="12" rx="3" /><path d="m16 10 5-3v10l-5-3" /></>,
  book: <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Zm0 0v16M8 7h7" />,
  bell: <path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4ZM10 20a2 2 0 0 0 4 0" />,
  pay: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  lang: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9Z" />,
  id: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M6 16c.6-1.5 1.8-2 3-2s2.4.5 3 2M14 10h4M14 13h3" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 17h.01" /></>,
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2ZM9 8h6M9 12h6M9 16h3" />,
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return <svg viewBox="0 0 24 24" className={`ico ${className ?? ""}`} aria-hidden>{P[name]}</svg>;
}
