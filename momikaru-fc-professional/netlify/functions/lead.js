/**
 * LPフォーム → FC-BASE 取込API（/api/leads）の中継。
 *
 * ブラウザに LEADS_API_KEY を出さないための中継役で、ここでキーを付ける。
 * 環境変数 FC_BASE_API_KEY は Netlify の管理画面（Site settings → Environment variables）で設定する。
 *
 * 設置手順: fc-base/docs/LP-フォーム設置手順.md（B案）
 */

const FC_BASE_ENDPOINT = "https://fc-base.vercel.app/api/leads";

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return respond(405, { error: "Method Not Allowed" });
  }

  const apiKey = process.env.FC_BASE_API_KEY;
  if (!apiKey) {
    // 設定漏れ。利用者には汎用エラーを見せ、原因はログに残す
    console.error("[lead] FC_BASE_API_KEY が未設定です。Netlify の環境変数を確認してください。");
    return respond(503, { error: "受付処理の設定が完了していません。" });
  }

  try {
    const res = await fetch(FC_BASE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: event.body,
    });

    return {
      statusCode: res.status,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
      body: await res.text(),
    };
  } catch (error) {
    console.error("[lead] FC-BASE への転送に失敗", error);
    return respond(502, { error: "受付処理に失敗しました。時間をおいて再度お試しください。" });
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
