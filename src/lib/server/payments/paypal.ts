/**
 * PayPal über die REST-Schnittstelle (Orders v2). Der Schüler wird zu PayPal
 * geschickt, bestätigt dort, kommt zurück – dann wird die Zahlung eingezogen ("capture").
 */
export function paypalEnabled(): boolean {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_SECRET);
}

const base = () => (process.env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");

const g = globalThis as unknown as { __byPaypalToken?: { token: string; until: number } };

async function token(): Promise<string> {
  if (g.__byPaypalToken && g.__byPaypalToken.until > Date.now() + 60_000) return g.__byPaypalToken.token;
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64");
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST", cache: "no-store",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!res.ok || !json.access_token) throw new Error(`PayPal Anmeldung fehlgeschlagen (${res.status})`);
  g.__byPaypalToken = { token: json.access_token, until: Date.now() + (json.expires_in ?? 300) * 1000 };
  return json.access_token;
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown, requestId?: string): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" };
  if (requestId) headers["PayPal-Request-Id"] = requestId;
  const res = await fetch(`${base()}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as T & { message?: string; name?: string };
  if (!res.ok) throw new Error(`PayPal ${res.status}: ${json.name ?? ""} ${json.message ?? ""}`.trim());
  return json;
}

export const euro = (cents: number) => (cents / 100).toFixed(2);

interface Link { href: string; rel: string }
export interface PaypalOrder {
  id: string; status: string; links?: Link[];
  purchase_units?: Array<{
    reference_id?: string; custom_id?: string;
    payments?: { captures?: Array<{ id: string; status: string; amount: { value: string; currency_code: string } }> };
  }>;
}

export async function createOrder(o: { bookingId: string; title: string; amountCents: number; baseUrl: string }): Promise<{ id: string; approveUrl: string }> {
  const order = await call<PaypalOrder>("POST", "/v2/checkout/orders", {
    intent: "CAPTURE",
    purchase_units: [{
      reference_id: o.bookingId, custom_id: o.bookingId, description: o.title.slice(0, 120),
      amount: { currency_code: "EUR", value: euro(o.amountCents) },
    }],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "Fahrschule beyourself", locale: "de-DE", landing_page: "LOGIN",
          shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW",
          return_url: `${o.baseUrl}/api/zahlung/paypal/zurueck?b=${o.bookingId}`,
          cancel_url: `${o.baseUrl}/termine?zahlung=abgebrochen`,
        },
      },
    },
  }, `order-${o.bookingId}-${Date.now()}`);
  const approve = order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  if (!approve) throw new Error("PayPal hat keinen Bezahl-Link geliefert");
  return { id: order.id, approveUrl: approve };
}

export const getOrder = (id: string) => call<PaypalOrder>("GET", `/v2/checkout/orders/${encodeURIComponent(id)}`);

/** Zahlung einziehen. Gibt Capture-ID und Betrag (Cent) zurück. */
export async function captureOrder(id: string): Promise<{ captureId: string; amountCents: number; bookingId: string | null }> {
  let order: PaypalOrder;
  try {
    order = await call<PaypalOrder>("POST", `/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {}, `capture-${id}`);
  } catch (e) {
    // Schon eingezogen (z. B. Seite neu geladen) → Status abfragen.
    if (!String((e as Error).message).includes("ORDER_ALREADY_CAPTURED") && !String((e as Error).message).includes("422")) throw e;
    order = await getOrder(id);
  }
  const unit = order.purchase_units?.[0];
  const cap = unit?.payments?.captures?.[0];
  if (!cap || cap.status !== "COMPLETED" || cap.amount.currency_code !== "EUR") throw new Error(`PayPal-Zahlung nicht abgeschlossen (${cap?.status ?? order.status})`);
  return { captureId: cap.id, amountCents: Math.round(Number(cap.amount.value) * 100), bookingId: unit?.custom_id ?? unit?.reference_id ?? null };
}

export async function refundCapture(captureId: string, amountCents: number, key: string): Promise<void> {
  await call("POST", `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
    { amount: { value: euro(amountCents), currency_code: "EUR" } }, `refund-${key}`);
}
