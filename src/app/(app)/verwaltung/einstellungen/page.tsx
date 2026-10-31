import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getSettings, listTemplates } from "@/lib/server/booking";
import { mailEnabled } from "@/lib/server/mail";
import { testfahrtMinutes } from "@/lib/server/training-repo";
import { availableProviders } from "@/lib/server/payments/service";
import { AdminTabs } from "../AdminTabs";
import { SettingsForm, TemplateForm } from "./SettingsForms";

export const metadata = { title: "Vorlagen & Regeln" };
export const dynamic = "force-dynamic";

const KINDS = [
  { kind: "confirm", title: "Bestätigung", hint: "Wird mitgeschickt, wenn du eine Anfrage bestätigst." },
  { kind: "decline", title: "Ablehnung", hint: "Die erste Vorlage wird auch automatisch an andere Schüler geschickt, wenn du denselben Termin jemand anderem gibst." },
  { kind: "cancel", title: "Absage eines gebuchten Termins", hint: "Wenn du einen festen Termin absagen musst." },
] as const;

export default async function SettingsPage() {
  await requireTeacher();
  const d = db();
  const providers = availableProviders();
  return (
    <>
      <h1>Vorlagen & Regeln</h1>
      <AdminTabs active="/verwaltung/einstellungen" />

      <section className="card">
        <h2>Regeln für Buchungen</h2>
        <SettingsForm s={getSettings(d)} testfahrtMinutes={testfahrtMinutes(d)} />
      </section>

      <section className="card">
        <h2>Verbindungen</h2>
        <ul className="list">
          <li><span>Zahlung mit Karte / Apple Pay / Google Pay (Stripe)</span>{providers.includes("stripe") ? <span className="badge badge-ok">verbunden</span> : <span className="badge badge-muted">nicht eingerichtet</span>}</li>
          <li><span>PayPal</span>{providers.includes("paypal") ? <span className="badge badge-ok">verbunden</span> : <span className="badge badge-muted">nicht eingerichtet</span>}</li>
          <li><span>E-Mails von info@fahrschule-beyourself.de</span>{mailEnabled() ? <span className="badge badge-ok">aktiv</span> : <span className="badge badge-muted">nicht eingerichtet – Nachrichten nur im Konto</span>}</li>
        </ul>
        <p className="hint">Die Zugangsdaten stehen aus Sicherheitsgründen nur in der Server-Datei .env, nicht hier.</p>
      </section>

      {KINDS.map((k) => (
        <section key={k.kind} className="card">
          <h2>Textvorlagen: {k.title}</h2>
          <p className="hint">{k.hint} Du kannst jeden Text vor dem Senden noch ändern oder ganz eigenen Text schreiben.</p>
          {listTemplates(d, k.kind).map((t) => <TemplateForm key={t.id} t={t} />)}
          <TemplateForm t={{ kind: k.kind, label: "", body: "" }} />
        </section>
      ))}
    </>
  );
}
