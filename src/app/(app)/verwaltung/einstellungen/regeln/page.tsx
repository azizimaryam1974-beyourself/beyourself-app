import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getSettings } from "@/lib/server/booking";
import { mailEnabled } from "@/lib/server/mail";
import { testfahrtMinutes } from "@/lib/server/training-repo";
import { availableProviders } from "@/lib/server/payments/service";
import { PageHead } from "@/components/PageHead";
import { SettingsForm } from "../SettingsForms";
import { getBankDetails } from "@/lib/server/finance";
import { stripeTestMode } from "@/lib/server/payments/stripe";
import { saveBankAction } from "@/app/finance-actions";

export const metadata = { title: "Regeln & Verbindungen" };
export const dynamic = "force-dynamic";

export default async function RulesPage() {
  await requireTeacher();
  const d = db();
  const providers = availableProviders();
  const Status = ({ ok, on, off }: { ok: boolean; on: string; off: string }) => <span className={`badge ${ok ? "badge-ok" : "badge-muted"}`}>{ok ? on : off}</span>;
  return (
    <>
      <PageHead title="Regeln & Verbindungen" back={{ href: "/verwaltung/einstellungen", label: "Einstellungen" }}
        intro="Diese Regeln gelten für alle Schüler. Einzelne Schüler kannst du in ihrer Akte zusätzlich einschränken." />
      <section className="card">
        <h2>Regeln für Buchungen</h2>
        <SettingsForm s={getSettings(d)} testfahrtMinutes={testfahrtMinutes(d)} />
      </section>
      <section className="card">
        <h2>Bankverbindung für Vorauszahlungen</h2>
        <p className="hint">Schüler sehen diese Angaben bei „Guthaben aufladen“. Wenn Geld ankommt, trägst du es in der Schülerakte bei „Guthaben“ → „Einzahlung erhalten“ ein.</p>
        <form action={saveBankAction} className="akte-form" key={getBankDetails(d)}>
          <textarea name="bank" rows={4} maxLength={500} defaultValue={getBankDetails(d)} placeholder={"Kontoinhaber: Fahrschule beyourself\nIBAN: DE..\nBank: Kasseler Sparkasse"} aria-label="Bankverbindung" />
          <button className="btn btn-secondary btn-small" type="submit">Speichern</button>
        </form>
      </section>
      <section className="card">
        <h2>Verbindungen</h2>
        <ul className="list">
          <li><span>Zahlung mit Karte, Apple Pay, Google Pay (Stripe)</span><Status ok={providers.includes("stripe")} on={stripeTestMode() ? "verbunden – TESTMODUS (kein echtes Geld)" : "verbunden – echte Zahlungen"} off="noch nicht eingerichtet" /></li>
          <li><span>Stripe-Rückmeldung (Webhook)</span><Status ok={!!process.env.STRIPE_WEBHOOK_SECRET} on="eingerichtet" off="fehlt noch" /></li>
          <li><span>PayPal</span><Status ok={providers.includes("paypal")} on="verbunden" off="noch nicht eingerichtet" /></li>
          <li><span>E-Mails von info@fahrschule-beyourself.de</span><Status ok={mailEnabled()} on="aktiv" off="noch nicht eingerichtet" /></li>
        </ul>
        <p className="hint">Die Zugangsdaten stehen aus Sicherheitsgründen nur auf dem Server, nicht hier. Einrichten machen wir gemeinsam.</p>
      </section>
    </>
  );
}
