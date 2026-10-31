import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { isBookable, listOffers } from "@/lib/server/booking";
import { formatPrice } from "@/lib/language-package";
import { AdminTabs } from "../AdminTabs";
import { OfferForm } from "./OfferForm";

export const metadata = { title: "Angebote & Preise" };
export const dynamic = "force-dynamic";

const GROUPS = [
  { kind: "slot", title: "Fahrstunden (mit Termin im Kalender)", hint: "Schüler fragen einen freien Termin an, du bestätigst, dann wird bezahlt." },
  { kind: "product", title: "Ohne Termin (Grundbetrag, Lernmaterial …)", hint: "Schüler kaufen direkt – oder nach deiner Bestätigung, wenn du das anhakst." },
  { kind: "language", title: "Sprachpaket", hint: "Wird bei der Anmeldung gewählt und kann online bezahlt werden." },
] as const;

export default async function OffersPage() {
  await requireTeacher();
  const offers = listOffers(db());
  return (
    <>
      <h1>Angebote & Preise</h1>
      <AdminTabs active="/verwaltung/angebote" />
      <p className="hint">Alles, was hier „online buchbar“ ist und einen Preis hat, sehen deine Schüler unter „Termine & Buchen“.</p>
      {GROUPS.map((g) => (
        <section key={g.kind} className="card">
          <h2>{g.title}</h2>
          <p className="hint">{g.hint}</p>
          <div className="offer-list">
            {offers.filter((o) => o.kind === g.kind).map((o) => (
              <details key={o.id} className="offer-item">
                <summary>
                  <span><strong>{o.title}</strong>{o.kind === "slot" && <span className="hint"> · {o.durationMin} Min</span>}</span>
                  <span className="row">
                    <span>{o.priceCents ? formatPrice(o.priceCents) : <span className="badge badge-warn">Preis fehlt</span>}</span>
                    {isBookable(o) ? <span className="badge badge-ok">buchbar</span> : <span className="badge badge-muted">nicht buchbar</span>}
                  </span>
                </summary>
                <OfferForm offer={{ ...o }} />
              </details>
            ))}
          </div>
        </section>
      ))}
      <section className="card">
        <h2>Neues Angebot</h2>
        <OfferForm offer={{ kind: "slot", title: "", description: "", durationMin: 45, priceCents: 0, needsApproval: true, active: true }} />
      </section>
    </>
  );
}
