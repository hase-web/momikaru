# もみかる採用 — 面接予約 API

FC 予約 API（`fc-booking-api`）をベースにした、**採用面接 1対1 予約** システムです。  
面接官2名の Google カレンダーを統合し、**どちらかが空いている時間**だけを表示します。

## 構成

```
interview-booking-api/     ← Netlify に単独デプロイ
momikaru-recruit/          ← 採用 LP（ウィジェット埋め込み）
  osteo.html / mom.html / relax.html / esthe.html / side-job.html
```

## 1. Netlify に API サイトをデプロイ

1. Netlify → **Add new site** → Import from Git
2. リポジトリ: `hase-web/momikaru`
3. **Base directory**: `interview-booking-api`
4. デプロイ後 URL を控える（例: `https://interview-booking-api.netlify.app`）
5. `public/widget/config.js` の `apiBase` をその URL に合わせる

## 2. 環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `GOOGLE_CLIENT_ID` | OAuth クライアント ID（FC と同じ Google Cloud 可） | |
| `GOOGLE_CLIENT_SECRET` | クライアントシークレット | |
| `STAFF_A_NAME` | 面接官Aの表示名 | 田中 |
| `STAFF_A_CALENDAR_ID` | 面接官Aの Gmail | |
| `STAFF_A_REFRESH_TOKEN` | calendar + gmail.send 付き Token | |
| `STAFF_A_NOTIFY_EMAIL` | 通知メール（任意） | |
| `STAFF_B_NAME` | 面接官B | |
| `STAFF_B_CALENDAR_ID` | 面接官Bの Gmail | |
| `STAFF_B_REFRESH_TOKEN` | 面接官Bの Token | |
| `STAFF_B_NOTIFY_EMAIL` | 通知メール（任意） | |
| `BRAND_LABEL` | カレンダー・メールのプレフィックス | `【もみかる採用】` |
| `EVENT_INTERVIEW_MINUTES` | 面接時間（分） | `30` |
| `WORK_START_HOUR` | 受付開始 | `10` |
| `WORK_END_HOUR` | 受付終了 | `19` |
| `WORK_DAYS` | 曜日 0=日〜6=土 | `1,2,3,4,5` |
| `ALLOWED_ORIGINS` | CORS 許可（下記） | |

### ALLOWED_ORIGINS（採用 LP）

```
https://momikaru-recruit.netlify.app
```

パス（`/osteo` など）は不要。**ドメイン1つ**で全ページをカバーします。

## 3. 面接官の Refresh Token

各面接官が **自分の Google アカウント** で OAuth Playground から取得:

1. ⚙️ → **Use your own OAuth credentials**
2. スコープ（1行）:
   ```
   https://www.googleapis.com/auth/calendar,https://www.googleapis.com/auth/gmail.send
   ```
3. Gmail API が Google Cloud で **有効** であること

## 4. 空き時間のロジック

- 面接官A・B それぞれの `freeBusy` を取得
- 営業時間内で **予定が入っていない枠** を計算
- `staffId=any`（デフォルト）→ **どちらか空いていれば表示**
- 予約確定 → 空いている面接官のカレンダーに登録 + Meet URL

## 5. 採用 LP への埋め込み

各 LP の `</body>` 直前:

```html
<link rel="stylesheet" href="https://interview-booking-api.netlify.app/widget/booking.css?v=1">
<script src="https://interview-booking-api.netlify.app/widget/config.js?v=1"></script>
<script src="https://interview-booking-api.netlify.app/widget/booking.js?v=1"></script>
```

ボタン例:

```html
<a href="#iv-booking" class="btn btn--primary iv-booking-open" data-iv-job="整骨・整体">
  面接予約
</a>
```

## 6. 動作確認

```
https://interview-booking-api.netlify.app/.netlify/functions/debug
https://interview-booking-api.netlify.app/.netlify/functions/availability?eventType=interview&staffId=any
```

## FC 予約 API との関係

| | fc-booking-api | interview-booking-api |
|--|----------------|----------------------|
| 用途 | FC 説明会・個別相談 | 採用面接 |
| Netlify | 別サイト | 別サイト |
| 環境変数 | 独立 | 独立 |
| Google Cloud | 共有可能 | 共有可能 |

**同じ Netlify サイトに混ぜない** — 担当者・CORS・イベント種別が異なるため。
