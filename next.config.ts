import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/bac/:year",
        destination: "/bacalaureat/:year",
        permanent: true,
      },
      {
        source:
          "/olimpiade/olimpiada-de-matematica/arhiva/:year/clasa-:grade",
        destination:
          "/olimpiade/olimpiada-de-matematica?clasa=:grade&year=:year",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "frame-ancestors 'self'",
              "report-uri /api/csp-report",
            ].join("; "),
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
