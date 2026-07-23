export type WorkImageQualityIssue = {
  code:
    | "unsupported_type"
    | "unreadable"
    | "low_resolution"
    | "landscape"
    | "extreme_aspect_ratio"
    | "large_file";
  severity: "warning" | "error";
  message: string;
};

type WorkImageMetadata = {
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
};

const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const safeTotalUploadBytes = 26 * 1024 * 1024;
const safePerImageBytes = 6.5 * 1024 * 1024;

export function workImageCompressionTarget(fileCount: number) {
  const safeCount = Math.max(1, Math.floor(fileCount));
  return Math.floor(Math.min(safePerImageBytes, safeTotalUploadBytes / safeCount));
}

export function workImageQualityIssues({
  mimeType,
  sizeBytes,
  width,
  height,
}: WorkImageMetadata): WorkImageQualityIssue[] {
  const issues: WorkImageQualityIssue[] = [];

  if (!supportedTypes.has(mimeType)) {
    issues.push({
      code: "unsupported_type",
      severity: "error",
      message: "Format neacceptat. Folosește JPEG, PNG sau WebP.",
    });
  }
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    issues.push({
      code: "unreadable",
      severity: "error",
      message: "Imaginea nu poate fi citită. Înlocuiește fișierul.",
    });
    return issues;
  }

  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  const aspectRatio = longEdge / shortEdge;
  if (shortEdge < 900 || width * height < 1_200_000) {
    issues.push({
      code: "low_resolution",
      severity: "warning",
      message: "Rezoluție mică; scrisul fin poate fi citit greșit. Refă poza mai aproape.",
    });
  }
  if (aspectRatio > 2.2) {
    issues.push({
      code: "extreme_aspect_ratio",
      severity: "error",
      message: "Imaginea este prea îngustă pentru o pagină completă. Refă fotografia.",
    });
  } else if (width > height * 1.15) {
    issues.push({
      code: "landscape",
      severity: "warning",
      message: "Pagina pare rotită orizontal. Verifică orientarea înainte de trimitere.",
    });
  }
  if (sizeBytes > 7 * 1024 * 1024) {
    issues.push({
      code: "large_file",
      severity: "warning",
      message: "Fișier mare; îl comprimăm local înainte de corectare.",
    });
  }

  return issues;
}
