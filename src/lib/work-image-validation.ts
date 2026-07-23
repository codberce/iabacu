import { z } from "zod";

const supportedFormats = new Set(["jpeg", "png", "webp"] as const);
type SupportedFormat = "jpeg" | "png" | "webp";

export type NormalizedWorkImage = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
  width: number;
  height: number;
  bytes: number;
};

export class WorkImageValidationError extends Error {
  constructor(message: string, readonly status = 415) {
    super(message);
    this.name = "WorkImageValidationError";
  }
}

function detectedFormat(bytes: Buffer): SupportedFormat | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return undefined;
}

function mimeFor(format: SupportedFormat): NormalizedWorkImage["mimeType"] {
  return format === "jpeg" ? "image/jpeg" : format === "png" ? "image/png" : "image/webp";
}

const metadataSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  format: z.string(),
});

/**
 * Decodes and re-encodes pages before any provider request. The dynamic import
 * keeps client bundles clean and permits a clear operational error when the
 * production image decoder was not installed.
 */
export async function validateAndNormalizeWorkImage(
  file: File,
  limits: { maxBytes: number; maxPixels: number; maxEdge: number },
): Promise<NormalizedWorkImage> {
  if (file.size <= 0 || file.size > limits.maxBytes) {
    throw new WorkImageValidationError("O pagină depășește limita permisă de dimensiune.", 413);
  }

  const input = Buffer.from(await file.arrayBuffer());
  const magic = detectedFormat(input);
  if (!magic || !supportedFormats.has(magic)) {
    throw new WorkImageValidationError("Fișierul nu este o imagine JPEG, PNG sau WebP validă.");
  }
  if (file.type && file.type !== mimeFor(magic)) {
    throw new WorkImageValidationError("Tipul declarat al imaginii nu corespunde conținutului fișierului.");
  }

  let sharp: (typeof import("sharp"))["default"];
  try {
    sharp = (await import("sharp")).default;
  } catch {
    throw new WorkImageValidationError("Validarea imaginilor nu este disponibilă momentan.", 503);
  }

  let metadata: z.infer<typeof metadataSchema>;
  try {
    metadata = metadataSchema.parse(await sharp(input, { failOn: "error", limitInputPixels: limits.maxPixels }).metadata());
  } catch {
    throw new WorkImageValidationError("Imaginea nu poate fi decodată în siguranță.");
  }
  if (!supportedFormats.has(metadata.format as SupportedFormat) || metadata.width * metadata.height > limits.maxPixels) {
    throw new WorkImageValidationError("Imaginea are dimensiuni nepermise.");
  }

  try {
    const normalized = await sharp(input, { failOn: "error", limitInputPixels: limits.maxPixels })
      .rotate()
      .resize({ width: limits.maxEdge, height: limits.maxEdge, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88, progressive: true })
      .toBuffer({ resolveWithObject: true });
    return {
      mimeType: "image/jpeg",
      base64: normalized.data.toString("base64"),
      width: normalized.info.width,
      height: normalized.info.height,
      bytes: normalized.data.length,
    };
  } catch {
    throw new WorkImageValidationError("Imaginea nu poate fi normalizată în siguranță.");
  }
}
