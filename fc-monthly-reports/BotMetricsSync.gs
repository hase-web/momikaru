/**
 * フェーズ1: 店舗月次KPI → 本部サポート Bot 用スプレッドシートへ同期
 * Bot.gs 側は support-integration/Bot_MetricsHandlers.gs を参照
 */

var BOT_METRICS_SHEET_NAME_ = 'Bot_ReportMetrics';
var BOT_METRICS_SHEET_ID_KEY_ = 'BOT_METRICS_SHEET_ID';

var BOT_METRICS_HEADERS_ = [
  '対象年月',
  'kintoneShopName',
  '店舗名',
  '実売上',
  '来客数',
  '客単価',
  'ベッド稼働率',
  'ベッド稼働台数',
  '取りこぼし件数',
  '新規来客数',
  '新規リピート比率',
  '損益分岐点',
  '優先テーマ',
  '顧客分析補足JSON',
  '更新日時',
];

var REPORT_METRICS_EXTRA_SHEET_NAME_ = '店舗レポートナレッジ';
var REPORT_METRICS_EXTRA_HEADERS_ = [
  '対象年月',
  'kintoneShopName',
  '店舗名',
  '顧客分析補足JSON',
  '更新日時',
];

function getBotMetricsSpreadsheetId_() {
  var props = PropertiesService.getScriptProperties();
  return (
    String(props.getProperty(BOT_METRICS_SHEET_ID_KEY_) || '').trim() ||
    String(props.getProperty('BOT_QA_SHEET_ID') || '').trim()
  );
}

function ensureReportMetricsExtraSheet_() {
  return getOrCreateSheet_(
    getSpreadsheet_(),
    REPORT_METRICS_EXTRA_SHEET_NAME_,
    REPORT_METRICS_EXTRA_HEADERS_
  );
}

function saveReportMetricsExtras_(targetYm, kintoneShopName, shopName, rawMetrics) {
  var sheet = ensureReportMetricsExtraSheet_();
  var values = sheet.getDataRange().getValues();
  var rowIndex = -1;

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (String(row[0]) !== targetYm) continue;
    if (String(row[1]) !== kintoneShopName) continue;
    rowIndex = i + 1;
    break;
  }

  var extras = {
    リピート率: rawMetrics['リピート率'] != null ? rawMetrics['リピート率'] : null,
    年代別来客構成: rawMetrics['年代別来客構成'] || null,
    性別構成: rawMetrics['性別構成'] || null,
  };

  var out = [
    targetYm,
    kintoneShopName,
    shopName || '',
    JSON.stringify(extras),
    new Date(),
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, out.length).setValues([out]);
  } else {
    sheet.appendRow(out);
  }
}

function loadReportMetricsExtrasIndex_() {
  var sheet = ensureReportMetricsExtraSheet_();
  var values = sheet.getDataRange().getValues();
  var index = {};

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var key = String(row[0]) + '\t' + String(row[1]);
    index[key] = String(row[3] || '');
  }
  return index;
}

function ensureBotMetricsSheet_(ss) {
  return getOrCreateSheet_(ss, BOT_METRICS_SHEET_NAME_, BOT_METRICS_HEADERS_);
}

function kpiRecordToBotMetricsRow_(kpi, extrasJson) {
  return [
    kpi.targetYm,
    kpi.kintoneShopName,
    kpi.shopName || '',
    kpi.sales != null ? kpi.sales : '',
    kpi.visitors != null ? kpi.visitors : '',
    kpi.unitPrice != null ? kpi.unitPrice : '',
    kpi.bedUtilization != null ? kpi.bedUtilization : '',
    kpi.bedUtilizationUnits != null ? kpi.bedUtilizationUnits : '',
    kpi.missedAppointments != null ? kpi.missedAppointments : '',
    kpi.newVisitors != null ? kpi.newVisitors : '',
    kpi.newRepeatRatio != null ? kpi.newRepeatRatio : '',
    kpi.breakEven != null ? kpi.breakEven : '',
    kpi.priorityTheme || '',
    extrasJson || '',
    kpi.updatedAt || new Date(),
  ];
}

/**
 * Andy 店舗月次KPI を Bot_ReportMetrics へ全件同期（洗い替え）
 */
function syncReportMetricsToBot_() {
  var botSsId = getBotMetricsSpreadsheetId_();
  if (!botSsId) {
    throw new Error(
      'BOT_METRICS_SHEET_ID または BOT_QA_SHEET_ID をスクリプトプロパティに設定してください'
    );
  }

  var botSs = SpreadsheetApp.openById(botSsId);
  var sheet = ensureBotMetricsSheet_(botSs);
  var kpiSheet = ensureKpiSheet_();
  var kpiValues = kpiSheet.getDataRange().getValues();
  var extrasIndex = loadReportMetricsExtrasIndex_();
  var rows = [];

  for (var i = 1; i < kpiValues.length; i++) {
    var row = kpiValues[i];
    if (!String(row[0] || '').trim()) continue;
    var kpi = rowToKpiRecord_(row);
    var extrasKey = kpi.targetYm + '\t' + kpi.kintoneShopName;
    rows.push(kpiRecordToBotMetricsRow_(kpi, extrasIndex[extrasKey] || ''));
  }

  sheet.clearContents();
  sheet.getRange(1, 1, 1, BOT_METRICS_HEADERS_.length).setValues([BOT_METRICS_HEADERS_]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, BOT_METRICS_HEADERS_.length).setValues(rows);
  }

  return { written: rows.length, sheetId: botSsId, sheetName: BOT_METRICS_SHEET_NAME_ };
}

/** メニューから手動同期 */
function syncReportMetricsToBotNow() {
  var result = syncReportMetricsToBot_();
  var msg =
    'Bot_ReportMetrics へ同期しました\n' +
    '行数: ' +
    result.written +
    '\nシートID: ' +
    result.sheetId;
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
  return result;
}
