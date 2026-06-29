/**
 * 予約ウィジェット設定
 * デプロイ後: apiBase を fc-booking-api の Netlify URL に変更
 */
window.FC_BOOKING_CONFIG = {
  apiBase: "https://fc-booking-api.netlify.app",

  brand: {
    phone: "0120-000-000",
    phoneDisplay: "0120-000-000",
    email: "matsumura@dorami.co.jp",
    businessHours: "平日 10:00〜18:00",
  },

  events: {
    consult: { label: "個別相談", durationMinutes: 30 },
    briefing: { label: "オンライン説明会", durationMinutes: 60 },
  },

  /** 表示名（API の STAFF_A_NAME 等と揃える） */
  staff: [
    { id: "a", name: "担当A" },
    { id: "b", name: "担当B" },
  ],
};
