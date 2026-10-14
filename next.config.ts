import type { NextConfig } from "next";
import { examAliases } from "./src/lib/exam-aliases";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      ...Object.entries(examAliases).flatMap(([alias, canonical]) =>
        ["", "/barem"].map((suffix) => ({
          source: `/exam/${alias}${suffix}`,
          destination: `/exam/${canonical}${suffix}`,
          permanent: true,
        })),
      ),
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
  async rewrites() {
    return {
      // Legacy document IDs need lookup, but only these redirects need a
      // request-time function. Keep queries out of the cached exam pages.
      beforeFiles: [
        { source: "/exam/:examId(olympiad(?::|%3[Aa]).*)/barem", destination: "/legacy-exam/:examId/barem" },
        { source: "/exam/:examId(olympiad(?::|%3[Aa]).*)", destination: "/legacy-exam/:examId" },
      ],
      afterFiles: [],
      fallback: [],
    };
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "worker-src 'self' blob:",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
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
