import type { MetadataRoute } from "next";
import { SCHOOL } from "@/lib/school";

/** Suchmaschinen und KI-Crawler dürfen die öffentliche Webseite lesen – private Bereiche nicht. */
export default function robots(): MetadataRoute.Robots {
  const privat = ["/api/", "/konto", "/termine", "/nachrichten", "/verwaltung", "/unterricht", "/live", "/passwort", "/theorie"];
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: privat }],
    sitemap: `${SCHOOL.url}/sitemap.xml`,
    host: SCHOOL.url,
  };
}
