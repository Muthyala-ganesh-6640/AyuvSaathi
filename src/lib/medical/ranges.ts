export type RangeStatus = "in_range" | "out_of_range" | "unavailable";

function parseNumber(raw: string) {
  const cleaned = raw.replace(/,/g, "").trim();
  const match = cleaned.match(/[+-]?\d+(?:\.\d+)?/);
  if (match) {
    const n = Number.parseFloat(match[0]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Compare a numeric result to a reference range copied from the source document.
 * Missing or unparseable ranges are reported as unavailable — never invented.
 */
export function compareToSourceRange(valueRaw: string, rangeRaw?: string | null): RangeStatus {
  const valueUpper = valueRaw.trim().toUpperCase();
  // Check for explicit laboratory flags like "42.7 H", "HIGH", "3.2 L", "LOW"
  const hasHighFlag = /\bH\b|\bHIGH\b|\bELEVATED\b/i.test(valueUpper);
  const hasLowFlag = /\bL\b|\bLOW\b|\bDECREASED\b/i.test(valueUpper);

  if (!rangeRaw || !rangeRaw.trim()) {
    if (hasHighFlag || hasLowFlag) return "out_of_range";
    return "unavailable";
  }
  const value = parseNumber(valueRaw);
  if (value === null) {
    if (hasHighFlag || hasLowFlag) return "out_of_range";
    return "unavailable";
  }

  const range = rangeRaw.trim().replace(/–|—/g, "-");

  const between = range.match(/^([+-]?\d+(?:\.\d+)?)\s*-\s*([+-]?\d+(?:\.\d+)?)/);
  if (between) {
    const low = Number(between[1]);
    const high = Number(between[2]);
    if (low > high) return "unavailable";
    return value >= low && value <= high ? "in_range" : "out_of_range";
  }

  const lt = range.match(/^(?:<|<=)\s*([+-]?\d+(?:\.\d+)?)/);
  if (lt) {
    const n = Number(lt[1]);
    const inclusive = range.trim().startsWith("<=");
    if (inclusive) return value <= n ? "in_range" : "out_of_range";
    return value < n ? "in_range" : "out_of_range";
  }

  const gt = range.match(/^(?:>|>=)\s*([+-]?\d+(?:\.\d+)?)/);
  if (gt) {
    const n = Number(gt[1]);
    const inclusive = range.trim().startsWith(">=");
    if (inclusive) return value >= n ? "in_range" : "out_of_range";
    return value > n ? "in_range" : "out_of_range";
  }

  if (hasHighFlag || hasLowFlag) return "out_of_range";

  return "unavailable";
}

export function rangeLabel(status: RangeStatus) {
  if (status === "in_range") return "Within source range";
  if (status === "out_of_range") return "Outside source range";
  return "Source range unavailable";
}
