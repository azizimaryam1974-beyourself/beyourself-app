import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getBooking } from "@/lib/server/booking";
import { finalizePayment, testPaymentsEnabled } from "@/lib/server/payments/service";
import { formatPrice } from "@/lib/language-package";

export const dynamic = "force-dynamic";

/** Nur im Testmodus (PAYMENTS_TEST_MODE=1): simuliert die Bezahlseite. */
export default async function TestPayPage({ params }: { params: Promise<{ id: string }> }) {
  if (!testPaymentsEnabled()) notFound();
  const user = await requireUser();
  const { id } = await params;
  const b = getBooking(db(), id);
  if (!b || b.userId !== user.id || b.provider !== "test") notFound();

  async function pay() {
    "use server";
    if (!testPaymentsEnabled()) return;
    const u = await requireUser();
    const bk = getBooking(db(), id);
    if (!bk || bk.userId !== u.id || bk.provider !== "test") return;
    const r = await finalizePayment(bk.id, "test", `test-${Date.now()}`, bk.priceCents);
    redirect(`/termine?${r.ok ? "bezahlt=1" : "zahlung=problem"}`);
  }

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <div className="alert alert-error"><strong>Testmodus</strong> – hier fließt kein echtes Geld.</div>
      <h1>Test-Bezahlseite</h1>
      <p>{b.title} · {formatPrice(b.priceCents)}</p>
      <form action={pay}><button className="btn btn-gold" type="submit">Test-Zahlung ausführen</button></form>
      <p><a href="/termine?zahlung=abgebrochen">Abbrechen</a></p>
    </div>
  );
}
