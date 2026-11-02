import { NextResponse } from "next/server";
import { appReturnUrl } from "@/lib/server/payments/service";

/** Bezahlung in der App abgebrochen → zurück in die App auf die gewünschte Seite. */
export function GET(req: Request) {
  const ziel = new URL(req.url).searchParams.get("ziel") ?? "/termine";
  return NextResponse.redirect(appReturnUrl(ziel.startsWith("/") ? ziel : "/termine"), 303);
}
