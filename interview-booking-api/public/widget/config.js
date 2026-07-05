/**
 * もみかる採用 — 面接予約ウィジェット
 * デプロイ後: apiBase を interview-booking-api の Netlify URL に変更
 */
window.IV_BOOKING_CONFIG = window.FC_BOOKING_CONFIG = {
  apiBase: "https://interview-booking-api.netlify.app",

  brand: {
    phone: "05031721405",
    phoneDisplay: "050-3172-1405",
    email: "matsumura@dorami.co.jp",
    businessHours: "平日 10:00〜19:00",
  },

  events: {
    interview: { label: "面接", durationMinutes: 30 },
    interview_online: { label: "オンライン面接", durationMinutes: 30 },
  },

  /** API の STAFF_A_NAME / STAFF_B_NAME と揃える（2名想定） */
  staff: [
    { id: "a", name: "担当A" },
    { id: "b", name: "担当B" },
  ],

  /** 採用LP向けフォーム */
  formMode: "recruit",
};
