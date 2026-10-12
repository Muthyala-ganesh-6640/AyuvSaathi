import type { Observation } from "@/lib/db/types";
import { compareToSourceRange } from "@/lib/medical/ranges";

export function groundedAnswer(
  question: string,
  observations: Observation[],
  _locale?: string
) {
  void _locale;
  if (!observations.length) {
    return "I do not have any user-confirmed report values yet. Upload a report and verify the extracted values first. This is not medical advice.";
  }

  // Deduplicate observations by name so duplicate records do not repeat
  const uniqueObsMap = new Map<string, Observation>();
  for (const o of observations) {
    const key = o.name.trim().toLowerCase();
    if (!uniqueObsMap.has(key)) {
      uniqueObsMap.set(key, o);
    }
  }
  const deduplicatedObs = Array.from(uniqueObsMap.values());

  const q = question.toLowerCase();
  const matches = deduplicatedObs.filter((o) => {
    const name = o.name.toLowerCase();
    return q.includes(name) || name.split(/\s+/).some((part) => part.length > 3 && q.includes(part));
  });
  const pool = matches.length ? matches : deduplicatedObs.slice(0, 8);

  const lines = pool.map((o) => {
    const status = compareToSourceRange(o.value, o.referenceRange);
    const range =
      o.referenceRange && o.referenceRange.trim()
        ? `source range ${o.referenceRange}`
        : "no source range provided";
    return `${o.name}: ${o.value} ${o.unit} (${range}; ${status.replaceAll("_", " ")})`;
  });

  const intro = "These facts come only from values you confirmed. This is not a diagnosis.";
  const ask = "Ask a qualified clinician how these results relate to your symptoms and history.";

  if (!matches.length) {
    const none = "No specific test in your question matched a confirmed result. Confirmed values:";
    return `${intro}\n${none}\n${lines.join("\n")}\n${ask}`;
  }

  return `${intro}\n${lines.join("\n")}\n${ask}`;
}