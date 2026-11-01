import { Help } from "./Help";
import { Icon, type IconName } from "./icons";

/** Kachel mit Symbol, kurzer Überschrift und „?“-Hilfe statt langer Texte. */
export function Panel({ icon, title, help, helpTitle, right, id, className, children }: {
  icon: IconName; title: React.ReactNode; help?: React.ReactNode; helpTitle?: string; right?: React.ReactNode;
  id?: string; className?: string; children?: React.ReactNode;
}) {
  return (
    <section id={id} className={`panel ${className ?? ""}`}>
      <div className="panel-head">
        <span className="panel-ico"><Icon name={icon} /></span>
        <h2>{title}</h2>
        <span className="panel-right">{right}{help && <Help title={helpTitle ?? String(title)}>{help}</Help>}</span>
      </div>
      {children}
    </section>
  );
}

/** Leerer Zustand: Symbol + ein kurzer Satz (+ Knopf) statt Text. */
export function Empty({ icon, text, action }: { icon: IconName; text: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-ico"><Icon name={icon} /></span>
      <p>{text}</p>
      {action}
    </div>
  );
}
