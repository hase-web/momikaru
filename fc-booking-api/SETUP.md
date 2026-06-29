# もみかるFC 予約システム（immedio.io 代替）

Google カレンダーと連携した自社予約 API + LP 埋め込みウィジェットです。  
月額の immedio.io なしで、説明会・個別相談の予約を受け付けられます。

## 構成

```
fc-booking-api/          ← Netlify に単独デプロイ（API + ウィジェット配信）
├── netlify/functions/
│   ├── availability.mjs  … 空き時間取得
│   └── book.mjs          … 予約確定 → Googleカレンダー登録 + Meet URL
└── public/widget/        … 各 FC LP から読み込む JS/CSS

momikaru-fc-company/     ← immedio リンクを予約ウィジェットに差し替え済み
momikaru-fc-personal/
momikaru-fc-professional/
```

## 1. Netlify に API サイトをデプロイ

1. Netlify → **Add new site** → Import from Git
2. リポジトリ: `hase-web/momikaru`
3. **Base directory**: `fc-booking-api`
4. Build command: `npm install`（netlify.toml に記載済み）
5. Publish directory: `public`
6. デプロイ後 URL を控える（例: `https://momikaru-fc-booking.netlify.app`）

### 環境変数（Site settings → Environment variables）

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth クライアント ID | |
| `GOOGLE_CLIENT_SECRET` | クライアントシークレット | |
| `STAFF_A_NAME` | 担当者Aの表示名 | 松村 |
| `STAFF_A_CALENDAR_ID` | Google カレンダー ID（通常はメール） | staff-a@dorami.co.jp |
| `STAFF_A_REFRESH_TOKEN` | 担当Aの OAuth リフレッシュトークン | |
| `STAFF_B_NAME` | 担当者Bの表示名 | |
| `STAFF_B_CALENDAR_ID` | 担当Bのカレンダー ID | |
| `STAFF_B_REFRESH_TOKEN` | 担当Bのリフレッシュトークン | |
| `WORK_START_HOUR` | 営業開始（任意） | 10 |
| `WORK_END_HOUR` | 営業終了（任意） | 18 |
| `WORK_DAYS` | 営業曜日 0=日〜6=土（任意） | 1,2,3,4,5 |
| `ALLOWED_ORIGINS` | CORS 許可ドメイン（カンマ区切り） | https://momikaru-fc-company.netlify.app,https://momikaru-fc-personal.netlify.app |

## 2. Google Cloud の設定

### 2-1. プロジェクト作成

1. [Google Cloud Console](https://console.cloud.google.com/)
2. 新規プロジェクト作成（例: `momikaru-fc-booking`）
3. **API とサービス → ライブラリ** → **Google Calendar API** を有効化

### 2-2. OAuth 同意画面

1. **OAuth 同意画面** → ユーザータイプ: **内部**（Workspace 利用時）または外部
2. スコープ追加:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`

### 2-3. OAuth クライアント

1. **認証情報 → 認証情報を作成 → OAuth クライアント ID**
2. アプリケーションの種類: **ウェブアプリケーション**
3. 承認済みリダイレクト URI: `https://developers.google.com/oauthplayground`（トークン取得用）

### 2-4. 担当者ごとのリフレッシュトークン取得

各営業担当（2名）の Google アカウントで **1回だけ** 実施:

1. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) を開く
2. 右上 ⚙️ → **Use your own OAuth credentials** にチェック → Client ID / Secret を入力
3. Step 1: Calendar API v3 の `https://www.googleapis.com/auth/calendar` を選択 → Authorize
4. 担当者の Google アカウントでログイン・許可
5. Step 2: **Exchange authorization code for tokens**
6. 表示された **Refresh token** を Netlify の `STAFF_A_REFRESH_TOKEN` 等に保存

> Refresh token は再取得が面倒なので、安全な場所にバックアップしてください。

## 3. ウィジェット URL の反映

デプロイ URL が確定したら、以下を更新:

### `fc-booking-api/public/widget/config.js`

```javascript
apiBase: "https://momikaru-fc-booking.netlify.app",
brand: { phone: "...", email: "matsumura@dorami.co.jp", ... },
staff: [
  { id: "a", name: "担当者名A" },
  { id: "b", name: "担当者名B" },
],
```

### 各 FC LP の `</body>` 直前（すでに埋め込み済みの場合は URL のみ確認）

```html
<link rel="stylesheet" href="https://momikaru-fc-booking.netlify.app/widget/booking.css">
<script src="https://momikaru-fc-booking.netlify.app/widget/config.js"></script>
<script src="https://momikaru-fc-booking.netlify.app/widget/booking.js"></script>
```

## 4. 動作確認

```bash
# 空き時間 API
curl "https://momikaru-fc-booking.netlify.app/.netlify/functions/availability?eventType=consult&staffId=any"

# 予約 API（テスト）
curl -X POST "https://momikaru-fc-booking.netlify.app/.netlify/functions/book" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"consult","start":"2026-07-01T01:00:00.000Z","name":"テスト","email":"test@example.com"}'
```

LP 上で「個別相談を申し込む」→ モーダル → 日時選択 → 予約確定 → Google カレンダーにイベント + Meet URL

## 5. immedio 解約のタイミング

- [ ] Netlify API デプロイ完了
- [ ] 環境変数・リフレッシュトークン設定済み
- [ ] 3つの FC LP でテスト予約成功
- [ ] 担当2名のカレンダーに正しく入ることを確認
- [ ] 確認メール・Meet URL が届くことを確認
- [ ] **その後** immedio.io を解約

## 機能一覧（immedio 代替）

| 機能 | 対応 |
|------|------|
| 空き時間表示 | Google Calendar freeBusy API |
| 予約確定 | カレンダーにイベント作成 |
| Google Meet | 自動生成 |
| 担当2名 | 個別選択 or 自動割当 |
| 説明会 60分 / 相談 30分 | `briefing` / `consult` |
| リマインド | カレンダー標準（24h前メール + 1h前ポップアップ） |
| ダブルブッキング防止 | 予約直前の再チェック |
| 電話・メール fallback | ウィジェット内に表示 |

## トラブルシューティング

**空きが0件しか出ない**  
→ `WORK_START_HOUR` / `WORK_DAYS` を確認。カレンダーが終日ビジーになっていないか確認。

**403 / invalid_grant**  
→ リフレッシュトークンの再取得。OAuth 同意画面の公開状態を確認。

**CORS エラー**  
→ `ALLOWED_ORIGINS` に LP の Netlify URL を追加。

**Meet URL が付かない**  
→ Google Workspace アカウントが必要な場合があります。個人 Gmail でも多くは動作します。

## 月額コスト

| サービス | 費用 |
|----------|------|
| Netlify Functions | 無料枠内（月125kリクエスト） |
| Google Calendar API | 無料 |
| immedio.io | **解約可** |
