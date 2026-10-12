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
