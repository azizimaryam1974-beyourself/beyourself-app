import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getOffer } from "@/lib/server/booking";
import { testfahrtMinutes } from "@/lib/server/training-repo";
import { setTestfahrtAction } from "@/app/price-actions";
import { CATALOG, PART_LABEL } from "@/lib/catalog";
import { formatPrice } from "@/lib/language-package";
import { priceCents, DEFAULT_PRICES } from "@/lib/training";
import { PageHead } from "@/components/PageHead";
import { PriceForm } from "./PriceForm";

export const metadata = { title: "Preise & Leistungen" };
export const dynamic = "force-dynamic";

export default async function PricesPage() {
  await requireTeacher();
  const d = db();
  const tf = testfahrtMinutes(d);
  return (
    <>
      <PageHead title="Preise & Leistungen" back={{ href: "/verwaltung/einstellungen", label: "Einstellungen" }}
        intro="Alle Preise inklusive Mehrwertsteuer. So sehen deine Schüler sie auch. Auf „Ändern“ tippen, um Preis oder Text anzupassen." />
      <div className="price-list">
        {CATALOG.map((c, idx) => {
          const prices = c.ids.map((id, i) => getOffer(d, id)?.priceCents ?? c.defaults.price[i]);
          const description = getOffer(d, c.ids[0])?.description || c.defaults.description;
          const total = prices.reduce((a, b) => a + b, 0);
          const isTest = c.ids[0] === "drive-testfahrt";
          const testPrice = isTest && tf === 45 ? (getOffer(d, "drive-uebung")?.priceCents ?? DEFAULT_PRICES.practice45) : prices[0];
          const perMin = c.ids[0] === "drive-uebung" || c.ids[0] === "drive-sonder";
          const kind = c.ids[0] === "drive-sonder" ? "ueberland" : "schalter";
          const cfg = { ...DEFAULT_PRICES, practice45: prices[0], special45: prices[0] };
          return (
            <section key={c.ids[0]} className="card price-card">
              <div className="price-top">
                <div>
                  <h2>{c.title}</h2>
                  <p className="hint">{c.who}</p>
                </div>
                <div className="price-big">
                  {formatPrice(isTest ? testPrice : total)}
                  <span>{isTest ? `${tf} Minuten` : c.unit}</span>
                </div>
              </div>

              {c.ids.length > 1 && (
                <div className="price-parts">
                  {prices.map((p, i) => <div key={i}><span>{PART_LABEL[i]}</span><strong>{formatPrice(p)}</strong></div>)}
                  <div className="sum"><span>Zusammen</span><strong>{formatPrice(total)}</strong></div>
                </div>
              )}
              {perMin && (
                <div className="price-parts">
                  {[60, 75, 90, ...(c.ids[0] === "drive-sonder" ? [135] : [])].map((m) => (
                    <div key={m}><span>{m} Min{m === 135 ? " (nur Beleuchtung)" : ""}</span><strong>{formatPrice(priceCents(kind, m, cfg))}</strong></div>
                  ))}
                </div>
              )}

              <h3 className="incl-head">Was ist enthalten</h3>
              <ul className="incl">{description.split("\n").filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}</ul>

              {isTest && (
                <form action={setTestfahrtAction} className="row test-len">
                  <span>Länge der Testfahrt:</span>
                  <button className={`chip ${tf === 30 ? "on" : ""}`} name="minutes" value="30" type="submit">30 Min · {formatPrice(prices[0])}</button>
                  <button className={`chip ${tf === 45 ? "on" : ""}`} name="minutes" value="45" type="submit">45 Min · Übungsfahrt-Preis</button>
                </form>
              )}

              <details className="edit-box">
                <summary className="btn btn-secondary btn-small">Ändern</summary>
                <PriceForm item={idx} parts={c.ids.length > 1 ? [...PART_LABEL] : [`Preis ${c.unit}`]} prices={prices} description={description} />
              </details>
            </section>
          );
        })}
      </div>
    </>
  );
}
