import { getStaffList } from "../../lib/config.mjs";
import { createOAuthClient, getOAuthForStaff } from "../../lib/google.mjs";
import { google } from "googleapis";

function mask(value, head = 6, tail = 4) {
  if (!value) return null;
  if (value.length <= head + tail) return "***";
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function env(name) {
  const v = process.env[name];
  return typeof v === "string" ? v.trim() : v;
}

/** 設定確認用（秘密情報はマスクして返す） */
export const handler = async () => {
  const clientId = env("GOOGLE_CLIENT_ID");
  const clientSecret = env("GOOGLE_CLIENT_SECRET");

  const checks = {
    GOOGLE_CLIENT_ID: {
      set: Boolean(clientId),
      length: clientId?.length || 0,
      looksValid: Boolean(clientId?.includes(".apps.googleusercontent.com")),
      preview: mask(clientId),
    },
    GOOGLE_CLIENT_SECRET: {
      set: Boolean(clientSecret),
      length: clientSecret?.length || 0,
      looksValid: Boolean(clientSecret?.startsWith("GOCSPX-")),
      preview: mask(clientSecret),
    },
    STAFF_A_CALENDAR_ID: {
      set: Boolean(env("STAFF_A_CALENDAR_ID")),
      value: env("STAFF_A_CALENDAR_ID") || null,
    },
    STAFF_A_NAME: {
      set: Boolean(env("STAFF_A_NAME")),
      value: env("STAFF_A_NAME") || null,
    },
    STAFF_A_NOTIFY_EMAIL: {
      set: Boolean(env("STAFF_A_NOTIFY_EMAIL")),
      value: env("STAFF_A_NOTIFY_EMAIL") || env("STAFF_A_CALENDAR_ID") || null,
    },
    STAFF_A_REFRESH_TOKEN: {
      set: Boolean(env("STAFF_A_REFRESH_TOKEN")),
      length: env("STAFF_A_REFRESH_TOKEN")?.length || 0,
      preview: mask(env("STAFF_A_REFRESH_TOKEN")),
    },
    staffCount: getStaffList().length,
    tokenTests: [],
  };

  for (const staff of getStaffList()) {
    const entry = {
      staffId: staff.id,
      name: staff.name,
      calendarId: staff.calendarId,
      notifyEmail: staff.notifyEmail,
      calendarTokenOk: false,
      gmailSendOk: false,
    };
    try {
      const oauth2 = createOAuthClient();
      oauth2.setCredentials({ refresh_token: staff.refreshToken });
      const { credentials } = await oauth2.refreshAccessToken();
      entry.calendarTokenOk = Boolean(credentials.access_token);
    } catch (err) {
      entry.calendarTokenError = err.message;
    }
    try {
      const gmail = google.gmail({ version: "v1", auth: getOAuthForStaff(staff) });
      const profile = await gmail.users.getProfile({ userId: "me" });
      entry.gmailSendOk = true;
      entry.gmailAccount = profile.data.emailAddress;
    } catch (err) {
      entry.gmailSendError = err.message;
      entry.gmailSendHint =
        "Refresh Token に gmail.send 権限がありません。OAuth Playground で calendar + gmail.send を選び直してください。";
    }
    checks.tokenTests.push(entry);
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(checks, null, 2),
  };
};
