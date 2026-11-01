/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  // Anmeldung mit eingescanntem Ausweis: Formulare dürfen größer als 1 MB sein
  experimental: { serverActions: { bodySizeLimit: "32mb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Mikrofon nur für die eigene Seite (Unterrichtskonsole)
          { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
        ],
      },
    ];
  },
};
export default nextConfig;
