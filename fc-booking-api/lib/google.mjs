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

export function getCalendarForStaff(staff) {
  const oauth2 = createOAuthClient();
  oauth2.setCredentials({ refresh_token: staff.refreshToken.trim() });
  return google.calendar({ version: "v3", auth: oauth2 });
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
