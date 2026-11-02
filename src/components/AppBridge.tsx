"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage(msg: string): void };
    byPushToken?: (token: string, platform: string) => void;
  }
}

/**
 * Verbindung Webseite ↔ Handy-App. Nur aktiv, wenn die Seite in der beyourself-App läuft:
 * fragt die App nach dem Push-Kennzeichen und meldet es dem Server für den eingeloggten Nutzer.
 */
export function AppBridge({ userId }: { userId: string }) {
  useEffect(() => {
    const rn = window.ReactNativeWebView;
    if (!rn) return;
    window.byPushToken = (token, platform) => {
      void fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, platform }) });
    };
    rn.postMessage(JSON.stringify({ type: "push-request", userId }));
  }, [userId]);
  return null;
}
