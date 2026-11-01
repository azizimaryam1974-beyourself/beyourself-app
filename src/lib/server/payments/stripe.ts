import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stripe über die REST-Schnittstelle (ohne SDK). Bezahlseite = Stripe Checkout,
 * dort zahlt der Schüler mit Karte, Apple Pay, Google Pay (und was im Stripe-Konto
 * freigeschaltet ist, z. B. Klarna).
 */
const API = "https://api.stripe.com/v1";

export function stripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/** Testschlüssel (sk_test_…): Zahlungen nur mit Testkarten, kein echtes Geld. */
export function stripeTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
}

interface Params { [k: string]: string | number | boolean | undefined | Params | Array<string | Params> }

/** {a:{b:1}, c:["x"]} → a[b]=1&c[0]=x (Stripe-Format) */
export function formEncode(p: Params, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" ? formEncode(item, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === "object") formEncode(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

async function call<T>(method: "GET" | "POST", path: string, params?: Params, idempotencyKey?: string): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` };
  let body: string | undefined;
  if (params && method === "POST") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = formEncode(params).toString();
  }
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${API}${path}`, { method, headers, body, cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${json.error?.message ?? "Fehler"}`);
  return json;
}

export interface CheckoutSession {
  id: string; url: string | null; status: "open" | "complete" | "expired"; payment_status: "paid" | "unpaid" | "no_payment_required";
  amount_total: number | null; currency: string | null; client_reference_id: string | null; payment_intent: string | null;
}

export async function createCheckout(o: {
  bookingId: string; title: string; description: string; amountCents: number; email: string; expiresAt: number; baseUrl: string;
}): Promise<CheckoutSession> {
  // Stripe erlaubt 30 Min bis 24 Std Gültigkeit.
  const min = Date.now() + 31 * 60_000;
  const max = Date.now() + 23.5 * 3_600_000; // lange Fristen (Grundbetrag, Prüfung): Bezahlseite gilt max. 24 Std., danach neu
  const expires = Math.floor(Math.min(Math.max(o.expiresAt, min), max) / 1000);
  const methods = (process.env.STRIPE_METHODS || "card").split(",").map((s) => s.trim()).filter(Boolean);
  return call<CheckoutSession>("POST", "/checkout/sessions", {
    mode: "payment",
    client_reference_id: o.bookingId,
    customer_email: o.email,
    locale: "de",
    expires_at: expires,
    payment_method_types: methods,
    line_items: [{ quantity: "1", price_data: { currency: "eur", unit_amount: String(o.amountCents), product_data: { name: o.title, description: o.description || undefined } } } as Params],
    metadata: { booking: o.bookingId },
    payment_intent_data: { metadata: { booking: o.bookingId }, description: `${o.title} (${o.bookingId.slice(0, 8)})` },
    success_url: `${o.baseUrl}/api/zahlung/stripe/zurueck?b=${o.bookingId}&s={CHECKOUT_SESSION_ID}`,
    cancel_url: `${o.baseUrl}/termine?zahlung=abgebrochen`,
  }, `checkout-${o.bookingId}-${expires}`);
}

export const getCheckout = (id: string) => call<CheckoutSession>("GET", `/checkout/sessions/${encodeURIComponent(id)}`);

export async function expireCheckout(id: string): Promise<void> {
  try { await call("POST", `/checkout/sessions/${encodeURIComponent(id)}/expire`, {}); } catch { /* schon abgelaufen/bezahlt */ }
}

export async function refund(paymentIntent: string, amountCents: number, key: string): Promise<void> {
  await call("POST", "/refunds", { payment_intent: paymentIntent, amount: String(amountCents), reason: "requested_by_customer" }, `refund-${key}`);
}

/** Prüft die Signatur eines Stripe-Webhooks (Header "Stripe-Signature"). */
export function verifyWebhook(payload: string, header: string | null, secret: string, toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !sigs.length || Math.abs(nowSec - Number(t)) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest();
  return sigs.some((s) => {
    const got = Buffer.from(s, "hex");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}
