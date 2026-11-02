import { AppFooter, SiteHeader } from "@/components/SiteChrome";

/** Konto-, Verwaltungs- und Unterrichtsseiten gehören nicht in Suchmaschinen. */
export const metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="app-main">
        <SiteHeader tone="dark" />
        <main className="wrap" style={{ paddingTop: 12 }}>{children}</main>
      </div>
      <AppFooter />
    </>
  );
}
