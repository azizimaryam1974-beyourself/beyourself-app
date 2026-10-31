import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="app-main">
        <SiteHeader />
        <main className="wrap" style={{ paddingTop: 12 }}>{children}</main>
      </div>
      <SiteFooter />
    </>
  );
}
