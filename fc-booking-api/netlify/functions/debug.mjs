import { getStaffList } from "../../lib/config.mjs";
import { createOAuthClient } from "../../lib/google.mjs";

/** 設定確認用（秘密情報は返さない）。本番安定後は削除可。 */
export const handler = async () => {
  const checks = {
    GOOGLE_CLIENT_ID: Boolean(process.env.GOOGLE_CLIENT_ID),
    GOOGLE_CLIENT_SECRET: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    STAFF_A_CALENDAR_ID: Boolean(process.env.STAFF_A_CALENDAR_ID),
    STAFF_A_REFRESH_TOKEN: Boolean(process.env.STAFF_A_REFRESH_TOKEN),
    STAFF_B_CALENDAR_ID: Boolean(process.env.STAFF_B_CALENDAR_ID),
    STAFF_B_REFRESH_TOKEN: Boolean(process.env.STAFF_B_REFRESH_TOKEN),
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
