# SPEC — momikaru-recruit 店舗軸の追加

> 作業を再開するときは、必ずこのファイルを最初に読むこと。仕様と進捗はすべてここに記録する。

## 0. 進捗

| 日付 | 状態 | 内容 |
|---|---|---|
| 2026-10-08 | 完了 | 現状調査、SPEC.md 作成、雇用連想表現の洗い出し（§6） |
| 2026-10-08 | 承認 | 実装方針の承認と回答を受領（§8）。実装を開始 |
| 2026-10-08 | 完了 | `data/stores.json` を受領（v0.1、4店舗）。内容の確認結果は §7 |
| 2026-10-08 | 完了 | stores.json に仮の attributes、updated_at、shift の文言を反映（§8） |
| 2026-10-08 | 完了 | 実装とローカル確認（§9）。コミットとデプロイは未実施 |
| 2026-10-08 | 完了 | 修正依頼5件に対応（§10）。T1、T3、T5、T6 は §10 の決定で置き換え |
| 2026-10-08 | 完了 | 修正依頼4件に対応（§11） |
| 2026-10-08 | 完了 | 店舗ごとの制度（benefits）の仕組みを導入。kyosai を店舗データで出し分け、「業界初」を「業界でも珍しい」に変更（§12） |
| 2026-10-08 | 完了 | 悩みの描写も kyosai で出し分け、店舗データの同期読み込みでずれを解消、電話受付時間を統一（§13） |
| 2026-10-08 | 完了 | store-recruit ブランチにコミット・push（f05d95c、空コミット 90a5e87・9ece91c）。Netlify ブランチデプロイで公開を確認（§14）。main へのマージはしていない |
| 2026-10-08 | 完了 | JobPosting を1ページ1件に統合、URL を末尾スラッシュなしに統一（§15） |
| 2026-10-08 | 完了 | 募集なし店舗の扱い、郵便番号の取得、.html 付きURLの 301、差し替え用 .htaccess（§16） |
| 2026-10-08 | 完了 | プレビューで §16 の3点を確認（下記）。差し替え後の基準を https://www.momikaru.com/recruit に統一（§17） |

## 1. 目的と前提

- 店舗軸を追加する。試験対象は直営4店舗（`data/stores.json`）だけ
- 最終的には www.momikaru.com/recruit/ と差し替える前提で作る
- 完了条件：4店舗分のページを生成し、ローカルで表示を確認できる状態にする。**コミットとデプロイはしない**

### 厳守事項
- 変更するのは `momikaru-recruit/` 内だけ。`momikaru-recruit-deploy` と `momikaru-recruit-ai` は参照もしない
- 既存の index.html と属性LP（osteo, mom, relax, esthe, side-job, owner）の**文章とデザインは変更しない**
- owner.html は店舗展開の対象外
- 店舗情報のデータ源は `data/stores.json` だけにする
- LINE リンクは今回変更しない（次フェーズで対応）

### URL構造（差し替え後を想定）
| URL | 中身 |
|---|---|
| `/recruit/` | フェイス（index.html） |
| `/recruit/{属性}/` | 属性LP（osteo / mom / relax / esthe / side-job / owner） |
| `/recruit/stores/{store_id}/` | 店舗別ページ。store_id は momikaru.com の既存店舗ページと同じスラッグ |

## 2. 実装内容（依頼原文の要約）

1. サイト全体を noindex にする（試験中、既存の www.momikaru.com/recruit/ との重複を避けるため）
2. 店舗別ページを静的に生成する
   - オンになっている属性のセクションだけ表示する
   - sub_locations がある店舗は勤務地を併記する
   - 求人の構造化データ JobPosting を出力する。employmentType は `CONTRACTOR`、jobLocation には sub_locations も含める
3. 属性LPに `?store={store_id}` で店舗条件を差し込む
   - canonical は店舗パラメータなしの属性LPに向ける
   - その店舗で属性がオフなら、同じ属性を募集中の近隣店舗を案内する（近隣がなければ店舗一覧へ）
4. 応募ボタンは store_id と属性を保持する（遷移先は今のまま）
5. フェイスページに店舗検索を追加する
6. 契約形態が業務委託なので、雇用を連想させる表現を既存LPも含めて洗い出し、一覧で報告する（修正はしない）→ §6

## 3. 現状調査（2026-10-08）

### 3.1 ファイル構成（momikaru-recruit/）
```
index.html          フェイス（診断クイズ → 属性LPへ誘導）
osteo.html mom.html relax.html esthe.html side-job.html owner.html   属性LP
support.js          Claude Design の dc-runtime（生成物。編集禁止）
image-slot.js       Claude Design（omelette）の <image-slot> 画像枠コンポーネント
assets/             画像（hero, manga, cards, voice など）
comic_*.png, momikaru-comic.png, momikaru-logo.*   ルート直下の画像。HTML からは未参照（要確認）
CLAUDE_CODE_PROMPT.md   osteo.html 初版の実装プロンプト（旧方針）
data/               空（stores.json の置き場所）
.claude/settings.local.json   python3 の実行を許可
```
- `netlify.toml`、`_redirects`、`_headers` はない（フォルダ内、リポジトリ直下、git 履歴のいずれにもない）
- 2026-10-01 に `momikaru-recruit/netlify 2/`（index.html, support.js, assets）を削除済み

### 3.2 support.js（dc-runtime）
- 先頭に `GENERATED from dc-runtime/src/*.ts — do not edit` とある。Claude Design のエクスポート用ランタイム
- 各ページの `<x-dc>` 内がテンプレート、`<script type="text/x-dc" data-dc-script>` 内がロジック（`class Component extends DCLogic`）
- 読み込み時に React / ReactDOM の UMD を CDN から SRI 付きで読み込み、`x-dc` を `createRoot` した要素に置き換えて**クライアント側で描画**する
- つまり HTML の素のソースには本文がなく、JS が動かないと何も表示されない（SEO と構造化データの観点で重要）
- `<helmet>` 内の title、meta、link、style はランタイムが head に反映する

### 3.3 テンプレート記法 `{{ }}`
- `{{ expr }}` は、ロジックの `renderVals()` が返すオブジェクトのキーを参照する（例：`{{ introShow }}`、`{{ d.slot }}`）
- 制御構文：`<sc-if value="{{ cond }}">`、`<sc-for>` 相当のループ（`walkFor`）、`style-hover="..."` によるホバースタイル
- イベント：`onClick="{{ openBooking }}"` のように関数を渡す
- `data-props`（JSON）で、エディタから切り替えられる props（intro, stickyBar など）を定義する

### 3.4 image-slot.js
- `<image-slot id src shape radius placeholder>` は画像枠のカスタム要素
- omelette（Claude Design）上ではドロップした画像を `.image-slots.state.json` に保存する。公開環境では読み取り専用で、サイドカーがなければ `src` を表示する
- index.html は読み込んでいない。属性LP6本が読み込んでいる

### 3.5 ビルド
- **ビルド工程はない**。HTML、JS、画像をそのまま静的に配信している
- 環境：node v24.18.0、python3 3.9.6

### 3.6 Netlify 公開設定（コードから分かる範囲）
- 公開URL：`https://momikaru-recruit.netlify.app/`（各ページの BASE とリンクにハードコード）
- index.html は LP へのリンクを `BASE + '/osteo'` のように拡張子なしで張っている → Netlify の Pretty URLs（`/osteo` → `osteo.html`）に依存
- 設定ファイルがないため、Base directory や Publish directory は Netlify 管理画面の設定（`momikaru-recruit` を公開していると推定）。**要確認**
- 公開ディレクトリにあるものはすべて配信される（SPEC.md と CLAUDE_CODE_PROMPT.md も含む）

### 3.7 既存の導線
- 応募ボタン：`openBooking` → `window.IVBooking.open({ eventType:'interview_online', jobCategory:'接骨院・鍼灸' })`（interview-booking-api の widget）。widget が読み込めなければ LINE（`https://lin.ee/PFy8myp`）へ遷移
- widget の `open()` が受け付けるのは `eventType`、`staffId`、`jobCategory` だけ。送信ペイロードの `source` は `document.title`。**店舗用のフィールドはない**
- jobCategory は LP ごとに固定：接骨院・鍼灸 / 未経験（ママ・主婦）/ リラクゼーション / エステ / 副業（本業と両立）/ 独立・FC
- 診断結果は `localStorage['momikaru-recruit-v2-result']` に保存し、LP 側で `fromQuiz` 表示に使っている
- 電話番号は `054-285-5665`（全ページ共通）

### 3.8 CLAUDE_CODE_PROMPT.md との矛盾
| 旧方針（CLAUDE_CODE_PROMPT.md） | 現状と今回の依頼 |
|---|---|
| 単一HTMLファイル。CSS と JS はすべて同ファイル内、外部依存は Google Fonts だけ | 現状は support.js、image-slot.js、React CDN、booking widget に依存。今回もデータ JSON と共通スクリプトを追加する |
| localStorage / sessionStorage は使用禁止 | 現状 index.html と全LPが localStorage を使用中 |
| ストック画像・写真は使用禁止。すべて自作SVG | 現状は assets/ の写真（staff.jpg, store-interior.jpg, manga など）を使用 |
| デザイントークンはベージュ×朱色、Cormorant Garamond | 現状は紺 #1A1A2E × 黄 #F5B800、Inter / Roboto Mono |
| 7属性（single-mom / housewife を含む） | 現状は6LP（mom に統合、housewife はない） |
| 統計値は136店舗、14技術 | 現状の osteo は131店舗、15メニュー |
| 「採用LP」「応募」という表現 | 今回は業務委託の観点で雇用連想表現を洗い出す対象 |

→ CLAUDE_CODE_PROMPT.md は osteo 初版の歴史資料で、現行の実装とはすでに乖離している。今回の方針は「現行実装（dc-runtime 版）に合わせる」とする（要承認）。

## 4. 実装方針（案・承認待ち）

### 4.1 生成方式
- `tools/build-stores.mjs`（Node。依存パッケージなし）で `data/stores.json` を読み、`stores/{store_id}/index.html` と `stores/index.html`（店舗一覧）を**素のHTML**で生成する
  - dc-runtime を使わない理由：本文と JobPosting を JS なしで読める HTML に出すため
  - デザインは既存トークン（#1A1A2E、#F5B800、Noto Sans/Serif JP、Inter）に合わせる
- 属性LPと index から使う共通スクリプト `store-context.js` を新規に作る。stores.json を fetch して使う
- 属性ごとの紹介文は、各LPの既存コピーから抜粋して再利用する（新しいコピーは最小限にする）

### 4.2 既存HTMLへの変更（文章とデザインには触れない、最小限の追加だけ）
各LPの素の `<head>`（x-dc の外）に次を追加する：
- `<meta name="robots" content="noindex, nofollow">`
- `<link rel="canonical" href="{SITE_BASE}/{属性}/">`（クエリなしの自分自身）
- `<script src="./store-context.js" defer></script>`

store-context.js の動き（?store= があるときだけ）：
- React 管理外の要素として、店舗の帯（店舗名、勤務地、店舗ページへのリンク）を body の先頭に差し込む
- 属性がオフの店舗なら、近隣で同じ属性を募集中の店舗を案内する（なければ店舗一覧へ）
- `window.IVBooking.open` をラップし、jobCategory に店舗を付ける（例：`接骨院・鍼灸｜静岡店 [store:shizuoka]`）。LP のロジックは書き換えない
- owner.html にはスクリプトを入れない（noindex と canonical だけ追加）

### 4.3 noindex
- 上記の meta に加えて、`_headers` で `X-Robots-Tag: noindex` を全パスに付ける（JS 非実行のクローラ対策）。Netlify の公開ディレクトリが momikaru-recruit であることが前提

### 4.4 JobPosting
- 店舗×オンの属性ごとに1件（または店舗で1件、jobLocation は複数）
- `employmentType: "CONTRACTOR"`、`hiringOrganization`（株式会社ドラミカンパニー / もみかる）、`jobLocation` は本店舗と sub_locations の PostalAddress、`datePosted`、`validThrough`、`directApply: false`
- 歩合制のため `baseSalary` は stores.json に値があるときだけ出す

### 4.5 近隣店舗
- stores.json の緯度経度から距離を計算し、同じ属性がオンの店舗を近い順に最大3件出す。しきい値（例：30km）を超えたら「近隣なし」とし、店舗一覧へ誘導する

### 4.6 フェイスの店舗検索
- index.html の既存要素は変更しない。store-context.js で、x-dc の外（フッターの直前）に店舗検索ブロックを差し込む（エリア・店舗名の絞り込み → 店舗ページへ）

### 4.7 ローカル確認
- `tools/serve.mjs`：Pretty URLs（`/osteo` → `osteo.html`、`/stores/x/` → `stores/x/index.html`）を再現する簡易サーバー
- リンクの基点は `SITE_BASE`（ビルド設定）で切り替える：ローカルは `''`、試験環境は `https://momikaru-recruit.netlify.app`、本番は `https://www.momikaru.com/recruit`

### 4.8 stores.json の想定スキーマ（実ファイルを受け取ったら合わせる）
```json
{
  "stores": [{
    "store_id": "shizuoka",
    "name": "もみかる 静岡店",
    "area": "静岡市",
    "address": { "postal": "", "region": "静岡県", "locality": "", "street": "" },
    "geo": { "lat": 0, "lng": 0 },
    "attributes": { "osteo": true, "mom": true, "relax": true, "esthe": false, "side-job": true },
    "sub_locations": [{ "name": "", "address": {} }],
    "hours": "", "access": "", "url": "https://momikaru.com/..."
  }]
}
```

## 5. 未決事項（承認時に決めること）
1. stores.json の入手 → 受領済み。ただし未入力の項目がある（§7）
2. Netlify の Base / Publish directory の設定値、Pretty URLs が有効か
3. canonical と JobPosting の URL の基点：試験ドメインにするか、本番の `www.momikaru.com/recruit` にするか
4. 応募時の店舗の受け渡し：jobCategory に付ける案でよいか（widget 側の改修は対象外）
5. 店舗の帯や近隣案内を LP に「追加」すること、index に検索ブロックを「追加」することは、「デザインを変更しない」に抵触しないか
6. SPEC.md と CLAUDE_CODE_PROMPT.md が公開ディレクトリから配信される問題（`_redirects` で 404 にするか）

## 6. 雇用連想表現の洗い出し（修正はしない）

対象：index と6LP。分類 A は**もみかる自身の条件や手続きとして使われているもの**（要検討）、分類 B は読者の現職・他社との対比として使われているもの（文脈上は問題が小さい）。

### A. もみかる側の表現として使われているもの
| 表現 | 箇所 | 備考 |
|---|---|---|
| 採用 | 全7ページの `<title>`「もみかる採用｜…」 | ブランド名・タイトル |
| 時給 | side-job L98「時給の目安」、L151、L216「もみかるの時給は…」、L248、L424「時給の目安 2,500〜4,000円」、L593 | **最も強い**。報酬を時給換算で表示している |
| 勤務日数 | osteo L258、mom L249、relax L354、side-job L298、index L373「収入は勤務日数・店舗・時期により異なります」 | 注記の定型文 |
| 勤務日 | osteo L407、esthe L505 の FAQ「勤務日や時間は決められていますか？」 | 回答は「稼働日」と表現 |
| シフト | index L266「シフトも働く日数も、ご自身で決められます」、L340「自由シフト」、L343・L375「完全自由シフト」、side-job L12・L84・L429「シフトは完全自由」、relax L586「シフトの組み方は面接でご相談ください」 | 自社の働き方をシフトと表現 |
| 面接 | 全LPのCTA「面接を予約する」「WEB面接」、FLOW「30分の面接」、FAQ「面接でご説明します」（計64件） | 雇用の選考を連想させる。「面談」「相談」が候補 |
| 応募 | index L230「応募の前に、よく聞かれる4つのこと」、relax L498「応募の前に…」 | 各LPの「応募ではなく、相談から」は対比なので B |
| 研修 / 制服費用 | 全LP FLOW「研修費・登録料・制服費用は無料」、FAQ | 「研修」「制服」は指揮命令を連想させうる（偽装請負の論点）。要法務確認 |
| 店長とスタッフ | owner L410（コアオーナー段階の説明） | 加盟店側の雇用なので問題は小さい |
| 働く／働ける | 多数（49件） | 一般語なので優先度は低い |
| 「出勤」 | 該当なし | — |

### B. 対比・ストーリー文脈（読者の現職を描写）
- osteo：固定給・昇給・給料・給与明細（STORY、ANSWER_01）、「勤務の整骨院」、「整骨院勤務の年収」、「シフトは院が決める」
- mom：パートの時給、シフト制のパート、職場、「業務委託って、パートと何が違うの？」（雇用ではないと明記）
- esthe：正社員・シフト制、転職でリセット
- side-job：会社員の給料・昇給・給与明細、バイトの時給1,000円、固定シフト、残業、定休日
- relax：退職してゼロから開業、シフトと予約表（STORY）
- owner：給料、今の職場、シフト
- index：「業務委託って、アルバイトとどう違うの？」（雇用契約ではないと明記）
- 全LP STORY 最終コマ「そっと求人を開く」、FLOW「求人情報には書かれない」

（行番号は 2026-10-08 時点。詳細な抽出結果は調査スクリプトの出力による）

## 7. data/stores.json（v0.1）の確認結果（2026-10-08）

店舗：nishiwaki（総本店／静岡市駿河区）、ryutsudori（流通通り店／静岡市葵区）、toyama（富山本店／富山市、sub_locations にリラックス館）、gifu（岐阜長良店／岐阜市）

### §4.8 の想定スキーマとの差分（実データに合わせる）
- 店舗名は `store_name`（`name` ではない）。郵便番号は `address.postal_code`
- 追加項目：`store_type`、`operator`、`contract_type`、`pay`、`shift`、`photos`、`voice`、`apply_to`、`official_url`、`business_hours`、`updated_by`、`updated_at`
- sub_locations は `name`、`official_url`、`address`、`note` を持つ

### 未入力の項目
| 項目 | 状況 | 影響 |
|---|---|---|
| `attributes` | 全4店舗、全属性が null | **オンの属性だけ表示、近隣案内、JobPosting の件数が決まらない（ブロッカー）** |
| `geo.lat` / `geo.lng` | 全店舗 null | 近隣店舗の距離計算ができない |
| `address.postal_code` | 全店舗 TODO | JobPosting の postalCode を出せない（任意項目なので省略は可能） |
| `pay` | 全店舗 TODO | 報酬の表示と JobPosting の baseSalary を出せない |
| `business_hours` | nishiwaki、toyama が TODO | 表示しない |
| `access` | gifu が TODO | 表示しない |
| `updated_at` | 全店舗が空 | JobPosting の datePosted の根拠がない |
| `photos` / `voice` | 一部、または全店舗が空 | 写真のない店舗は写真なしのレイアウトにする |

### その他の注意点
- `apply_to` の LINE（`lin.ee/XzuQHup`）と電話（080-4152-5665）は、既存LPの LINE（`lin.ee/PFy8myp`）と電話（054-285-5665）と違う。LINE は今回変更しない方針なので、店舗ページの LINE と電話をどちらにするか要確認
- `shift: "自由シフト"` は §6 の雇用連想表現にあたる（データ側の文言）
- `photos` は momikaru.com 上の画像を直接参照（ホットリンク）する
- 近隣候補：静岡の2店舗（駿河区と葵区）は互いに近隣。富山と岐阜は、試験の4店舗の中に近隣がない → 店舗一覧へ誘導する

## 8. 決定事項（2026-10-08 オーナー回答）

| # | 決定 |
|---|---|
| D1 | 営業時間、アクセスが TODO の店舗は非表示 |
| D2 | datePosted は全店 2026-10-08。stores.json の updated_at も同日 |
| D3 | 連絡先を正規の求人用に統一：LINE `https://lin.ee/XzuQHup`、電話 `080-4152-5665`。既存LPを含む全ページで置き換える（**連絡先の置き換えだけ「既存LPを変更しない」の例外**）。最後に旧 LINE `lin.ee/PFy8myp` と旧電話 `054-285-5665` の残存を検索して報告する |
| D4 | shift の文言は「稼働日時はご自身で自由に決められます」。stores.json も同じ文言 |
| D5 | attributes は仮設定：総本店（nishiwaki）は mom だけ false、他はすべて true。流通通り店、富山本店、岐阜長良店はすべて true |
| D6 | 報酬（pay）は非表示。JobPosting の baseSalary も出さない |
| D7 | コミットとデプロイはしない |

### 回答がなかった項目への暫定判断（実装者判断。変更は容易）
| # | 暫定判断 |
|---|---|
| T1 | **（§10 で置き換え）** canonical と JobPosting の URL は本番を想定した `https://www.momikaru.com/recruit` を基点にする（試験中は noindex なので影響なし。差し替え時に書き換え不要） |
| T2 | 応募時の店舗の受け渡しは、IVBooking.open をラップして jobCategory に店舗名と store_id を付ける（widget は改修しない） |
| T3 | **（§10 で置き換え）** 近隣判定：geo が null なので同じ都道府県（address.region）で判定する。geo が入れば30km以内を優先 |
| T4 | 店舗の帯は LP の React 描画領域の外（body 先頭）に差し込む。index の店舗検索は、テンプレートに空のマウント要素を1つ追加して、そこへ描画する |
| T5 | **（§10 で置き換え）** SPEC.md などが公開される問題には今回対応しない（_redirects は作らない） |
| T6 | **（§10 で拡張）** 内部リンクは相対パスにする（`../../osteo?store=…`）。netlify.app でも /recruit/ 配下でも動く |

## 9. 実装内容と確認結果（2026-10-08）

### 使い方
```
node tools/build-stores.mjs     # stores.json → stores/ を再生成（stores.json を更新したら毎回）
node tools/serve.mjs 8080       # http://localhost:8080/ でローカル確認（Pretty URLs を再現）
```

### 追加したファイル
| ファイル | 役割 |
|---|---|
| `data/attributes.json` | 属性ごとの表示用メタ（title、tagline、points、jobCategory）。index の PATHS から転記。mom と side-job の「自由シフト」「完全自由シフト」だけ言い換え |
| `store-context.js` | LP の `?store=` 差し込み（店舗の帯、属性オフ時の近隣案内、応募時の店舗の受け渡し）と、index の店舗検索 |
| `tools/build-stores.mjs` | 店舗ページの静的生成。stores.json の検証（attributes が boolean か、updated_at があるか、store_id の形式と重複）付き |
| `tools/serve.mjs` | ローカル確認サーバー |
| `_headers` | 全パスに `X-Robots-Tag: noindex, nofollow` |
| `stores/index.html`、`stores/{nishiwaki,ryutsudori,toyama,gifu}/index.html` | 生成物（手で編集しない） |

### 既存ファイルへの変更（これだけ。元ファイルとの比較で確認済み）
- 全7ページの `<head>`：`<meta name="robots" content="noindex, nofollow">` と canonical（`https://www.momikaru.com/recruit/{属性}/`）を追加
- index と5LPに store-context.js の読み込みを追加（owner には入れない）
- index.html：「6つの働き方から、直接選ぶ。」の直後に `<div id="store-search-mount"></div>` を1行追加
- 連絡先の置き換え（D3）：LINE `PFy8myp` → `XzuQHup`、`tel:0542855665` → `tel:08041525665`、表示の `054-285-5665` → `080-4152-5665`（各ページの header、CTA、sticky、openBooking の LINE フォールバック）
- `data/stores.json`：attributes、updated_at、shift（D2、D4、D5）

### 確認結果（ローカル、Chrome）
- 店舗ページ4件：表示 OK。オンの属性だけ表示（総本店は mom なしで4件）。富山は勤務地2か所を併記
- JobPosting：オンの属性ごとに1件（総本店4件、他店5件）。CONTRACTOR、datePosted 2026-10-08、baseSalary なし、富山の jobLocation にリラックス館を含む。JSON として正しく読める
- 店舗ページの応募ボタン：jobCategory が「{属性}｜{店舗名}（store:{id}）」
- LP `?store=`：店舗の帯を表示。`/mom?store=nishiwaki` では募集なしの案内と、近隣の流通通り店（`/mom?store=ryutsudori`）を表示。LP の応募ボタン（IVBooking.open）の jobCategory に店舗が付く（実際の widget にもラップが掛かることを確認）
- canonical と robots：LP で確認
- index の店舗検索：キーワード（静岡 → 2件、リラックス館 → 富山）、地域、働き方の絞り込み、0件表示 OK
- 近隣なしの分岐：現データでは発生しないため、ロジック単体でテスト（富山を仮にオフにすると近隣0件 → 店舗一覧へ誘導）
- コンソールエラーなし
- 旧連絡先の残存検索：HTML、JS、JSON には残っていない。SPEC.md の記録文中だけに残る
- **未確認**：スマホ幅での見た目（ブラウザのウィンドウ幅を変更できなかった）。レイアウトは既存LPと同じ auto-fit グリッドと 16px 余白

## 10. 修正（2026-10-08 オーナー依頼）

| # | 依頼 | 対応 |
|---|---|---|
| R1 | SPEC.md、CLAUDE_CODE_PROMPT.md、tools/ を 404 にする | `_redirects` に `404!`（ファイルがあっても強制）で4ルールを追加。`404.html`（noindex）を新規作成。`data/` は store-context.js が読むので公開のまま |
| R2 | 既存LP内の netlify.app への絶対リンクを相対リンクにし、?store= を引き継ぐ | 全LPの `https://momikaru-recruit.netlify.app/` → `./`、`/owner` → `./owner`、index の `const BASE` → `'.'`（計18か所）。引き継ぎは store-context.js の `carryStore`：押された瞬間に href へ `?store=` を付ける。owner、店舗ページ、data、assets、外部リンクは対象外。index に `?store=` があるときも、LP へのリンクに引き継ぐ |
| R3 | 基準ドメインを設定ファイル1か所で切り替える。試験中は netlify.app | `tools/site.config.json` の `siteBase`（現在 `https://momikaru-recruit.netlify.app`）と `trailingSlash`（現在 false）。`node tools/build-stores.mjs` で、店舗ページの canonical と JobPosting の url・logo、既存7ページの canonical の href に反映する。ほかのソースには基準URLを書いていない（grep で確認） |
| R4 | 国土地理院 住所検索APIで緯度経度を取得し、近隣判定を距離ベースにする | `tools/geocode-stores.mjs` を追加。番地までで検索（建物名・階数は除く）。5件とも候補1件で住所が一致。stores.json の `geo`（sub_locations にも `geo` を追加）。近隣判定は30km以内を近い順に最大3件、地域による代替判定は削除。build で geo を必須に検証。JobPosting の Place に GeoCoordinates を追加 |

### 取得した緯度経度（国土地理院）
| 店舗 | 検索語 | 一致した住所 | lat, lng |
|---|---|---|---|
| 総本店 | 静岡県静岡市駿河区西脇11-1 | 西脇１１番地 | 34.950562, 138.395966 |
| 流通通り店 | 静岡県静岡市葵区東千代田2丁目1-26 | 東千代田二丁目１番２６号 | 35.00238, 138.406616 |
| 富山本店 | 富山県富山市二口町4丁目4-2 | 二口町四丁目４番（街区レベル） | 36.668152, 137.206375 |
| 富山本店 リラックス館 | 富山県富山市二口町4丁目9-10 | 二口町四丁目９番（街区レベル） | 36.668674, 137.205093 |
| 岐阜長良店 | 岐阜県岐阜市長良東2丁目37 | 長良東二丁目３７番地 | 35.450027, 136.786331 |

店舗間の距離：総本店–流通通り店 5.8km（近隣）、そのほかの組み合わせはすべて140km以上（近隣なし）

### 確認（ローカル）
- 404：/SPEC.md、/CLAUDE_CODE_PROMPT.md、/tools、/tools/*、/_redirects、/_headers。公開のまま：/data/stores.json、/store-context.js、各ページ
- 引き継ぎ：`/osteo?store=gifu` でトップへのリンクが `?store=gifu` 付きになり、owner はそのまま。`/?store=ryutsudori` で5LPへのリンクに引き継がれ、owner はそのまま
- `/mom?store=nishiwaki`：距離判定で流通通り店（5.8km）を案内。富山、岐阜を仮にオフにすると近隣0件 → 店舗一覧へ誘導（ロジック単体テスト）
- コンソールエラーなし

### 差し替え時の注意
- 既存LPは画像・JS・リンクをすべて `./` 相対で参照している。`/recruit/osteo/`（末尾スラッシュのディレクトリ）で配信する場合は、各LPをディレクトリ化して相対パスを `../` に直す必要がある（今回の相対リンクも同じ扱い）。`/recruit/osteo`（スラッシュなし）で配信するなら変更は不要

## 11. 修正（2026-10-08 オーナー依頼 その2）

| # | 依頼 | 対応 |
|---|---|---|
| R5 | 募集していない属性で開いた場合は、店舗帯と応募ボタンから店舗指定を外す。案内帯で近隣店舗を選んだときだけ店舗指定にする | store-context.js の runLp：属性がオフなら店舗帯を出さず、IVBooking の jobCategory への付与もサイト内リンクへの `?store=` 引き継ぎもしない。近隣ボタンは `{属性}?store={近隣ID}` へのリンクで、遷移先では通常どおり店舗指定になる。店舗の付与は「募集中」と確認できてから有効にする（データ取得前の暫定付与は廃止） |
| R6 | 案内帯をコンパクトにし、スマホ幅で最初の画面にヒーローが半分以上見えるようにする | 1行のメッセージ（「{店舗名}では「{属性}」の募集はありません。近くの店舗：」。店舗名の「もみかる」は省略）＋近隣店舗ボタン（最大3件）＋「店舗一覧」のテキストリンク。近隣がなければ「店舗一覧から探す →」だけ |
| R7 | 店舗ページの「直営」表記を非表示にする | build-stores.mjs の見出しラベルを `STORE_{ID}` だけにした。store_type は stores.json に残している |
| R8 | 既存LP内の「業界初」「第三者機関」「共済」を一覧報告する（修正はしない） | 下表 |

### R6 の実測（390×844 の iframe、/mom?store=nishiwaki）
- 案内帯 72px（メッセージ1行＋ボタン1行）。ヘッダー 61px
- ヒーローは最初の画面の 711px を占める（画面の 84.3%、ヒーロー全体の 88.3%）。案内帯なしでは 92.8%
- 近隣ボタン → `/mom?store=ryutsudori`：店舗帯あり、jobCategory「未経験（ママ・主婦）｜もみかる 流通通り店（store:ryutsudori）」、トップへのリンクに `?store=ryutsudori`
- 案内帯の状態（/mom?store=nishiwaki）：店舗帯なし、jobCategory「未経験（ママ・主婦）」（店舗なし）、トップへのリンクは `./` のまま
- 店舗ページ（/stores/toyama/）：スマホ幅で横スクロールなし、「直営」の表示なし

### R8 「業界初」「第三者機関」「共済」の出現箇所（行番号は 2026-10-08 時点）
| ファイル | 行 | 該当文 |
|---|---|---|
| index.html | 345 | 収入保障共済あり（ママ・主婦の特徴） |
| osteo.html | 15 | meta description「…稼働日・時間は自由、業界初の収入保障共済、鍼灸も施術可能…」 |
| osteo.html | 86 | 業界初の収入保障共済（ヒーローの特徴） |
| osteo.html | 399 | ANSWER_04 — 業界初／もみかるの「収入保障共済」は、事故・ケガ・病気で働けなくなったときに収入が保障される業界初の制度です。…／※ 業界初は自社調べ。保障内容・条件は面接でご説明します。／収入保障共済で保障 |
| osteo.html | 414 | FAQ：収入保障共済の掛金や保障内容は？ |
| mom.html | 15 | meta description「…第三者機関の認定証も。業界初の収入保障共済で、未経験から手に職を。」 |
| mom.html | 84 | 第三者機関の認定証（ヒーローの特徴） |
| mom.html | 85 | 業界初の収入保障共済（ヒーローの特徴） |
| mom.html | 371 | 第三者機関の認定証（比較表） |
| mom.html | 372 | 収入保障共済で保障（比較表） |
| mom.html | 377 | ANSWER_03 — 業界初／もみかるの「収入保障共済」は、…業界初の制度です。…／※ 業界初は自社調べ。…／収入保障共済で保障 |
| mom.html | 378 | 15の技術と、第三者機関の認定証。（ANSWER_04 見出し） |
| relax.html | 15 | meta description「…131店舗の集客力、業界初の収入保障共済、協同組合の認定証、独立支援制度。…」 |
| relax.html | 84 | 業界初の収入保障共済（ヒーローの特徴） |
| relax.html | 209–213 | ANSWER_02 — 業界初／もみかるの「収入保障共済」は、…業界初の制度です。…／※ 業界初は自社調べ。… |
| relax.html | 222 | もみかる／収入保障共済で保障（比較） |
| relax.html | 552 | マンガのタグ「収入保障共済」：休んでも、収入が保障される…？ |
| relax.html | 555 | マンガのタグ「収入保障共済」：休めるって、こんなに安心なんだ |
| relax.html | 572 | 比較表：ケガ・病気で休んだとき／収入保障共済で収入を保障 |
| relax.html | 594 | FAQ：収入保障共済の掛金や保障内容は？ |
| relax.html | 738 | 5年後比較：ケガ・病気で休んだら／収入保障共済で保障 |
| esthe.html | 496 | ANSWER_05 — 業界初／もみかるの「収入保障共済」は、…業界初の制度です。…／※ 業界初は自社調べ。…／収入保障共済で保障 |
| esthe.html | 507 | FAQ回答：…もみかるには、ケガや病気で働けないときに収入が保障される「収入保障共済」があります。… |
| side-job.html | — | 該当なし |
| owner.html | — | 該当なし |

出現数：index 1、osteo 10、mom 14、relax 14、esthe 6、side-job 0、owner 0

## 12. 店舗ごとの制度（benefits）（2026-10-08 オーナー依頼 その3）

> 既存LPの文章とデザインは変更しない、という原則の例外として、オーナーの指示により共済の出し分け（表示・非表示と枠詰め）と「業界初」の言い換えを既存LPに入れた。

### データ
- `data/stores.json` の各店舗に `benefits: { "kyosai": true|false }`。キーの一覧と意味は `_meta.benefit_keys`
- 現在値（オーナー回答 2026-10-08）：総本店、流通通り店、富山本店、岐阜長良店とも `kyosai: true`
- build-stores.mjs は `_meta.benefit_keys` の全キーについて、各店舗の値が true/false かを検証する

### 表示ルール
| 状況 | 制度の記述 |
|---|---|
| 店舗指定なし（フェイス、`?store=` なしの属性LP） | すべて非表示 |
| 店舗指定あり、かつその店舗でこの属性を募集中 | `benefits[key] === true` の制度だけ表示 |
| 店舗指定あり、だが募集していない属性（案内帯の状態） | すべて非表示（店舗指定なしと同じ扱い） |
| 店舗ページ（stores/{id}/）と JobPosting | その店舗の `benefits[key] === true` の制度だけ表示 |
- 近隣店舗の案内順は距離だけで決める（benefits は影響しない）

### 仕組み
1. `store-context.js` の `setBenefits()`：店舗指定が有効なときに `window.MK_BENEFITS = store.benefits` を設定し、`mk:benefits` イベントを送る。募集していない属性では `{}` を送る。店舗指定なしでは何も設定しない（＝すべて false）
2. 各LPのロジック：`state.ben` を持ち、`mk:benefits` を受けて更新する（componentDidMount で購読し、すでに MK_BENEFITS があれば即反映）
3. 配列データの項目に `benefit:'キー'` を付けると、`byBen(list, s.ben)` で出し分けられる。`fallback:{…}` を付けると、非表示にせず差し替える
4. 番号付きの項目は、出し分けのあとに `renumber()` で振り直す（ANSWER_xx、STEP xx）。テンプレート内に直書きされた番号は `{{ a3no }}` などで振り直す
5. テンプレートに直書きの要素は `<sc-if value="{{ kyosai }}">` で囲む。2列チェックリストの最後の枠は `grid-column:{{ heroSpan }}`（非表示のとき `1 / -1`）にして空き枠を詰める
6. **（§13 で変更）** 店舗データは data/stores.js で同期に読み込むため、初回描画の時点で表示・非表示が確定している

### benefits キーと表示箇所の対応（kyosai）
| ファイル | 箇所 | 方法 |
|---|---|---|
| index.html | 診断結果カードの特徴「収入保障共済あり」（mom） | `BEN_POINT` で除外（フェイスは常に店舗指定なし） |
| osteo.html | ヒーローのチェックリスト「業界でも珍しい収入保障共済」 | sc-if、残りの最後の枠「鍼灸の施術も可能」を2列にする |
| osteo.html | ANSWERS「ANSWER_04 — 業界でも珍しい」（休んだときの収入） | benefit、ANSWER 番号を振り直す |
| osteo.html | FAQ「収入保障共済の掛金や保障内容は？」 | benefit |
| mom.html | ヒーローのチェックリスト「業界でも珍しい収入保障共済」 | sc-if、「第三者機関の認定証」を2列にする |
| mom.html | TURN 比較表「休んだときの収入」 | benefit |
| mom.html | ANSWERS「ANSWER_03 — 業界でも珍しい」 | benefit、振り直し |
| relax.html | ヒーローのチェックリスト「業界でも珍しい収入保障共済」 | sc-if、「独立支援制度」を2列にする |
| relax.html | テンプレート直書きの ANSWER_02 ブロック（共済の説明と、ケガで2週間休んだ場合の比較） | sc-if。ANSWER_03 と 04 の番号は `a3no` / `a4no` で振り直す |
| relax.html | マンガ STORY1 の2コマ（タグ「収入保障共済」） | benefit、STEP 番号を振り直す |
| relax.html | COMPARE「ケガ・病気で休んだとき」 | benefit |
| relax.html | 5年後比較（yearsVals の gen と mk）「ケガ・病気で休んだら」の行（両列） | benefit |
| relax.html | FAQ「収入保障共済の掛金や保障内容は？」 | benefit |
| esthe.html | ANSWERS「ANSWER_05 — 業界でも珍しい」 | benefit、振り直し |
| esthe.html | FAQ「正社員から業務委託になるのが不安です。」の回答 | benefit＋fallback（共済の一文を除いた回答に差し替え） |
| data/attributes.json | mom の points「収入保障共済あり」→ 店舗ページの特徴と JobPosting の説明 | `{ text, benefit }` 形式。build の pointsFor で出し分け |
| meta description（osteo、mom、relax） | 「業界初の収入保障共済」 | 静的なので出し分けできない。店舗指定なしの基準に合わせて削除 |

| osteo.html | REALITIES 03「体を壊したら、そこで終わり。」（悩みの描写） | benefit、番号を振り直す（§13 で追加） |
| relax.html | REALITIES 02「ケガや病気で休めば、収入はゼロ。」（悩みの描写） | benefit、番号を振り直す（§13 で追加） |
| relax.html | 冒頭マンガ STORY の 17:00 のコマ（吹き出し「休んだら、収入はゼロ…」） | benefit（§13 で追加） |

（当初は悩みの描写を対象外にしていたが、§13 のオーナー指示で対象に含めた）

### 「業界初」→「業界でも珍しい」
- 本文「業界初の制度です」→「業界でも珍しい制度です」、タグ「— 業界初」→「— 業界でも珍しい」、チェックリスト「業界初の収入保障共済」→「業界でも珍しい収入保障共済」
- 注記「※ 業界初は自社調べ。」→「※「業界でも珍しい」は自社調べ。」（文として通るように鉤括弧を付けた）
- 既存LP内の「業界初」は0件になった

### 制度を追加する手順（例：新しい制度 xxx）
1. stores.json の `_meta.benefit_keys` に `xxx` と説明を追加し、全店舗の `benefits.xxx` に true/false を入れる
2. LP の該当データ項目に `benefit:'xxx'` を付ける（文中の一部だけを変えるなら `fallback`）。直書きの要素は `<sc-if value="{{ xxx }}">` で囲み、renderVals に `xxx: !!s.ben.xxx` を追加する
3. 番号付きの一覧なら `renumber()` を通す。2列グリッドなら最後の枠に `grid-column` の切り替えを入れる
4. attributes.json の points に `{ text, benefit:'xxx' }` を使えば、店舗ページと JobPosting にも反映される
5. この表に行を追加する

### 確認（ローカル、390px iframe）
| ページ | 共済の語 | ANSWER | 備考 |
|---|---|---|---|
| /osteo | 0 | 01〜04 | ヒーロー3枠（最後が2列） |
| /osteo?store=ryutsudori | 4 | 01〜05 | |
| /mom、/mom?store=nishiwaki（募集なし） | 0 | 01〜03 | ヒーロー3枠（最後が2列） |
| /mom?store=ryutsudori | 4 | 01〜04 | ヒーロー4枠 |
| /relax | 0 | 01〜03 | STORY1 は4コマ、ヒーロー3枠 |
| /relax?store=ryutsudori | 7 | 01〜04 | STORY1 は6コマ |
| /esthe | 0 | 01〜04 | FAQ は差し替え文で表示 |
| /esthe?store=ryutsudori | 2 | 01〜05 | |
| / | 0（表示上） | — | |
| stores/*：mom の特徴「収入保障共済あり」 | 表示（全店 true） | — | |
- 「業界初」の表示は全ページで0件。コンソールエラーなし
- 作業中に mom.html と esthe.html で補助関数の追加漏れがあり描画が止まったが、修正後に再確認した

## 13. 修正（2026-10-08 オーナー依頼 その4）

| # | 依頼 | 対応 |
|---|---|---|
| R9 | 「体を壊したら、そこで終わり。」を含む悩みの描写を、共済と同じ条件で出し分ける | osteo REALITIES 03、relax REALITIES 02、relax 冒頭マンガの 17:00 のコマ（吹き出し「休んだら、収入はゼロ…」）に `benefit:'kyosai'`。REALITIES の番号は振り直す（グリッドは auto-fit なので3件でも崩れない） |
| R10 | 共済の枠が遅れて現れる問題を解消する。build 時に店舗データを JS で生成して同期読み込みし、レイアウトシフトがないことを確認する | 下記 |
| R11 | 電話受付時間を「平日 10:00〜18:00」に統一する（オーナー選択） | 既存7ページの「平日 9:00〜18:00」を置き換え（index のフッター CTA の「電話受付：」も含む）。店舗ページ・店舗一覧の電話表記にも同じ時間を追加（build の `TEL_HOURS`）。予約ウィジェット側は §13.2 |

### R10 の仕組み
- `tools/build-stores.mjs` が `data/stores.js` を生成：`window.MK_DATA = { stores, attributes: { order, attributes } }`（stores.json と attributes.json と同じ内容。手で編集しない）
- 各ページの `<head>` で、support.js より前に同期で読み込む：`<script src="./data/stores.js"></script>` → `<script src="./store-context.js" data-attr="…"></script>`（`defer` を外した）
- store-context.js：fetch をやめ、`window.MK_DATA` から同期で店舗を確定する。`window.MK_BENEFITS` は React の読み込みより前に決まる。店舗帯・案内帯は、body が作られた瞬間（中身のパース前）に body の先頭へ入れる（`whenBody`）。フェイスの店舗検索は、マウント要素が描画された直後（画面に出る前の MutationObserver）に中身を入れる
- 各LPの初期 state を `ben: window.MK_BENEFITS || {}` にしたので、初回描画から最終の表示になる（`mk:benefits` の購読は念のため残している）
- stores.json を更新したら `node tools/build-stores.mjs` で data/stores.js も更新される（忘れると古いデータのまま）

### R10 の確認
- **CLS（PerformanceObserver の layout-shift）**：全ページで 0 だったが、比較のために読み込み後に 60px の要素を差し込んでも 0 のままだった。この環境（iframe）では計測が効いていないため、根拠にしていない
- **代わりの確認**：ページの `<head>` 先頭に DOM の変化を記録するプローブを入れて読み込み、ヒーローのチェックリストの状態を時系列で記録した
  - `/mom`：React の初回描画（614ms）で3枠。以後変化なし
  - `/mom?store=ryutsudori`：初回描画（869ms）で4枠（共済あり）。以後変化なし
  - `/relax?store=gifu`：初回描画で共済の枠あり。以後変化なし
  - → 「あとから枠が追加される」状態は発生していない
- 通常の読み込みで、店舗帯（`data-store-context`）と案内帯（`data-store-unavailable`）が body の最初の子要素＝ページ本体より前にあることを確認。MK_BENEFITS：流通通り店 `{"kyosai":true}`、総本店の mom（募集なし）は `{}`
- 表示内容：`/osteo` は「体を壊したら」0件、`/osteo?store=toyama` は1件。`/relax` は「ケガや病気で休めば」と手首のコマが0件、`/relax?store=gifu` はどちらも1件。フェイスの店舗検索は4件表示。コンソールエラーなし

### 13.2 予約ウィジェットの受付時間（フォルダ外のため変更していない）
- 場所：`interview-booking-api/public/widget/config.js` 12行目 `brand.businessHours: "平日 10:00〜19:00"`（公開URL：https://interview-booking-api.netlify.app/widget/config.js）
- なお、booking.js は今のところ `businessHours` を表示に使っていない（フォールバック表示は `brand.phone` と `email` だけで、phone は空）。表記を合わせるなら `平日 10:00〜18:00` に変更する

## 14. ブランチデプロイ（2026-10-08）

- ブランチ：`store-recruit`（origin に push 済み、main へのマージはしていない）。コミットは momikaru-recruit 配下だけ
- プレビューURL：https://store-recruit--momikaru-recruit.netlify.app/ （Netlify のブランチデプロイに store-recruit を追加済み。push のたびに更新される）
- 確認（9ece91c の push から約30秒で公開）：
  - 200：/、/stores/、/stores/nishiwaki/、/stores/toyama/、/osteo、/mom、/data/stores.js、/store-context.js
  - 404：/SPEC.md、/CLAUDE_CODE_PROMPT.md、/tools/*、存在しないパス（_redirects が有効）
  - 全パスに `X-Robots-Tag: noindex, nofollow`（_headers が有効）
  - /stores/toyama/：JobPosting 5件、canonical は site.config.json の siteBase（https://momikaru-recruit.netlify.app/stores/toyama/）
  - /mom?store=nishiwaki：案内帯「総本店では「ママ・主婦」の募集はありません。近くの店舗：流通通り店 →」、MK_BENEFITS は {}
  - /mom?store=ryutsudori：店舗帯あり、共済の記述あり。コンソールエラーなし

## 15. 修正（2026-10-08 オーナー依頼 その5）

| # | 依頼 | 対応 |
|---|---|---|
| R12 | JobPosting を1ページ1件にまとめる。title は「セラピスト（業務委託）｜もみかる {店舗名}」、募集中の属性は description 本文に入れる。必須項目を確認する | `jobPosting(s)` を店舗単位にした。title の店舗名は store_name から先頭の「もみかる」を除いたもの（例：セラピスト（業務委託）｜もみかる 富山本店）。description：導入文、「募集中の働き方：…」、属性ごとの見出し・タグライン・特徴（benefits で出し分け）、契約形態と稼働日時、勤務地（sub_locations を含む住所付き）。identifier は store_id。build 時に必須項目を検証し、不足があればエラーで止まる |
| R13 | 正規URL、構造化データ内のURL、サイト内リンクを末尾スラッシュなしに統一。/stores/toyama/ は /stores/toyama へ 301 | 出力レイアウトを `stores/{id}.html`（→ /stores/{id}）と `stores.html`（→ /stores）に変更。旧 `stores/{id}/index.html` と `stores/index.html` は build が削除する。canonical、JobPosting の url、サイト内リンク（店舗ページ、店舗一覧、store-context.js の店舗帯・案内帯・店舗検索）をスラッシュなしにした。site.config.json の trailingSlash は廃止（常にスラッシュなし。フェイスだけは、基準がドメイン直下のとき `https://…/`） |

### Google 求人構造化データの必須項目の確認（4店舗とも）
| 項目 | 状態 |
|---|---|
| title | OK（例：セラピスト（業務委託）｜もみかる 富山本店） |
| description | OK（HTML、募集中の属性を含む） |
| datePosted | OK（2026-10-08） |
| hiringOrganization | OK（name：株式会社ドラミカンパニー、sameAs、logo） |
| jobLocation | OK（PostalAddress：addressCountry、addressRegion、addressLocality、streetAddress。富山は2か所） |

推奨項目で未設定のもの（必須ではない）：
- `validThrough`（掲載終了日）：未設定。Google は期限がない求人なら省略可としているが、設定すると掲載終了が明示できる
- `baseSalary`：D6 により出していない
- `postalCode`：stores.json が TODO のため全店舗で未設定（富山はリラックス館も）
- 設定済みの推奨項目：employmentType（CONTRACTOR）、identifier、directApply（false）、geo

### 301 の実装
- Netlify：`stores/toyama.html` を置くと、/stores/toyama で配信され、/stores/toyama/ は /stores/toyama に 301 される（Pretty URLs の挙動。プレビューで確認）
- ローカル（tools/serve.mjs）：末尾スラッシュ付きで、対応する `.html` があれば 301 する処理を追加
- 相対パスの基点：店舗ページ（/stores/{id}）は `../`、店舗一覧（/stores）は `''`

### プレビューでの確認（ecddddc、https://store-recruit--momikaru-recruit.netlify.app/）
- JobPosting：4店舗とも1件。title「セラピスト（業務委託）｜もみかる 総本店／流通通り店／富山本店／岐阜長良店」、勤務地は富山2か所、他1か所
- canonical と JobPosting の url：`https://momikaru-recruit.netlify.app/stores/{id}`（一致、スラッシュなし）。店舗一覧は `…/stores`
- リダイレクト：/stores/toyama/ → 301 /stores/toyama（クエリ保持）、/stores/ → 301 /stores。旧URLの /stores/toyama/index.html は 404
- 店舗帯のリンク、フェイスの店舗検索のリンクも `/stores/{id}` と `/stores`。コンソールエラーなし
- 残る重複URL：`/stores/toyama.html` は 200 のまま（Netlify の Pretty URLs が .html を外すリダイレクトをしていない）。canonical が /stores/toyama を指すので検索上の問題は小さい。消すなら Netlify の Pretty URLs を有効にするか、_redirects に店舗ごとの 301 を追加する

## 16. 修正（2026-10-08 オーナー依頼 その6）

| # | 依頼 | 対応 |
|---|---|---|
| R14 | validThrough は設定しない。attributes がすべて false の店舗は JobPosting を出さず、「現在募集を行っていません」と表示して近隣の募集中店舗へ案内する | build-stores.mjs：`open = onAttrs(s).length > 0`。募集なしなら JSON-LD を出さず、ヒーローに「現在募集を行っていません。」と表示し、「募集中の働き方」の代わりに `closedSection`（近隣の募集中店舗＝いずれかの属性が true、30km 以内、近い順に最大3件。なければ店舗一覧へ）を出す。title、description、面談ボタンの jobCategory（「店舗ページから相談」。店舗指定なし）も切り替える。店舗一覧とフェイスの店舗検索のカードは「現在募集なし」と表示する。LP の `?store=` は従来どおり属性ごとの案内帯になる |
| R15 | 郵便番号を日本郵便の公式データから取得して stores.json に入れる | 日本郵便の郵便番号データ（UTF-8 版 utf_ken_all.zip、2026-09-24 版）を取得し、都道府県・市区町村・町名の完全一致で照合した。出典は stores.json の `_meta.postal_code_source` に記録 |
| R16 | .html 付きURLを _redirects で拡張子なしURLへ 301。店舗ページは build で自動生成し、既存LPも同様。SPEC の差し替え手順に同じ内容の .htaccess を追記 | build-stores.mjs が `_redirects` のマーカー（`# BEGIN generated …` 〜 `# END generated …`）の間を書き換える（手書きの 404 ルールは残す）。対象：/index.html → /、/osteo.html などの既存7ページ、/stores.html → /stores、/stores/{id}.html → /stores/{id}（店舗の増減に自動で追従）。ファイルが存在しても転送するため `301!`。ローカルサーバーも _redirects の 301 を再現する |

### R15 取得した郵便番号
| 店舗 | 住所 | 郵便番号 |
|---|---|---|
| もみかる 総本店 | 静岡県静岡市駿河区西脇11-1 2F | 422-8044 |
| もみかる 流通通り店 | 静岡県静岡市葵区東千代田2丁目1-26 | 420-0801 |
| もみかる 富山本店 | 富山県富山市二口町4丁目4-2 B室 | 939-8211 |
| もみかる 富山本店 リラックス館 | 富山県富山市二口町4丁目9-10 アオイビル2F | 939-8211 |
| もみかる 岐阜長良店 | 岐阜県岐阜市長良東2丁目37 1F | 502-0082 |

- 岐阜は前方一致だと「長良東郷町（502-0022）」と「長良東町（502-0043）」も当たるため、完全一致の「長良東」を採用した
- これで JobPosting の推奨項目で未設定なのは validThrough（設定しない決定）と baseSalary（D6）だけになった

### R14 の確認（試験用コピーで、流通通り店と岐阜長良店を募集なしにして build）
- 流通通り店：JobPosting 0件、「現在募集を行っていません」、近隣の募集中店舗として総本店（5.8km）を表示
- 岐阜長良店：JobPosting 0件、近隣なし → 「近くに募集中の店舗がありません」＋店舗一覧へのボタン（ヒーローのボタンは「ほかの店舗を探す ↓」）
- 店舗一覧で「現在募集なし」が2件。本番データ（4店舗とも募集あり）では従来どおり JobPosting 1件ずつ

### 差し替え手順：Apache（.htaccess）での設定
Netlify の `_redirects`、`_headers` と同じ動きを、www.momikaru.com/recruit/ に配置したときに再現する設定。momikaru-recruit の中身を配置した `/recruit/` ディレクトリに `.htaccess` として置く。macOS 付属の Apache 2.4.62（mod_rewrite、mod_headers）で、`/recruit/` 配下に配置したコピーを使い、Host ヘッダーを www.momikaru.com と momikaru.com に切り替えて下表の動作を確認済み（2026-10-08）。検証環境は http のため Location は http:// だったが、本番の HTTPS サーバーでは https:// になる

```apache
# もみかる採用（/recruit/）— momikaru-recruit の中身を配置するディレクトリに置く（SPEC.md §16）
Options -MultiViews +FollowSymLinks
# /recruit/stores はディレクトリ（stores/）と店舗一覧（stores.html）が同名のため、ここだけ末尾スラッシュの自動付与を止める
<If "%{REQUEST_URI} =~ m#^/recruit/stores$#">
  DirectorySlash Off
</If>
DirectoryIndex index.html
RewriteEngine On
RewriteBase /recruit/

# 試験中のみ：検索エンジンに登録させない（本番公開時はこのブロックを削除）
<IfModule mod_headers.c>
  Header always set X-Robots-Tag "noindex, nofollow"
</IfModule>

# 0) ホストを www 付きに統一：momikaru.com/recruit/… → https://www.momikaru.com/recruit/…（クエリは引き継ぐ）
RewriteCond %{HTTP_HOST} ^momikaru\.com$ [NC]
RewriteRule ^(.*)$ https://www.momikaru.com/recruit/$1 [R=301,L]

# 1) 内部資料・開発ツールは 404
RewriteRule ^(SPEC\.md|CLAUDE_CODE_PROMPT\.md|tools(/.*)?)$ - [R=404,L]

# 2) .html 付きURL → 拡張子なしへ 301（index.html はフェイス /recruit/ へ）。クエリは引き継ぐ
RewriteCond %{THE_REQUEST} \s/recruit/index\.html[?\s]
RewriteRule ^index\.html$ /recruit/ [R=301,L]
RewriteCond %{THE_REQUEST} \s/recruit/.+\.html[?\s]
RewriteRule ^(.+)\.html$ /recruit/$1 [R=301,L]

# 3) 末尾スラッシュ付き → なしへ 301（同名の .html があるもの。例：/recruit/stores/toyama/ → /recruit/stores/toyama）
RewriteCond %{DOCUMENT_ROOT}/recruit/$1.html -f
RewriteRule ^(.+)/$ /recruit/$1 [R=301,L]

# 4) 拡張子なし → .html を内部で配信（例：/recruit/stores/toyama → stores/toyama.html）
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{DOCUMENT_ROOT}/recruit/$1.html -f
RewriteRule ^(.+)$ $1.html [L]
```

確認した動作（Apache 2.4.62）：
| リクエスト | 結果 |
|---|---|
| momikaru.com/recruit/…（www なし） | 301 → https://www.momikaru.com/recruit/…（パス・クエリ保持） |
| momikaru.com/recruit（www なし・スラッシュなし） | 301 → momikaru.com/recruit/ → 301 → https://www.momikaru.com/recruit/（2段階） |
| /recruit | 301 → /recruit/（クエリ保持） |
| /recruit/ | 200（フェイス） |
| /recruit/index.html | 301 → /recruit/ |
| /recruit/osteo | 200 |
| /recruit/osteo.html、/recruit/mom.html?store=… | 301 → 拡張子なし（クエリ保持） |
| /recruit/stores | 200（店舗一覧） |
| /recruit/stores/、/recruit/stores.html | 301 → /recruit/stores |
| /recruit/stores/toyama | 200 |
| /recruit/stores/toyama/、/recruit/stores/toyama.html | 301 → /recruit/stores/toyama（クエリ保持） |
| /recruit/data/stores.js、/recruit/assets/… | 200 |
| /recruit/SPEC.md、/recruit/CLAUDE_CODE_PROMPT.md、/recruit/tools、/recruit/tools/… | 404 |
| すべて | X-Robots-Tag: noindex, nofollow（試験中のみ） |

注意：
- `/recruit/stores` はディレクトリ（stores/）と店舗一覧（stores.html）が同名のため、そのパスだけ `DirectorySlash Off` にしている。全体を Off にすると `/recruit` → `/recruit/` の転送が効かなくなる（検証で確認）
- サーバーの設定で `AllowOverride` が `FileInfo`、`Options`、`Indexes` を含む（または All）こと、mod_rewrite と mod_headers が有効であることが前提
- 差し替え時は tools/site.config.json の siteBase を `https://www.momikaru.com/recruit` にして build し直す（canonical と JobPosting の URL に反映。www なしの momikaru.com は .htaccess で www 付きへ 301）。本番公開時は X-Robots-Tag のブロックと、各ページの `<meta name="robots">` を外す
- Netlify の `_redirects` は自動生成だが、この .htaccess は店舗が増えても書き換え不要（パターンで処理）

### §16 のプレビュー確認（89feac2、https://store-recruit--momikaru-recruit.netlify.app/）
- .html 付き14件（/index.html、既存LP6本、/stores.html、店舗4件、クエリ付き）がすべて拡張子なしへ 301。拡張子なしは 200、/SPEC.md と /tools/* は 404 のまま
- 郵便番号：4店舗とリラックス館の JobPosting の postalCode と、ページ表示の〒に反映
- 募集なし店舗：実データ（4店舗とも募集あり）では発生しないため、プレビューでは JobPosting 1件ずつ（validThrough なし）を確認。募集なしの表示は試験用コピーでのみ確認（§16 R14）

## 17. 差し替え後の基準ドメイン（2026-10-08 オーナー指示）

- 差し替え後の基準は **https://www.momikaru.com/recruit**（www 付き）に統一する
- `tools/site.config.json`：siteBase は試験中のため `https://momikaru-recruit.netlify.app` のまま。_note の差し替え後の値を www 付きに更新した。差し替え時に siteBase を `https://www.momikaru.com/recruit` に変えて build する（フェイスの canonical は `https://www.momikaru.com/recruit/`、ほかはスラッシュなし）
- SPEC.md 内の差し替え先の記述（§1、§4.7、§5、§8 T1、§9、§16）、`_headers` と build-stores.mjs のコメントを www 付きに統一した
- `.htaccess`（§16）に、www なしの `momikaru.com/recruit/…` を `https://www.momikaru.com/recruit/…` へ 301 するルールを最初に追加した。Apache で検証済み（www なし → www 付き、パスとクエリを保持）。`.html` 付きや末尾スラッシュ付きを www なしで開いた場合は、www 付きへの 301 → 拡張子なしへの 301 の2段階になる
