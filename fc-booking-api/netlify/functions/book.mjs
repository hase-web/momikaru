import {
  EVENT_TYPES,
  getStaffList,
  jsonResponse,
} from "../../lib/config.mjs";
import {
  createBookingEvent,
  fetchBusyPeriods,
  getCalendarForStaff,
  sendStaffBookingNotification,
} from "../../lib/google.mjs";
import { generateAvailableSlots } from "../../lib/slots.mjs";

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin;

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: jsonResponse(200, {}, origin).headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" }, origin);
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const {
      eventType = "consult",
      staffId,
      start,
      name,
      email,
      phone = "",
      message = "",
      area = "",
      timing = "",
      source = "",
    } = body;

    if (!start || !name || !email) {
      return jsonResponse(400, { error: "開始時刻・お名前・メールは必須です" }, origin);
    }
    if (!validateEmail(email)) {
      return jsonResponse(400, { error: "メールアドレスの形式が正しくありません" }, origin);
    }

    const eventConfig = EVENT_TYPES[eventType];
    if (!eventConfig) {
      return jsonResponse(400, { error: "不明な eventType です" }, origin);
    }

    const allStaff = getStaffList();
    if (!allStaff.length) {
      return jsonResponse(503, { error: "予約APIが未設定です", configured: false }, origin);
    }

    let staff = staffId
      ? allStaff.find((s) => s.id === staffId)
      : null;

    const startDate = new Date(start);
    if (Number.isNaN(startDate.getTime())) {
      return jsonResponse(400, { error: "開始時刻が不正です" }, origin);
    }

    const endDate = new Date(startDate.getTime() + eventConfig.durationMinutes * 60 * 1000);

    // 担当未指定なら空いている担当を自動割当
    if (!staff) {
      for (const candidate of allStaff) {
        const calendar = getCalendarForStaff(candidate);
        const rangeStart = new Date(startDate.getTime() - 60 * 60 * 1000);
        const rangeEnd = new Date(endDate.getTime() + 60 * 60 * 1000);
        const busy = await fetchBusyPeriods(
          calendar,
          candidate.calendarId,
          rangeStart,
          rangeEnd
        );
        const slots = generateAvailableSlots({
          rangeStart,
          rangeEnd,
          busyPeriods: busy,
          durationMinutes: eventConfig.durationMinutes,
          slotStepMinutes: eventConfig.durationMinutes,
        });
        if (slots.some((s) => s.start === startDate.toISOString())) {
          staff = candidate;
          break;
        }
      }
    }

    if (!staff) {
      return jsonResponse(409, {
        error: "選択した時間はすでに予約されています。別の時間をお選びください。",
      }, origin);
    }

    // 予約直前に再チェック（ダブルブッキング防止）
    const calendar = getCalendarForStaff(staff);
    const busy = await fetchBusyPeriods(
      calendar,
      staff.calendarId,
      new Date(startDate.getTime() - 1000),
      new Date(endDate.getTime() + 1000)
    );
    const stillFree = !busy.some(
      (b) => startDate < b.end && endDate > b.start
    );
    if (!stillFree) {
      return jsonResponse(409, {
        error: "直前で予約が入りました。別の時間をお選びください。",
      }, origin);
    }

    const description = [
      `【もみかるFC】${eventConfig.label}`,
      `お名前: ${name}`,
      `メール: ${email}`,
      phone ? `電話: ${phone}` : null,
      area ? `希望エリア: ${area}` : null,
      timing ? `開業希望時期: ${timing}` : null,
      source ? `流入LP: ${source}` : null,
      message ? `\nご相談内容:\n${message}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await createBookingEvent(calendar, staff.calendarId, {
      start: startDate,
      end: endDate,
      summary: `【FC】${eventConfig.label} — ${name} 様`,
      description,
      attendeeEmail: email,
      attendeeName: name,
    });

    let staffNotified = false;
    try {
      const notify = await sendStaffBookingNotification(staff, {
        eventLabel: eventConfig.label,
        start: startDate,
        end: endDate,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        description,
        meetLink: result.meetLink,
        htmlLink: result.htmlLink,
      });
      staffNotified = notify.sent;
    } catch (notifyErr) {
      console.error("担当者への通知メール送信に失敗:", notifyErr.message);
    }

    return jsonResponse(200, {
      success: true,
      staffId: staff.id,
      staffName: staff.name,
      eventId: result.eventId,
      meetLink: result.meetLink,
      calendarLink: result.htmlLink,
      staffNotified,
    }, origin);
  } catch (err) {
    console.error(err);
    return jsonResponse(500, {
      error: "予約の確定に失敗しました",
      detail: process.env.NODE_ENV === "development" ? err.message : undefined,
    }, origin);
  }
};
