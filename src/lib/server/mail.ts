import nodemailer, { type Transporter } from "nodemailer";

/**
 * E-Mails über das IONOS-Postfach info@fahrschule-beyourself.de (SMTP).
 * Ohne SMTP-Zugang wird nur ins Server-Protokoll geschrieben – die Nachricht
 * steht trotzdem im Konto des Schülers.
 */
const g = globalThis as unknown as { __byMail?: Transporter | null };

function transporter(): Transporter | null {
  if (g.__byMail !== undefined) return g.__byMail;
  const host = process.env.SMTP_HOST, user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    g.__byMail = null;
    return null;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  g.__byMail = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  return g.__byMail;
}

export function mailEnabled(): boolean {
  return transporter() !== null;
}

/** Versendet im Hintergrund; ein Fehler beim Mailversand bricht nie die Buchung ab. */
export function sendMail(to: string, subject: string, text: string): void {
  const t = transporter();
  if (!t) {
    console.log(`[mail aus] an ${to.replace(/(.).+@/, "$1…@")}: ${subject}`);
    return;
  }
  const from = process.env.MAIL_FROM || `Fahrschule beyourself <${process.env.SMTP_USER}>`;
  t.sendMail({ from, to, subject, text }).catch((e: unknown) => console.error("[mail] Versand fehlgeschlagen:", (e as Error).message));
}
