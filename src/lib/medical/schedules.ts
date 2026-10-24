export type DoseStatus = "pending" | "taken" | "skipped" | "missed";

export function parseTimes(times: string[]) {
  return times
    .map((t) => t.trim())
    .filter((t) => /^\d{2}:\d{2}$/.test(t))
    .sort();
}

export function buildDoseKey(scheduleId: string, date: string, time: string) {
  return `${scheduleId}:${date}:${time}`;
}

export function localDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

export function addDays(dateKey: string, days: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function isPastSlot(dateKey: string, time: string, timeZone: string, now = new Date()) {
  const nowKey = localDateKey(now, timeZone);
  if (dateKey < nowKey) return true;
  if (dateKey > nowKey) return false;
  const current = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return time < current;
}

/**
 * Parses a natural language clinical frequency into standardized daily schedule times (24h).
 */
export function frequencyToTimes(frequency: string): string[] {
  if (!frequency) return ["09:00"];
  const lower = frequency.toLowerCase().trim();

  // Check if explicit comma-separated times were provided (e.g. "08:00, 20:00")
  const explicitTimes = lower
    .split(",")
    .map((t) => t.trim())
    .filter((t) => /^\d{1,2}:\d{2}$/.test(t))
    .map((t) => (t.length === 4 ? `0${t}` : t));
  if (explicitTimes.length > 0) {
    return explicitTimes.sort();
  }

  // Common clinical abbreviations and terms
  if (lower.includes("four times") || lower.includes("qid") || lower.includes("4 times")) {
    return ["06:00", "12:00", "18:00", "22:00"];
  }
  if (lower.includes("three times") || lower.includes("thrice") || lower.includes("tid") || lower.includes("3 times")) {
    return ["08:00", "14:00", "20:00"];
  }
  if (
    lower.includes("twice") ||
    lower.includes("bid") ||
    lower.includes("2 times") ||
    (lower.includes("morning") && lower.includes("night")) ||
    (lower.includes("morning") && lower.includes("evening"))
  ) {
    return ["09:00", "21:00"];
  }
  if (lower.includes("bedtime") || lower.includes("night") || lower.includes("hs")) {
    return ["21:00"];
  }
  if (lower.includes("afternoon") || lower.includes("lunch")) {
    return ["13:00"];
  }
  if (lower.includes("evening") || lower.includes("dinner")) {
    return ["19:00"];
  }
  // Default once daily (morning)
  return ["09:00"];
}

/**
 * Parses a duration string (e.g. "5 days", "2 weeks", "1 month") into total integer days.
 */
export function durationToDays(duration?: string): number | null {
  if (!duration) return null;
  const lower = duration.toLowerCase().trim();

  // Pattern: "5 days", "10 d", "3 weeks", "1 month"
  const match = lower.match(/(\d+)\s*(day|d|week|wk|w|month|m|yr|year)?/);
  if (!match) return null;

  const count = parseInt(match[1], 10);
  if (isNaN(count) || count <= 0) return null;

  const unit = match[2] || "day";
  if (unit.startsWith("w")) {
    return count * 7;
  }
  if (unit.startsWith("m") && unit !== "min") {
    return count * 30;
  }
  if (unit.startsWith("y")) {
    return count * 365;
  }
  return count;
}

/**
 * Computes course start and end dates based on duration.
 */
export function parseCourseDates(
  duration?: string,
  startDate?: string,
  timeZone = "Asia/Kolkata"
): { startDate: string; endDate?: string } {
  const start = startDate || localDateKey(new Date(), timeZone);
  const days = durationToDays(duration);
  if (days && days > 0) {
    return {
      startDate: start,
      endDate: addDays(start, days),
    };
  }
  return { startDate: start };
}

/**
 * Checks whether a medication course has passed its end date.
 */
export function isCourseEnded(endDate?: string, timeZone = "Asia/Kolkata", now = new Date()): boolean {
  if (!endDate) return false;
  const today = localDateKey(now, timeZone);
  return today > endDate;
}

/**
 * Calculates snoozed time (e.g. "09:00" + 30 mins -> "09:30").
 * Clamped to 23:59 to avoid rolling over to the next day in same-day dose view.
 */
export function snoozeTime(timeString: string, snoozeMinutes: number): string {
  const parts = timeString.split(":").map(Number);
  const hour = isNaN(parts[0]) ? 9 : parts[0];
  const minute = isNaN(parts[1]) ? 0 : parts[1];

  let totalMinutes = hour * 60 + minute + snoozeMinutes;
  if (totalMinutes > 23 * 60 + 59) {
    totalMinutes = 23 * 60 + 59;
  }

  const newHour = Math.floor(totalMinutes / 60);
  const newMinute = totalMinutes % 60;
  return `${String(newHour).padStart(2, "0")}:${String(newMinute).padStart(2, "0")}`;
}
