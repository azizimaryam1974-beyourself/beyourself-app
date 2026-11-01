import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { currentPackage, listLessons } from "@/lib/server/repo";
import { bookableLanguages, getLanguage } from "@/lib/languages";
import { formatPrice, hasTranslationAccess, LANGUAGE_PACKAGE_PRICE_CENTS } from "@/lib/language-package";
import { BookLaterForm } from "./BookLaterForm";
import { orderProductAction } from "@/app/booking-actions";
import { getOffer, isBookable, listBookingsForUser } from "@/lib/server/booking";
import { fmtSlot } from "@/lib/time";
import { trainingWithBookings as trainingStateFor } from "@/lib/server/drive-booking";
import { ProgressView } from "@/components/training/ProgressView";
import { CLASS_LABEL } from "@/lib/training";
import { ensureGrundbetrag, EXAM_LABEL, listExams } from "@/lib/server/exams";
import { fmtDay, fmtTime } from "@/lib/time";

export const metadata = { title: "Mein Konto" };
export const dynamic = "force-dynamic";

const STATUS_TEXT = {
  booked: { label: "Gebucht – Zahlung offen", cls: "badge-warn" },
  paid: { label: "Bezahlt", cls: "badge-ok" },
  cancelled: { label: "Storniert", cls: "badge-muted" },
} as const;

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ gebucht?: string; willkommen?: string }> }) {
  const user = await requireUser();
  if (user.role === "teacher") redirect("/unterricht");
  const { gebucht, willkommen } = await searchParams;
  const grund = ensureGrundbetrag(db(), user.id);
  const invited = listExams(db(), user.id).filter((e) => e.status === "invited");
  const pkg = currentPackage(db(), user.id);
  const access = hasTranslationAccess(pkg);
  const lang = pkg ? getLanguage(pkg.language) : undefined;
  const lessons = listLessons(db(), 20).filter((l) => l.status !== "planned");
  const live = lessons.filter((l) => l.status === "live");
  const past = lessons.filter((l) => l.status === "ended").slice(0, 8);
  const price = formatPrice(LANGUAGE_PACKAGE_PRICE_CENTS);

  const training = trainingStateFor(db(), user.id);
  const langOffer = getOffer(db(), "sprachpaket");
  const canPayOnline = pkg?.status === "booked" && !!langOffer && isBookable(langOffer);
  const now = Date.now();
  const next = listBookingsForUser(db(), user.id)
    .filter((b) => b.status === "paid" && (b.startsAt ?? 0) > now)
    .sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0))[0];
  const languages = bookableLanguages().map(({ code, labelDe, nativeLabel, rtl }) => ({ code, labelDe, nativeLabel, rtl }));

  return (
    <>
      <h1>Hallo {user.name.split(" ")[0]}!</h1>
      {gebucht && (
        <div className="alert alert-ok">
          Dein Sprachpaket ist gebucht. Die Live-Übersetzung ist ab sofort freigeschaltet. Die {price} kannst du unten
          online bezahlen oder bar/EC in der Fahrschule.
        </div>
      )}

      {willkommen && <div className="alert alert-ok">Willkommen bei beyourself! Schön, dass du da bist.</div>}
      {invited.map((e) => (
        <div key={e.id} className="card card-accent">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h2 style={{ margin: 0 }}>Einladung: {EXAM_LABEL[e.type]}</h2>
              <p className="hint" style={{ margin: "6px 0 0" }}>{fmtDay(e.startsAt)} · {fmtTime(e.startsAt)} Uhr · {e.place} – bitte verbindlich bestätigen.</p>
            </div>
            <Link className="btn btn-gold" href="/termine#offen">Ansehen & bestätigen</Link>
          </div>
        </div>
      ))}
      {grund && grund.status === "awaiting_payment" && (
        <div className="card card-accent">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h2 style={{ margin: 0 }}>Grundbetrag: {formatPrice(grund.priceCents)}</h2>
              <p className="hint" style={{ margin: "6px 0 0" }}>Einmalig, inklusive Theorie-App, Theorieunterricht und Lernmaterial. Danach kannst du Fahrstunden buchen.
                Online bezahlen oder bar/EC in der Fahrschule.</p>
            </div>
            <Link className="btn btn-gold" href="/termine#offen">Jetzt bezahlen</Link>
          </div>
        </div>
      )}

      <section className="card">
        <h2>Dein Weg zum Führerschein</h2>
        {training ? <ProgressView state={training.state} classLabel={CLASS_LABEL[training.profile.licenseClass]} />
          : <p className="hint">Deine Fahrschule legt deine Führerscheinklasse fest – danach siehst du hier deinen Fortschritt.</p>}
      </section>

      <div className="card card-accent">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 style={{ margin: 0 }}>Fahrstunden & Termine</h2>
            <p className="hint" style={{ margin: "6px 0 0" }}>
              {next && next.startsAt && next.endsAt ? <>Nächster Termin: <strong>{next.title}</strong>, {fmtSlot(next.startsAt, next.endsAt)}</> : "Freie Termine ansehen, anfragen und online bezahlen."}
            </p>
          </div>
          <Link className="btn btn-gold" href="/termine">Termine & Buchen</Link>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Live-Unterricht</h2>
          {live.length > 0 && <span className="badge badge-live">LIVE</span>}
        </div>
        {live.length === 0 ? (
          <p className="hint" style={{ marginTop: 12 }}>Gerade läuft keine Theoriestunde. Diese Seite zeigt sie an, sobald sie beginnt.</p>
        ) : (
          <ul className="list">
            {live.map((l) => (
              <li key={l.id}>
                <span><span className="dot dot-live" /> {l.title}</span>
                <Link className="btn" href={`/live/${l.id}`}>{access ? `Mitlesen auf ${lang?.labelDe}` : "Mitlesen (Deutsch)"}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Sprachpaket</h2>
        {pkg && pkg.status !== "cancelled" ? (
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div lang={lang?.code} dir={lang?.rtl ? "rtl" : "ltr"} style={{ fontSize: "1.2rem", fontWeight: 700 }}>{lang?.nativeLabel}</div>
              <div className="hint">{lang?.labelDe} · {formatPrice(pkg.priceCents)}</div>
            </div>
            <div className="row">
              <span className={`badge ${STATUS_TEXT[pkg.status].cls}`}>{STATUS_TEXT[pkg.status].label}</span>
              {canPayOnline && (
                <form action={orderProductAction}>
                  <input type="hidden" name="offerId" value="sprachpaket" />
                  <button className="btn btn-small" type="submit">Jetzt online bezahlen</button>
                </form>
              )}
            </div>
          </div>
        ) : (
          <>
            {pkg?.status === "cancelled" && <div className="alert alert-info">Dein letztes Sprachpaket wurde storniert.</div>}
            <p>Noch kein Sprachpaket. Für {price} (einmalig, inkl. MwSt.) liest du jede Theoriestunde übersetzt mit.</p>
            <BookLaterForm languages={languages} price={price} />
          </>
        )}
      </div>

      {past.length > 0 && (
        <div className="card">
          <h2>Vergangene Stunden nachlesen</h2>
          <ul className="list">
            {past.map((l) => (
              <li key={l.id}>
                <span>{l.title} <span className="hint">· {new Date(l.started_at ?? l.created_at).toLocaleDateString("de-DE")}</span></span>
                <Link className="btn btn-secondary btn-small" href={`/live/${l.id}`}>Öffnen</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
