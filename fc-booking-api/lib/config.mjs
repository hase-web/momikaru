/** 営業時間・イベント種別（環境変数で上書き可能） */
export const TIMEZONE = process.env.BOOKING_TIMEZONE || "Asia/Tokyo";

export const EVENT_TYPES = {
  consult: {
    id: "consult",
    label: "個別相談",
    durationMinutes: Number(process.env.EVENT_CONSULT_MINUTES || 30),
  },
  briefing: {
    id: "briefing",
    label: "オンライン説明会",
    durationMinutes: Number(process.env.EVENT_BRIEFING_MINUTES || 60),
  },
};

export function getStaffList() {
  const staff = [];
  if (process.env.STAFF_A_REFRESH_TOKEN && process.env.STAFF_A_CALENDAR_ID) {
    staff.push({
      id: "a",
      name: process.env.STAFF_A_NAME || "担当A",
      calendarId: process.env.STAFF_A_CALENDAR_ID,
      refreshToken: process.env.STAFF_A_REFRESH_TOKEN,
    });
  }
  if (process.env.STAFF_B_REFRESH_TOKEN && process.env.STAFF_B_CALENDAR_ID) {
    staff.push({
      id: "b",
      name: process.env.STAFF_B_NAME || "担当B",
      calendarId: process.env.STAFF_B_CALENDAR_ID,
      refreshToken: process.env.STAFF_B_REFRESH_TOKEN,
    });
  }
  return staff;
}

export function getWorkingHours() {
  return {
    startHour: Number(process.env.WORK_START_HOUR || 10),
    endHour: Number(process.env.WORK_END_HOUR || 18),
    /** 0=日 … 6=土。デフォルトは平日のみ */
    workDays: (process.env.WORK_DAYS || "1,2,3,4,5")
      .split(",")
      .map((d) => Number(d.trim())),
  };
}

export function corsHeaders(origin) {
  const allowed = (process.env.ALLOWED_ORIGINS || "*")
    .split(",")
    .map((s) => s.trim());
  const ok =
    allowed.includes("*") ||
    (origin && allowed.some((a) => origin === a || origin.endsWith(a.replace(/^\*/, ""))));
  return {
    "Access-Control-Allow-Origin": ok && origin ? origin : allowed[0] === "*" ? "*" : allowed[0] || "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };
}

export function jsonResponse(statusCode, body, origin) {
  return {
    statusCode,
    headers: corsHeaders(origin),
    body: JSON.stringify(body),
  };
}
