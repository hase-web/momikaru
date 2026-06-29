/**
 * 予約ウィジェット設定
 * デプロイ後: apiBase を fc-booking-api の Netlify URL に変更
 */
window.FC_BOOKING_CONFIG = {
  apiBase: "https://fc-booking-api.netlify.app",

  brand: {
    phone: "09091088725",
    phoneDisplay: "090-9108-8725",
    email: "matsumura@dorami.co.jp",
    businessHours: "平日 10:00〜18:00",
  },

  events: {
    consult: { label: "個別相談", durationMinutes: 30 },
    briefing: { label: "オンライン説明会", durationMinutes: 60 },
  },

  /** 表示名（API の STAFF_A_NAME と揃える） */
  staff: [{ id: "a", name: "松村" }],
};
