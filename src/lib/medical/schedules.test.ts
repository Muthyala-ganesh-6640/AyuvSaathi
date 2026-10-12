import { describe, it, expect } from "vitest";
import { parseTimes, buildDoseKey, addDays, isPastSlot } from "./schedules";

describe("Medication Schedules & Dose Calculations", () => {
  it("parses and sorts valid HH:mm times", () => {
    const raw = ["21:00", "09:00", "invalid", "14:30"];
    const parsed = parseTimes(raw);
    expect(parsed).toEqual(["09:00", "14:30", "21:00"]);
  });

  it("builds unique composite dose keys", () => {
    const key = buildDoseKey("sched-1", "2026-10-15", "09:00");
    expect(key).toBe("sched-1:2026-10-15:09:00");
  });

  it("correctly adds days to date keys", () => {
    expect(addDays("2026-10-11", 1)).toBe("2026-10-12");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });

  it("identifies past slots accurately against reference time", () => {
    const ref = new Date("2026-10-11T12:00:00Z");
    const tz = "UTC";
    expect(isPastSlot("2026-10-10", "18:00", tz, ref)).toBe(true);
    expect(isPastSlot("2026-10-12", "08:00", tz, ref)).toBe(false);
    expect(isPastSlot("2026-10-11", "10:00", tz, ref)).toBe(true);
    expect(isPastSlot("2026-10-11", "14:00", tz, ref)).toBe(false);
  });
});
