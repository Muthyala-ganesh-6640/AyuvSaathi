import { store } from "@/lib/db/file-store";
import type { Profile } from "@/lib/db/types";
import { addDays, buildDoseKey, isPastSlot, localDateKey, isCourseEnded } from "./schedules";
import { nowIso } from "@/lib/utils";

export async function ensureUpcomingDoses(user: Profile, days = 7) {
  const [schedules, medications, existing] = await Promise.all([
    store.listSchedules(user.id),
    store.listMedications(user.id),
    store.listDoses(user.id),
  ]);
  const medById = new Map(medications.map((m) => [m.id, m]));
  const known = new Set(existing.map((d) => buildDoseKey(d.scheduleId, d.scheduledDate, d.scheduledTime)));
  const tz = user.timezone || "Asia/Kolkata";
  const start = localDateKey(new Date(), tz);

  for (const schedule of schedules) {
    const med = medById.get(schedule.medicationId);
    if (!med) continue;

    // Course conclusion check: stop reminders when course ends
    const endDate = schedule.endDate || med.endDate;
    if (endDate && isCourseEnded(endDate, tz)) {
      if (med.status === "active") {
        await store.saveMedication({ ...med, status: "completed", updatedAt: nowIso() });
      }
      if (schedule.enabled) {
        await store.saveSchedule({ ...schedule, enabled: false, updatedAt: nowIso() });
      }
      continue;
    }

    if (!schedule.enabled) continue;
    if (med.status !== "active" || med.confirmationStatus !== "confirmed") continue;

    for (let i = 0; i < days; i++) {
      const date = addDays(start, i);
      if (date < schedule.startDate) continue;
      if (schedule.endDate && date > schedule.endDate) continue;
      for (const time of schedule.times) {
        const key = buildDoseKey(schedule.id, date, time);
        if (known.has(key)) continue;
        const missed = isPastSlot(date, time, tz);
        const created = nowIso();
        await store.saveDose({
          id: crypto.randomUUID(),
          ownerId: user.id,
          medicationId: med.id,
          scheduleId: schedule.id,
          scheduledDate: date,
          scheduledTime: time,
          status: missed ? "missed" : "pending",
          source: "system",
          createdAt: created,
          updatedAt: created,
        });
        known.add(key);
      }
    }
  }

  const doses = await store.listDoses(user.id);
  for (const dose of doses) {
    if (dose.status === "pending" && isPastSlot(dose.scheduledDate, dose.scheduledTime, tz)) {
      await store.saveDose({ ...dose, status: "missed", updatedAt: nowIso() });
    }
  }
}
