import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { listTemplates } from "@/lib/server/booking";
import { PageHead } from "@/components/PageHead";
import { TemplateForm } from "../SettingsForms";

export const metadata = { title: "Nachrichten-Vorlagen" };
export const dynamic = "force-dynamic";

const KINDS = [
  { kind: "confirm", title: "Wenn du eine Anfrage bestätigst", hint: "Geht an Schüler, bei denen du jede Buchung selbst freigibst." },
  { kind: "decline", title: "Wenn du eine Anfrage ablehnst", hint: "Mit Grund, damit der Schüler weiß, was er tun soll." },
  { kind: "cancel", title: "Wenn du eine gebuchte Fahrt absagen musst", hint: "Zum Beispiel bei Krankheit oder wenn das Auto ausfällt." },
] as const;

export default async function TemplatesPage() {
  await requireTeacher();
  const d = db();
  return (
    <>
      <PageHead title="Nachrichten-Vorlagen" back={{ href: "/verwaltung/einstellungen", label: "Einstellungen" }}
        intro="Fertige Texte sparen dir Tipparbeit. Beim Senden kannst du jeden Text noch ändern oder ganz frei schreiben." />
      {KINDS.map((k) => (
        <section key={k.kind} className="card">
          <h2>{k.title}</h2>
          <p className="hint">{k.hint}</p>
          {listTemplates(d, k.kind).map((t) => <TemplateForm key={t.id} t={t} />)}
          <details className="add-more"><summary className="btn btn-secondary btn-small">+ Neue Vorlage</summary>
            <TemplateForm t={{ kind: k.kind, label: "", body: "" }} />
          </details>
        </section>
      ))}
    </>
  );
}
