import { NextResponse, type NextRequest } from "next/server";

/** Gibt den aufgerufenen Pfad an den Server weiter (für das Protokoll: wer hat welche Seite geöffnet). */
export function middleware(req: NextRequest) {
  const h = new Headers(req.headers);
  h.set("x-by-path", `${req.nextUrl.pathname}${req.nextUrl.search}`.slice(0, 300));
  return NextResponse.next({ request: { headers: h } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|video/|favicon|icon|apple-icon|robots.txt|sitemap.xml|llms.txt|manifest).*)"],
};
