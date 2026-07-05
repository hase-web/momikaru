import { TIMEZONE, getWorkingHours } from "./config.mjs";

/** JST の日付部分を YYYY-MM-DD で取得 */
function dateKeyInTz(date, tz) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getPartsInTz(date, tz) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    day: dayMap[map.weekday] ?? 0,
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

/** 指定 TZ のローカル日時で Date を組み立て（概算: UTC+9 固定ではなく Intl で日付境界を扱う） */
function makeZonedDate(dateStr, hour, minute, tz) {
  // ISO-like local string interpreted via offset hack for Asia/Tokyo
  const pad = (n) => String(n).padStart(2, "0");
  const iso = `${dateStr}T${pad(hour)}:${pad(minute)}:00`;
  if (tz === "Asia/Tokyo") {
    return new Date(`${iso}+09:00`);
  }
  return new Date(iso);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * 営業時間からスロットを生成し、busy と重なるものを除外
 */
export function generateAvailableSlots({
  rangeStart,
  rangeEnd,
  busyPeriods,
  durationMinutes,
  slotStepMinutes = 30,
}) {
  const { startHour, endHour, workDays } = getWorkingHours();
  const slots = [];
  const durationMs = durationMinutes * 60 * 1000;
  const stepMs = slotStepMinutes * 60 * 1000;

  const cursor = new Date(rangeStart);
  cursor.setHours(0, 0, 0, 0);

  while (cursor < rangeEnd) {
    const key = dateKeyInTz(cursor, TIMEZONE);
    const probe = makeZonedDate(key, 12, 0, TIMEZONE);
    const { day } = getPartsInTz(probe, TIMEZONE);

    if (workDays.includes(day)) {
      let slotStart = makeZonedDate(key, startHour, 0, TIMEZONE);
      const dayEnd = makeZonedDate(key, endHour, 0, TIMEZONE);

      while (slotStart.getTime() + durationMs <= dayEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + durationMs);
        const inRange = slotStart >= rangeStart && slotEnd <= rangeEnd;
        const notBusy = !busyPeriods.some((b) =>
          overlaps(slotStart, slotEnd, b.start, b.end)
        );
        const notPast = slotStart > new Date();

        if (inRange && notBusy && notPast) {
          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
          });
        }
        slotStart = new Date(slotStart.getTime() + stepMs);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return slots;
}

export function pickStaffForSlot(staffAvailability, slotStartIso) {
  for (const entry of staffAvailability) {
    const free = entry.slots.some((s) => s.start === slotStartIso);
    if (free) return entry.staffId;
  }
  return null;
}
