import type { MetadataRoute } from "next";
import { defaultDescription, siteName } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "iabacu - Subiecte și bareme Bacalaureat",
    short_name: siteName,
    description: defaultDescription,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f7f3",
    theme_color: "#18181b",
    lang: "ro-RO",
    categories: ["education"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
