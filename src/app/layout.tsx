import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bodoni-moda";
import "@fontsource-variable/manrope";
import "@fontsource-variable/vazirmatn";
import "./globals.css";
import { SCHOOL } from "@/lib/school";

export const metadata: Metadata = {
  metadataBase: new URL(SCHOOL.url),
  title: { default: "Fahrschule Kassel – beyourself | Führerschein B, B197, B78 & Umschreibung", template: "%s · Fahrschule beyourself Kassel" },
  description: "Fahrschule beyourself in Kassel: Führerschein Klasse B, B197 (Automatik mit Schaltberechtigung), B78 und Umschreibung. Fahrstunden online buchen, Theorie live übersetzt (Türkisch, Arabisch, Russisch, Englisch …).",
  applicationName: "beyourself Fahrschule",
  keywords: ["Fahrschule Kassel", "Führerschein Kassel", "Fahrschule Kassel Automatik", "B197 Kassel", "Führerschein umschreiben Kassel", "Fahrschule Kassel Arabisch", "Fahrschule Kassel Türkisch", "Fahrschule Kassel Russisch", "Fahrschule Kassel Englisch", "Fahrstunden Kassel"],
  openGraph: {
    type: "website", locale: "de_DE", siteName: "Fahrschule beyourself Kassel", url: SCHOOL.url,
    title: "Fahrschule beyourself Kassel – Fahre deinen eigenen Weg.",
    description: "Führerschein B, B197, B78 & Umschreibung in Kassel. Fahrstunden online buchen, Theorie live übersetzt in deine Sprache.",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Fahrschule beyourself in Kassel" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.jpg"] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION || undefined, other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined },
  formatDetection: { telephone: true, address: true, email: true },
  other: { "geo.region": "DE-HE", "geo.placename": "Kassel", "geo.position": `${SCHOOL.geo.lat};${SCHOOL.geo.lon}`, ICBM: `${SCHOOL.geo.lat}, ${SCHOOL.geo.lon}` },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f1a2c", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
