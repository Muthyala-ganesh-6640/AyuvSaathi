export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type AllowedKind = "pdf" | "jpeg" | "png";

export function detectKind(buffer: Buffer, mime: string, name: string): AllowedKind | null {
  const lower = name.toLowerCase();
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    if (mime === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    if (mime === "image/jpeg" || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    if (mime === "image/png" || lower.endsWith(".png")) return "png";
  }
  return null;
}

export function mimeFor(kind: AllowedKind) {
  if (kind === "pdf") return "application/pdf";
  if (kind === "jpeg") return "image/jpeg";
  return "image/png";
}
