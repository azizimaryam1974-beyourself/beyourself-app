/** Rundes Profilbild – ohne Foto die Anfangsbuchstaben. */
export function Avatar({ id, name, photoAt, size = 40, className }: { id: string; name: string; photoAt?: number | null; size?: number; className?: string }) {
  const initials = name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className={`avatar ${className ?? ""}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden>
      {photoAt
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={`/api/profilbild/${id}?v=${photoAt}`} alt="" loading="lazy" />
        : initials}
    </span>
  );
}
