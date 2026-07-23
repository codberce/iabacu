import { documentAssetUrl } from "@/lib/document-assets";

function configuredAssetBaseUrl(configuredBaseUrl?: string) {
  return process.env.NEXT_PUBLIC_BAC_ASSET_BASE_URL ?? configuredBaseUrl;
}

export function bacPdfUrl(
  sha256: string,
  legacyPath?: string,
  configuredBaseUrl?: string,
) {
  const url = documentAssetUrl({
    namespace: "bac",
    sha256,
    kind: "pdf",
    configuredBaseUrl:
      sha256 === "0".repeat(64)
        ? undefined
        : configuredAssetBaseUrl(configuredBaseUrl),
    legacyPath,
  });
  if (!url) {
    throw new Error("NEXT_PUBLIC_BAC_ASSET_BASE_URL nu este configurat.");
  }
  return url;
}

export function bacTextUrl(sha256: string, configuredBaseUrl?: string) {
  const url = documentAssetUrl({
    namespace: "bac",
    sha256,
    kind: "text",
    configuredBaseUrl: configuredAssetBaseUrl(configuredBaseUrl),
  });
  if (!url) {
    throw new Error("NEXT_PUBLIC_BAC_ASSET_BASE_URL nu este configurat.");
  }
  return url;
}
