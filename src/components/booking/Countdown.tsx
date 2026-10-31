"use client";

import { useEffect, useState } from "react";

/** Restzeit bis zur Zahlungsfrist, z. B. "24:13 Min". */
export function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <span className="countdown">…</span>;
  const left = Math.max(0, until - now);
  const m = Math.floor(left / 60_000), s = Math.floor((left % 60_000) / 1000);
  return (
    <span className={`countdown ${left < 5 * 60_000 ? "urgent" : ""}`} role="timer" aria-live="off">
      {left === 0 ? "abgelaufen" : `${m}:${String(s).padStart(2, "0")} Min`}
    </span>
  );
}
