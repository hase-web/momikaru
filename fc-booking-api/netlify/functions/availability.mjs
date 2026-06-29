import {
  EVENT_TYPES,
  getStaffList,
  jsonResponse,
} from "../../lib/config.mjs";
import { fetchBusyPeriods, getCalendarForStaff } from "../../lib/google.mjs";
import { generateAvailableSlots } from "../../lib/slots.mjs";

export const handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: jsonResponse(200, {}, origin).headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" }, origin);
  }

  try {
    const params = event.queryStringParameters || {};
    const eventType = params.eventType || "consult";
    const staffFilter = params.staffId || "any";
    const days = Math.min(Number(params.days || 14), 30);

    const eventConfig = EVENT_TYPES[eventType];
    if (!eventConfig) {
      return jsonResponse(400, { error: "不明な eventType です" }, origin);
    }

    const allStaff = getStaffList();
    if (!allStaff.length) {
      return jsonResponse(503, {
        error: "予約APIが未設定です。Netlify の環境変数を設定してください。",
        configured: false,
      }, origin);
    }

    const staffToQuery =
      staffFilter === "any"
        ? allStaff
        : allStaff.filter((s) => s.id === staffFilter);

    if (!staffToQuery.length) {
      return jsonResponse(400, { error: "担当者が見つかりません" }, origin);
    }

    const rangeStart = new Date();
    const rangeEnd = new Date();
    rangeEnd.setDate(rangeEnd.getDate() + days);

    const staffAvailability = [];

    for (const staff of staffToQuery) {
      const calendar = getCalendarForStaff(staff);
      const busy = await fetchBusyPeriods(
        calendar,
        staff.calendarId,
        rangeStart,
        rangeEnd
      );
      const slots = generateAvailableSlots({
        rangeStart,
        rangeEnd,
        busyPeriods: busy,
        durationMinutes: eventConfig.durationMinutes,
      });
      staffAvailability.push({
        staffId: staff.id,
        staffName: staff.name,
        slots,
      });
    }

    let mergedSlots = [];
    if (staffFilter === "any" && staffToQuery.length > 1) {
      const slotMap = new Map();
      for (const entry of staffAvailability) {
        for (const slot of entry.slots) {
          const key = slot.start;
          if (!slotMap.has(key)) {
            slotMap.set(key, {
              start: slot.start,
              end: slot.end,
              staffIds: [entry.staffId],
            });
          } else {
            slotMap.get(key).staffIds.push(entry.staffId);
          }
        }
      }
      mergedSlots = Array.from(slotMap.values()).sort(
        (a, b) => new Date(a.start) - new Date(b.start)
      );
    } else {
      mergedSlots = staffAvailability[0].slots.map((s) => ({
        ...s,
        staffIds: [staffAvailability[0].staffId],
      }));
    }

    return jsonResponse(200, {
      configured: true,
      eventType,
      eventLabel: eventConfig.label,
      durationMinutes: eventConfig.durationMinutes,
      staff: allStaff.map((s) => ({ id: s.id, name: s.name })),
      slots: mergedSlots.slice(0, 120),
    }, origin);
  } catch (err) {
    console.error(err);
    return jsonResponse(500, {
      error: "空き時間の取得に失敗しました",
      detail: err.message,
      hint:
        "Netlify の GOOGLE_CLIENT_ID/SECRET と Playground で取得した Refresh token が同じ OAuth クライアントか確認してください。/.netlify/functions/debug も参照。",
    }, origin);
  }
};
