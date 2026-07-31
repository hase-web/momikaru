/**
 * もみかる採用 — 面接予約ウィジェット
 * デプロイ後: apiBase を interview-booking-api の Netlify URL に変更
 */
window.IV_BOOKING_CONFIG = window.FC_BOOKING_CONFIG = {
  apiBase: "https://interview-booking-api.netlify.app",

  brand: {
    phone: "",
    phoneDisplay: "",
    email: "wakamori@dorami.co.jp",
    businessHours: "平日 10:00〜19:00",
  },

  events: {
    interview: { label: "面接", durationMinutes: 30 },
    interview_online: { label: "オンライン面接", durationMinutes: 30 },
  },

  /** API の STAFF_A（若森）と揃える */
  staff: [{ id: "a", name: "若森" }],

  /** 採用LP向けフォーム */
  formMode: "recruit",
};
