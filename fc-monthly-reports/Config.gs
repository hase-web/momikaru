/**
 * もみかるFC 月次レポート自動配信 — 設定
 * デプロイ前に DEST_ROOT_FOLDER_ID と HQ_ALERT_EMAIL を確認してください。
 */
var FC_REPORT_CONFIG = {
  /** Andy 店舗マスタ（shop タブは Andy 連携で更新・触らない） */
  SPREADSHEET_ID: '1e-QNTFdqoMK5dRIJ6Je4u7BhPRMDEFAbelzAFLyaTm8',
  SHOP_SHEET_NAME: 'shopm',
  USERM_SHEET_NAME: 'userm',
  USERXSHOP_SHEET_NAME: 'userxshop',

  /** 5日配信：1回の実行で処理する店舗数（Claude API のため小さめ） */
  DELIVERY_BATCH_SIZE: 3,

  /** デフォルト配信チャネル（店舗フォルダマッピング F列が空のとき）
   * LINE = LINE優先・未紐づけ時メール / メール / 両方 / LINEのみ */
  DEFAULT_DELIVERY_CHANNEL: 'LINE',

  LINE_LINK_SHEET_NAME: 'line_link',
  LINE_THREADS_SHEET_NAME: 'threads',

  /** スクリプトが作成・更新するタブ */
  LOG_SHEET_NAME: '配信ログ',
  MAPPING_SHEET_NAME: '店舗マッピング',
  FOLDER_MAPPING_SHEET_NAME: '店舗フォルダマッピング',
  /** コックピット: スーパーバイジング下書き・承認 */
  SUPERVISING_SHEET_NAME: 'スーパーバイジング',
  /** 店舗月次KPI（ダッシュボード・BOTナレッジ用） */
  KPI_SHEET_NAME: '店舗月次KPI',
  /** PDF抽出の顧客分析補足（年代構成など） */
  REPORT_METRICS_EXTRA_SHEET_NAME: '店舗レポートナレッジ',
  /** 本部サポート Bot 同期先タブ名（BOT_QA_SHEET_ID 内） */
  BOT_METRICS_SHEET_NAME: 'Bot_ReportMetrics',

  /**
   * 店舗フォルダ直下の FC 専用サブフォルダ（オーナー共有はここだけ）
   * {店舗}/FC月次レポート/月次レポート|顧客分析/年/月/
   */
  FC_REPORT_ROOT_NAME: 'FC月次レポート',

  /** userm.adminLevel — FCオーナー（Drive共有・メール配信の主対象） */
  FC_OWNER_ADMIN_LEVEL: '21',

  /** コックピットのアップロード先（Drive）。空なら B_FC加盟店 配下に自動作成 */
  COCKPIT_UPLOAD_ROOT_NAME: 'FC月次レポート_コックピット',

  /** 見崎さんがアップするフォルダ（月次レポート置場） */
  SOURCE_ROOT_FOLDER_ID: '1E08HWDtC5xGjP7eulp9BHhNf7IzHBBUE',

  /**
   * コピー先ルート（B_FC加盟店）のフォルダ ID
   * Drive でフォルダを開き URL の folders/ の後ろを設定
   * 例: https://drive.google.com/drive/folders/XXXXXXXX
   */
  DEST_ROOT_FOLDER_ID: '1xox-hFd7w06ha_YbBLCxBBfoEZQVl7hn',

  /** エラー通知・処理サマリー送信先（本部） */
  HQ_ALERT_EMAIL: 'honten@momikaru.com',

  /** 初回バックフィル開始月（YYYYMM） */
  BACKFILL_START_YM: '202601',

  /** タイムゾーン */
  TIMEZONE: 'Asia/Tokyo',

  /**
   * オーナー本番配信の安全スイッチ（スクリプトプロパティ OWNER_DELIVERY_ENABLED）
   * 未設定 or false = 無効（LINE・メールともオーナーに送らない）
   * true = 本部承認後にメニューから有効化
   */

  /** 直営店フォルダ（B_FC加盟店 とは別） */
  DIRECT_ROOT_FOLDER_ID: '19MrPD87A9pA0lG8SZ9RnSErOqoIw6v3Y',
};
