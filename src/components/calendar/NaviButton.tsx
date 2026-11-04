"use client";

import { useState } from "react";

/** „Navi“: Auswahl Google Maps, Waze oder Apple Karten – öffnet direkt die Navigation zur Adresse. */
export function NaviButton({ address, label = "📍 Navi", className = "cal-act" }: { address: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const q = encodeURIComponent(address);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{label}</button>
      {open && (
        <div className="navi-sheet-bg" onClick={() => setOpen(false)}>
          <div className="navi-sheet" role="dialog" aria-label="Navigation starten" onClick={(e) => e.stopPropagation()}>
            <p>Navigation zu <strong>{address}</strong> starten mit …</p>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${q}`} target="_blank" rel="noreferrer">🗺️ Google Maps</a>
            <a href={`https://waze.com/ul?q=${q}&navigate=yes`} target="_blank" rel="noreferrer">🚙 Waze</a>
            <a href={`https://maps.apple.com/?daddr=${q}`} target="_blank" rel="noreferrer">🍎 Apple Karten</a>
            <button type="button" className="navi-cancel" onClick={() => setOpen(false)}>Abbrechen</button>
          </div>
        </div>
      )}
    </>
  );
}
