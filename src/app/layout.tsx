import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bodoni-moda";
import "@fontsource-variable/manrope";
import "@fontsource-variable/vazirmatn";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "beyourself – Fahrschule", template: "%s · beyourself Fahrschule" },
  description: "Fahre deinen eigenen Weg. Fahrschule mit Theorieunterricht live übersetzt in deine Sprache.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f1a2c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
