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
import { Journey, type Milestone } from "@/components/training/Journey";
import { Empty, Panel } from "@/components/ui/Panel";
import { Icon } from "@/components/ui/icons";
import { grundbetragPaid } from "@/lib/server/training-repo";
import { creditBalance } from "@/lib/server/credit";
import { unreadForStudent } from "@/lib/server/chat";
import { upcomingLessons } from "@/lib/server/theory";
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
  if (user.role === "teacher") redirect("/verwaltung/uebersicht");
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
  const grundOk = grundbetragPaid(db(), user.id);
  const credit = creditBalance(db(), user.id);
  const unread = unreadForStudent(db(), user.id);
  const nextTheory = upcomingLessons(db(), now, now + 21 * 86_400_000)[0];
  // Der Weg: Anmeldung → Klasse → Grundbetrag → Ausbildungsphasen → Führerschein
  const steps: Milestone[] = [{ title: "Angemeldet", status: "done" }];
  steps.push({ title: "Klasse", sub: training ? CLASS_LABEL[training.profile.licenseClass] : "legt die Fahrschule fest", status: training ? "done" : "active" });
  steps.push({ title: "Grundbetrag", status: grundOk ? "done" : training ? "active" : "locked" });
  if (training) {
    for (const ph of training.state.phases) steps.push({ title: ph.title, status: !grundOk && ph.status === "active" ? "locked" : ph.status });
  } else {
    for (const t of ["Fahrstunden", "Sonderfahrten", "Prüfung"]) steps.push({ title: t, status: "locked" });
  }
  steps.push({ title: "Führerschein", status: training?.profile.passedAt ? "done" : "locked", final: true });
  if (!steps.some((x) => x.status === "active")) { const f = steps.find((x) => x.status === "locked"); if (f) f.status = "active"; }
  const percent = training ? training.state.percent : 5;
  const nextStep = !training
    ? { icon: "wait" as const, title: "Deine Klasse wird festgelegt", text: "Die Fahrschule erledigt das – du bekommst eine Nachricht.", href: "/nachrichten", cta: "Frage stellen" }
    : grund && grund.status === "awaiting_payment"
      ? { icon: "pay" as const, title: `Grundbetrag: ${formatPrice(grund.priceCents)}`, text: "Danach kannst du Fahrstunden buchen.", href: "/termine#offen", cta: "Jetzt bezahlen" }
      : invited.length
        ? { icon: "flag" as const, title: `Einladung: ${EXAM_LABEL[invited[0].type]}`, text: `${fmtDay(invited[0].startsAt)} · ${fmtTime(invited[0].startsAt)} Uhr`, href: "/termine#offen", cta: "Bestätigen" }
        : training.state.bookable.length
          ? { icon: "car" as const, title: training.state.next, text: "Such dir einen freien Termin aus.", href: "/termine#buchen", cta: "Fahrt buchen" }
          : { icon: "road" as const, title: training.state.next, text: "", href: "/termine", cta: "Meine Termine" };
  const languages = bookableLanguages().map(({ code, labelDe, nativeLabel, rtl }) => ({ code, labelDe, nativeLabel, rtl }));

  return (
    <>
      <h1>Hallo {user.name.split(" ")[0]}!</h1>
      {gebucht && <div className="alert alert-ok">Sprachpaket gebucht – die Übersetzung ist freigeschaltet.</div>}
      {willkommen && <div className="alert alert-ok">Willkommen bei beyourself! Schön, dass du da bist.</div>}

      <Panel icon="road" title="Dein Weg zum Führerschein" className="panel-dark"
        help={<>
          <p>Hier siehst du auf einen Blick, wo du gerade stehst. Das Auto zeigt deine aktuelle Station, Gold mit Haken heißt erledigt.</p>
          <p>Der Weg ist für jede Klasse etwas anders (z. B. B197 mit Automatik- und Schaltstunden). Wie viele Übungsstunden du brauchst, legt deine Fahrlehrerin fest.</p>
          <p>Unten bei „Details“ siehst du jede Stunde einzeln: gefahren = gold, gebucht = gestreift, offen = leer. 1 Kästchen = 45 Minuten.</p>
        </>}>
        <Journey steps={steps} percent={percent} />
        {training && (
          <details className="journey-details">
            <summary>Details ansehen</summary>
            <ProgressView state={training.state} classLabel={CLASS_LABEL[training.profile.licenseClass]} />
          </details>
        )}
      </Panel>

      <Link href={nextStep.href} className="next-card">
        <span className="next-ico"><Icon name={nextStep.icon} /></span>
        <span className="next-text"><small>Dein nächster Schritt</small><strong>{nextStep.title}</strong>{nextStep.text && <span>{nextStep.text}</span>}</span>
        <span className="next-cta">{nextStep.cta} →</span>
      </Link>

      <div className="quick-grid">
        <Link href="/termine" className="quick">
          <span className="quick-ico"><Icon name="cal" /></span>
          <strong>Fahrstunden</strong>
          <span>{next && next.startsAt ? `${fmtDay(next.startsAt).split(",")[0]}, ${fmtTime(next.startsAt)}` : "kein Termin"}</span>
        </Link>
        <Link href={live[0] ? `/live/${live[0].id}` : "/theorie"} className={`quick ${live[0] ? "live" : ""}`}>
          <span className="quick-ico"><Icon name="live" /></span>
          <strong>Theorie</strong>
          <span>{live[0] ? "● läuft jetzt" : nextTheory?.scheduled_at ? `${fmtDay(nextTheory.scheduled_at).split(",")[0]}, ${fmtTime(nextTheory.scheduled_at)}` : "kein Termin"}</span>
        </Link>
        <Link href="/nachrichten" className="quick">
          <span className="quick-ico"><Icon name="chat" />{unread > 0 && <i className="quick-dot">{unread}</i>}</span>
          <strong>Chat</strong>
          <span>{unread > 0 ? `${unread} neu` : "Fahrschule schreiben"}</span>
        </Link>
        <Link href="/termine#guthaben" className="quick">
          <span className="quick-ico"><Icon name="coin" /></span>
          <strong>Guthaben</strong>
          <span>{formatPrice(credit)}</span>
        </Link>
      </div>

      <Panel icon="lang" title="Sprachpaket" help={<p>Mit dem Sprachpaket liest du jede Theoriestunde live übersetzt auf deinem Handy mit – oder hörst sie über Kopfhörer. Einmalig {price} für die ganze Ausbildung.</p>}>
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
            <p className="hint" style={{ marginTop: 0 }}>Theorie in deiner Sprache mitlesen – einmalig {price}.</p>
            <details className="book-later">
              <summary className="btn btn-secondary btn-small">Sprache wählen & buchen</summary>
              <BookLaterForm languages={languages} price={price} />
            </details>
          </>
        )}
      </Panel>

      {past.length > 0 && (
        <details className="panel">
          <summary className="panel-head"><span className="panel-ico"><Icon name="history" /></span><h2>Vergangene Stunden nachlesen</h2></summary>
          <ul className="list">
            {past.map((l) => (
              <li key={l.id}>
                <span>{l.title} <span className="hint">· {new Date(l.started_at ?? l.created_at).toLocaleDateString("de-DE")}</span></span>
                <Link className="btn btn-secondary btn-small" href={`/live/${l.id}`}>Öffnen</Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
