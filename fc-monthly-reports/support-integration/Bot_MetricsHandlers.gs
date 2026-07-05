/**
 * 本部サポート連携 Bot.gs へ追記するコード（フェーズ1）
 * fc-monthly-reports が Bot_ReportMetrics シートへ同期したデータを読む
 *
 * 前提:
 * - スクリプトプロパティ BOT_QA_SHEET_ID と同じスプレッドシートに Bot_ReportMetrics タブ
 * - bot_handleQuestion_ / bot_handleChatQuestion_ から bot_tryAnswerMetrics_ を呼ぶ
 */

const BOT_REPORT_METRICS_SHEET_NAME = 'Bot_ReportMetrics';

function bot_getReportMetricsSheet_() {
  const ssId = PropertiesService.getScriptProperties().getProperty(BOT_QA_SHEET_ID_KEY);
  if (!ssId) return null;
  const ss = SpreadsheetApp.openById(ssId);
  return ss.getSheetByName(BOT_REPORT_METRICS_SHEET_NAME);
}

function bot_loadReportMetricsRows_() {
  const sheet = bot_getReportMetricsSheet_();
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const obj = {};
    headers.forEach((h, j) => {
      obj[String(h)] = values[i][j];
    });
    rows.push(obj);
  }
  return rows;
}

/** 数値・稼働率・客単価などの質問か簡易判定 */
function bot_isMetricsQuestion_(text) {
  const t = String(text || '');
  return /売上|来客|客単価|稼働|取りこぼし|新規|リピート|損益|件数|何人|いくら|平均/.test(t);
}

function bot_parseYmFromText_(text, defaultYm) {
  const t = String(text || '');
  const m1 = t.match(/(\d{4})年\s*(\d{1,2})月/);
  if (m1) return m1[1] + ('0' + m1[2]).slice(-2);
  const m2 = t.match(/(\d{6})/);
  if (m2) return m2[1];
  return defaultYm || '';
}

function bot_resolveShopNamesForUser_(lineUserId) {
  // 既存の bot_resolveScope_ / Andy 参照に合わせて実装
  // 加盟店: line_link → userm → userxshop → shopm.kintoneShopName
  return [];
}

function bot_filterMetricsForChat_(rows, questionText) {
  const ym = bot_parseYmFromText_(questionText, '');
  let filtered = rows;
  if (ym) filtered = filtered.filter((r) => String(r['対象年月']) === ym);

  const shopMatch = String(questionText || '').match(/(.+?)(店)?の/);
  if (shopMatch && shopMatch[1] && shopMatch[1].length <= 12) {
    const needle = shopMatch[1].trim();
    const byShop = filtered.filter((r) => {
      const name = String(r['店舗名'] || '');
      const kn = String(r['kintoneShopName'] || '');
      return name.indexOf(needle) >= 0 || kn.indexOf(needle) >= 0;
    });
    if (byShop.length) filtered = byShop;
  }
  return filtered;
}

function bot_formatMetricsAnswer_(rows, questionText) {
  if (!rows.length) return '該当するレポート数値が見つかりませんでした。';

  if (/平均|全店/.test(questionText)) {
    const nums = (key) =>
      rows
        .map((r) => Number(r[key]))
        .filter((n) => !isNaN(n));
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
    const lines = ['【全店集計（レポートPDF由来）】'];
    const sales = avg(nums('実売上'));
    const visitors = avg(nums('来客数'));
    const unit = avg(nums('客単価'));
    const util = avg(nums('ベッド稼働率'));
    if (sales != null) lines.push('・平均実売上: ¥' + Math.round(sales).toLocaleString('ja-JP'));
    if (visitors != null) lines.push('・平均来客数: ' + Math.round(visitors) + '人');
    if (unit != null) lines.push('・平均客単価: ¥' + Math.round(unit).toLocaleString('ja-JP'));
    if (util != null) lines.push('・平均ベッド稼働率: ' + util.toFixed(1) + '%');
    lines.push('（対象 ' + rows.length + ' 店舗）');
    return lines.join('\n');
  }

  const r = rows[rows.length - 1];
  const ym = String(r['対象年月'] || '');
  const label = ym.slice(0, 4) + '年' + Number(ym.slice(4, 6)) + '月';
  const lines = [
    '【' + (r['店舗名'] || r['kintoneShopName']) + ' / ' + label + '（レポートPDF）】',
  ];
  if (r['実売上'] !== '') lines.push('・実売上: ¥' + Number(r['実売上']).toLocaleString('ja-JP'));
  if (r['来客数'] !== '') lines.push('・来客数: ' + r['来客数'] + '人');
  if (r['客単価'] !== '') lines.push('・客単価: ¥' + Number(r['客単価']).toLocaleString('ja-JP'));
  if (r['ベッド稼働率'] !== '') lines.push('・ベッド稼働率: ' + r['ベッド稼働率'] + '%');
  if (r['取りこぼし件数'] !== '') lines.push('・取りこぼし: ' + r['取りこぼし件数'] + '件');
  lines.push('※月次レポート・顧客分析PDFから抽出した数値です。');
  return lines.join('\n');
}

/**
 * LINE / Chat 共通の数値回答トライ
 * @return {string|null} 回答文。該当なしは null
 */
function bot_tryAnswerMetrics_(questionText, options) {
  options = options || {};
  if (!bot_isMetricsQuestion_(questionText)) return null;

  const rows = bot_loadReportMetricsRows_();
  if (!rows.length) return null;

  let filtered = rows;
  if (options.lineUserId && !options.isHqChat) {
    const shopNames = bot_resolveShopNamesForUser_(options.lineUserId);
    if (!shopNames.length) return 'ご登録店舗のレポート数値がまだ同期されていません。';
    filtered = rows.filter((r) => shopNames.indexOf(String(r['kintoneShopName'])) >= 0);
  } else if (options.isHqChat) {
    filtered = bot_filterMetricsForChat_(rows, questionText);
  }

  const defaultYm = options.defaultYm || '';
  const ym = bot_parseYmFromText_(questionText, defaultYm);
  if (ym) filtered = filtered.filter((r) => String(r['対象年月']) === ym);

  return bot_formatMetricsAnswer_(filtered, questionText);
}

/*
 * bot_handleChatQuestion_ への追記例:
 *
 *   const metricsAnswer = bot_tryAnswerMetrics_(question, { isHqChat: true, defaultYm: '202605' });
 *   if (metricsAnswer) return metricsAnswer;
 *
 * bot_handleQuestion_ への追記例:
 *
 *   const metricsAnswer = bot_tryAnswerMetrics_(question, { lineUserId: lineUserId });
 *   if (metricsAnswer) return metricsAnswer;
 */
