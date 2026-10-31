import Link from "next/link";

/** Einheitlicher Seitenkopf: optional Zurück-Link, eine Überschrift, ein erklärender Satz. */
export function PageHead({ title, intro, back, action }: { title: string; intro?: string; back?: { href: string; label: string }; action?: React.ReactNode }) {
  return (
    <div className="page-head">
      {back && <Link className="back-link" href={back.href}>← {back.label}</Link>}
      <div className="page-head-row">
        <h1>{title}</h1>
        {action}
      </div>
      {intro && <p className="page-intro">{intro}</p>}
    </div>
  );
}
