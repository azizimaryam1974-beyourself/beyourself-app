import Link from "next/link";
export default function NotFound() {
  return (
    <div className="card">
      <h1>Nicht gefunden</h1>
      <p>Diese Seite gibt es nicht (mehr).</p>
      <Link className="btn" href="/">Zur Startseite</Link>
    </div>
  );
}
