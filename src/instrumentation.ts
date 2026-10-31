/** Wird von Next.js einmal beim Serverstart aufgerufen. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startMaintenance } = await import("./lib/server/maintenance");
    startMaintenance();
  }
}
