import { google } from "googleapis";

function env(name) {
  const v = process.env[name];
  return typeof v === "string" ? v.trim() : v;
}

export function createOAuthClient() {
  const clientId = env("GOOGLE_CLIENT_ID");
  const clientSecret = env("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が未設定です");
  }
  if (!clientId.includes(".apps.googleusercontent.com")) {
    throw new Error(
      "GOOGLE_CLIENT_ID の形式が不正です（.apps.googleusercontent.com で終わる必要があります）"
    );
  }
  if (!clientSecret.startsWith("GOCSPX-")) {
    throw new Error(
      "GOOGLE_CLIENT_SECRET の形式が不正です（GOCSPX- で始まる必要があります）"
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret);
}

export function getOAuthForStaff(staff) {
  const oauth2 = createOAuthClient();
  oauth2.setCredentials({ refresh_token: staff.refreshToken.trim() });
  return oauth2;
}

export function getCalendarForStaff(staff) {
  return google.calendar({ version: "v3", auth: getOAuthForStaff(staff) });
}

export async function fetchBusyPeriods(calendar, calendarId, timeMin, timeMax) {
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone: process.env.BOOKING_TIMEZONE || "Asia/Tokyo",
      items: [{ id: calendarId }],
    },
  });
  const busy = res.data.calendars?.[calendarId]?.busy || [];
  return busy.map((b) => ({
    start: new Date(b.start),
    end: new Date(b.end),
  }));
}

export async function createBookingEvent(calendar, calendarId, options) {
  const {
    start,
    end,
    summary,
    description,
    attendeeEmail,
    attendeeName,
  } = options;

  const event = {
    summary,
    description,
    start: {
      dateTime: start.toISOString(),
      timeZone: process.env.BOOKING_TIMEZONE || "Asia/Tokyo",
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: process.env.BOOKING_TIMEZONE || "Asia/Tokyo",
    },
    attendees: attendeeEmail
      ? [{ email: attendeeEmail, displayName: attendeeName || attendeeEmail }]
      : [],
    conferenceData: {
      createRequest: {
        requestId: `momikaru-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 },
        { method: "popup", minutes: 60 },
      ],
    },
  };

  const res = await calendar.events.insert({
    calendarId,
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: event,
  });

  return {
    eventId: res.data.id,
    htmlLink: res.data.htmlLink,
    meetLink:
      res.data.hangoutLink ||
      res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ||
      null,
  };
}

function formatJaDateTime(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: process.env.BOOKING_TIMEZONE || "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** 担当者へ予約通知メール（Gmail API） */
export async function sendStaffBookingNotification(staff, details) {
  const to = (details.to || staff.notifyEmail || staff.calendarId || "").trim();
  if (!to || !to.includes("@")) {
    return { sent: false, reason: "notify_email_missing" };
  }

  const auth = getOAuthForStaff(staff);
  const gmail = google.gmail({ version: "v1", auth });
  const subject = `【もみかるFC】新規予約: ${details.eventLabel} — ${details.customerName} 様`;
  const body = [
    `${staff.name || "担当"} さん`,
    "",
    "FCサイトから新しい予約が入りました。",
    "",
    `■ 種別: ${details.eventLabel}`,
    `■ 日時: ${formatJaDateTime(details.start)} 〜 ${formatJaDateTime(details.end)}`,
    `■ お名前: ${details.customerName}`,
    `■ メール: ${details.customerEmail}`,
    details.customerPhone ? `■ 電話: ${details.customerPhone}` : null,
    "",
    details.meetLink ? `■ Google Meet:\n${details.meetLink}` : null,
    details.htmlLink ? `■ カレンダー:\n${details.htmlLink}` : null,
    "",
    "── 詳細 ──",
    details.description || "",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
  const rawMessage = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ].join("\r\n");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: Buffer.from(rawMessage, "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, ""),
    },
  });

  return { sent: true, to };
}
