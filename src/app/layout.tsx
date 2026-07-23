import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import { AuthShell } from "@/components/auth-shell";
import { SiteFooter } from "@/components/site-footer";
import {
  baseKeywords,
  defaultDescription,
  defaultTitle,
  ogImagePath,
  siteName,
  siteUrl,
} from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: `${defaultTitle} | ${siteName}`,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  keywords: baseKeywords,
  creator: siteName,
  publisher: siteName,
  category: "education",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    url: siteUrl,
    siteName,
    locale: "ro_RO",
    type: "website",
    images: [
      {
        url: ogImagePath,
        width: 1200,
        height: 630,
        alt: `${siteName} - ${defaultTitle}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: [ogImagePath],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthShell>{children}</AuthShell>
        <SiteFooter />
      </body>
    </html>
  );
}
