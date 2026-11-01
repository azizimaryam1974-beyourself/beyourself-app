"use client";

import { useEffect } from "react";

/** Nach der Anmeldung landet man sonst unten auf der Seite (Formular war lang) – hier wieder nach oben. */
export function ScrollTop() {
  useEffect(() => { window.scrollTo(0, 0); requestAnimationFrame(() => window.scrollTo(0, 0)); }, []);
  return null;
}
