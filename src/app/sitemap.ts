import type { MetadataRoute } from "next";
import { LICENSE_CLASSES } from "@/lib/classes";
import { SCHOOL } from "@/lib/school";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const u = (path: string, priority: number, changeFrequency: "weekly" | "monthly" | "yearly" = "monthly") => ({ url: `${SCHOOL.url}${path}`, lastModified: now, changeFrequency, priority });
  return [
    u("/", 1, "weekly"),
    ...LICENSE_CLASSES.map((c) => u(`/klasse/${c.slug}`, 0.9)),
    u("/fuehrerschein-umschreiben", 0.9),
    u("/sprachpaket", 0.7),
    u("/anmelden", 0.8),
    u("/buchungsbedingungen", 0.3, "yearly"),
    u("/impressum", 0.2, "yearly"),
    u("/datenschutz", 0.2, "yearly"),
  ];
}
