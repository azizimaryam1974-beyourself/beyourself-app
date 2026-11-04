/** WhatsApp-Link aus einer deutschen Telefonnummer (0176… → 49176…). */
export function waLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = `49${d.slice(1)}`;
  return d.length >= 8 ? `https://wa.me/${d}` : null;
}
export const telLink = (phone: string | null | undefined) => (phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null);
