import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { currentPackage, listLessons } from "@/lib/server/repo";
import { listenerLanguage } from "@/lib/server/access";
import { speechConfigured } from "@/lib/server/live";
import { bookableLanguages, getLanguage } from "@/lib/languages";
import { formatPrice, LANGUAGE_PACKAGE_PRICE_CENTS } from "@/lib/language-package";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Alles, was die App für den Startbildschirm braucht. */
export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const pkg = currentPackage(db(), user.id);
  const code = listenerLanguage(user);
  const lang = code ? getLanguage(code)! : null;
  const lessons = listLessons(db(), 20).filter((l) => l.status !== "planned");
  return Response.json(
    {
      user: { name: user.name, email: user.email, role: user.role },
      package: pkg && pkg.status !== "cancelled"
        ? { status: pkg.status, language: pkg.language, price: formatPrice(pkg.priceCents) }
        : null,
      language: lang && { code: lang.code, labelDe: lang.labelDe, nativeLabel: lang.nativeLabel, rtl: lang.rtl, ttsVoice: lang.ttsVoice },
      canSpeak: speechConfigured() && !!lang,
      packagePrice: formatPrice(LANGUAGE_PACKAGE_PRICE_CENTS),
      bookableLanguages: bookableLanguages().map(({ code, labelDe, nativeLabel, rtl }) => ({ code, labelDe, nativeLabel, rtl })),
      lessons: lessons.map((l) => ({ id: l.id, title: l.title, status: l.status, startedAt: l.started_at ?? l.created_at })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
