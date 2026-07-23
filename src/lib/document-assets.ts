export type DocumentNamespace = "bac" | "olympiad";
export type DocumentAssetKind = "pdf" | "text";

const sha256Pattern = /^[a-f0-9]{64}$/;

export function documentAssetObjectKey(
  namespace: DocumentNamespace,
  sha256: string,
  kind: DocumentAssetKind,
): string {
  if (!sha256Pattern.test(sha256)) {
    throw new Error(`Invalid SHA-256 for ${namespace} ${kind} asset.`);
  }
  const extension = kind === "pdf" ? "pdf" : "txt";
  return `${namespace}/${kind}/${sha256}.${extension}`;
}

export function normalizeDocumentAssetBaseUrl(
  configuredBaseUrl?: string | null,
): string | undefined {
  const normalized = configuredBaseUrl?.trim().replace(/\/+$/, "");
  return normalized || undefined;
}

export function documentAssetUrl({
  namespace,
  sha256,
  kind,
  configuredBaseUrl,
  legacyPath,
}: {
  namespace: DocumentNamespace;
  sha256: string;
  kind: DocumentAssetKind;
  configuredBaseUrl?: string | null;
  legacyPath?: string;
}): string | undefined {
  const baseUrl = normalizeDocumentAssetBaseUrl(configuredBaseUrl);
  if (baseUrl) {
    return `${baseUrl}/${documentAssetObjectKey(namespace, sha256, kind)}`;
  }
  return legacyPath;
}
