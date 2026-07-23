const pdfPrefix = "/olympiad/pdf";
const textPrefix = "/olympiad/text";

export function olympiadPdfUrl(
  sha256: string,
  legacyPath?: string,
  configuredBaseUrl?: string,
) {
  void legacyPath;
  void configuredBaseUrl;
  return `${pdfPrefix}/${sha256}.pdf`;
}

export function olympiadTextUrl(
  sha256: string,
  configuredBaseUrl?: string,
) {
  void configuredBaseUrl;
  return `${textPrefix}/${sha256}.txt`;
}
