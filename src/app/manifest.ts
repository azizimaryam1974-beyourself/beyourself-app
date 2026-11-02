import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fahrschule beyourself Kassel", short_name: "beyourself", start_url: "/konto", display: "standalone",
    background_color: "#0f1a2c", theme_color: "#0f1a2c", lang: "de",
    icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }],
  };
}
