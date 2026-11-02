/** Wird von Next.js einmal beim Serverstart aufgerufen. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startMaintenance } = await import("./lib/server/maintenance");
    startMaintenance();
  }
}

/** Jeder Serverfehler landet im Protokoll (mit Seite/Aktion, ohne Geheimnisse). */
export async function onRequestError(err: unknown, request: { path: string; method: string; headers: Record<string, string | string[] | undefined> }, context: { routerKind: string; routePath: string; routeType: string }) {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logRequestError } = await import("./lib/server/audit-error");
    logRequestError(err, request, context);
  }
}
