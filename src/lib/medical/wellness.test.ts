import { describe, it, expect } from "vitest";
import { generateWellnessRecommendations } from "./wellness";
import {
  frequencyToTimes,
  durationToDays,
  parseCourseDates,
  isCourseEnded,
  snoozeTime,
} from "./schedules";
import type { Profile, Observation, Medication } from "@/lib/db/types";

describe("Medication & Appointment Reminders and Personalized Wellness", () => {
  const dummyProfile: Profile = {
    id: "user-123",
    email: "ramesh@example.com",
    passwordHash: "hash",
    displayName: "Ramesh Gupta",
    role: "patient",
    dateOfBirth: "1974-05-15", // ~52 years old
    interfaceLanguage: "en",
    aiLanguage: "en",
    timezone: "Asia/Kolkata",
    notifyReminders: true,
    onboardingComplete: true,
    emailVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("1. Parses prescription frequencies into accurate daily schedule times", () => {
    expect(frequencyToTimes("Once daily")).toEqual(["09:00"]);
    expect(frequencyToTimes("Twice daily")).toEqual(["09:00", "21:00"]);
    expect(frequencyToTimes("TID (three times daily)")).toEqual(["08:00", "14:00", "20:00"]);
    expect(frequencyToTimes("QID (four times daily)")).toEqual(["06:00", "12:00", "18:00", "22:00"]);
    expect(frequencyToTimes("Bedtime")).toEqual(["21:00"]);
    expect(frequencyToTimes("08:00, 20:00")).toEqual(["08:00", "20:00"]);
  });

  it("2. Parses prescription duration and course dates", () => {
    expect(durationToDays("5 days")).toBe(5);
    expect(durationToDays("2 weeks")).toBe(14);
    expect(durationToDays("1 month")).toBe(30);

    const dates = parseCourseDates("10 days", "2026-10-01");
    expect(dates.startDate).toBe("2026-10-01");
    expect(dates.endDate).toBe("2026-10-11");

    expect(isCourseEnded("2026-10-05", "Asia/Kolkata", new Date("2026-10-10"))).toBe(true);
    expect(isCourseEnded("2026-10-25", "Asia/Kolkata", new Date("2026-10-10"))).toBe(false);
  });

  it("3. Calculates dose snooze time correctly without invalid rollovers", () => {
    expect(snoozeTime("09:00", 15)).toBe("09:15");
    expect(snoozeTime("09:45", 30)).toBe("10:15");
    expect(snoozeTime("23:50", 30)).toBe("23:59"); // Clamped within day
  });

  it("4. Generates personalized wellness recommendations tailored to conditions, test values, and age", () => {
    const observations: Observation[] = [
      {
        id: "obs-1",
        ownerId: "user-123",
        name: "HbA1c",
        documentId: "doc-1",
        value: "7.4",
        unit: "%",
        uncertain: false,
        verificationStatus: "confirmed",
        provenance: "ai_extracted",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "obs-2",
        ownerId: "user-123",
        name: "Systolic Blood Pressure",
        documentId: "doc-1",
        value: "138",
        unit: "mmHg",
        uncertain: false,
        verificationStatus: "confirmed",
        provenance: "user_entered",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "obs-3",
        ownerId: "user-123",
        name: "Diastolic Blood Pressure",
        documentId: "doc-1",
        value: "88",
        unit: "mmHg",
        uncertain: false,
        verificationStatus: "confirmed",
        provenance: "user_entered",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const medications: Medication[] = [
      {
        id: "med-1",
        ownerId: "user-123",
        name: "Metformin",
        strength: "500 mg",
        instructions: "Twice daily after food",
        status: "active",
        confirmationStatus: "confirmed",
        provenance: "user_entered",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const analysis = generateWellnessRecommendations(dummyProfile, observations, medications);

    expect(analysis.age).toBeGreaterThan(45);
    expect(analysis.identifiedConditions).toContain("Type 2 Diabetes / Dysglycemia");
    expect(analysis.recommendations.length).toBeGreaterThanOrEqual(4);

    // Verify recommendations span Diet, Activity, Sleep, Habits
    const categories = new Set(analysis.recommendations.map((r) => r.category));
    expect(categories.has("diet")).toBe(true);
    expect(categories.has("activity")).toBe(true);
    expect(categories.has("sleep")).toBe(true);
    expect(categories.has("habits")).toBe(true);

    // Verify each recommendation has an explicit reasoning explaining why it is suggested
    for (const r of analysis.recommendations) {
      expect(r.whyRecommended).toBeDefined();
      expect(r.whyRecommended.length).toBeGreaterThan(15);
      expect(r.evidenceTag).toBeDefined();
      expect(r.disclaimer.toLowerCase()).toContain("general wellness");
    }

    // Verify specific HbA1c/Diabetes reason was cited
    const dietGlycemic = analysis.recommendations.find((r) => r.id === "diet-glycemic-balance");
    expect(dietGlycemic).toBeDefined();
    expect(dietGlycemic?.whyRecommended).toContain("7.4%");

    // Verify DASH diet cited the systolic/diastolic BP
    const dietDASH = analysis.recommendations.find((r) => r.id === "diet-dash-sodium");
    expect(dietDASH).toBeDefined();
    expect(dietDASH?.whyRecommended).toContain("138/88 mmHg");
  });
});
