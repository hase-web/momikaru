import { getStaffList } from "../../lib/config.mjs";
import { createOAuthClient } from "../../lib/google.mjs";

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
    STAFF_A_REFRESH_TOKEN: {
      set: Boolean(env("STAFF_A_REFRESH_TOKEN")),
      length: env("STAFF_A_REFRESH_TOKEN")?.length || 0,
      preview: mask(env("STAFF_A_REFRESH_TOKEN")),
    },
    staffCount: getStaffList().length,
    tokenTests: [],
  };

  for (const staff of getStaffList()) {
    try {
      const oauth2 = createOAuthClient();
      oauth2.setCredentials({ refresh_token: staff.refreshToken });
      const { credentials } = await oauth2.refreshAccessToken();
      checks.tokenTests.push({
        staffId: staff.id,
        calendarId: staff.calendarId,
        ok: Boolean(credentials.access_token),
      });
    } catch (err) {
      checks.tokenTests.push({
        staffId: staff.id,
        calendarId: staff.calendarId,
        ok: false,
        error: err.message,
      });
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(checks, null, 2),
  };
};
