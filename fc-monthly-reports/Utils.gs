function getConfig_() {
  if (!FC_REPORT_CONFIG.DEST_ROOT_FOLDER_ID) {
    throw new Error(
      'Config.gs の DEST_ROOT_FOLDER_ID（B_FC加盟店）を設定してください。'
    );
  }
  return FC_REPORT_CONFIG;
}

/**
 * 実行対象月 = 前月（毎月4日・5日バッチ用）
 * @return {{yyyyMM:string, year:number, month:number, label:string}}
 */
function getTargetYearMonth_(date) {
  var d = date ? new Date(date.getTime()) : new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  var year = d.getFullYear();
  var month = d.getMonth() + 1;
  var yyyyMM = '' + year + (month < 10 ? '0' : '') + month;
  return {
    yyyyMM: yyyyMM,
    year: year,
    month: month,
    label: year + '年' + month + '月',
  };
}

function parseYmFromFolderName_(folderName) {
  var m = String(folderName).match(/^(\d{4})(\d{2})/);
  if (!m) return null;
  return { yyyyMM: m[1] + m[2], year: Number(m[1]), month: Number(m[2]) };
}

function detectReportType_(folderName, fileName) {
  var text = folderName + ' ' + fileName;
  if (text.indexOf('月次レポート') !== -1) return '月次レポート';
  if (text.indexOf('顧客分析') !== -1) return '顧客分析';
  return null;
}

function isExcludedFile_(fileName) {
  return String(fileName).indexOf('全店舗') !== -1;
}

function normalizeEmail_(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

/** userm / shopm の id 突合（"87.0" → "87"） */
function normUserId_(value) {
  if (value === null || value === undefined) return '';
  var s = String(value).trim();
  if (!s || s === 'NULL') return '';
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '');
  return s;
}

/** userm.userStop / adminLevel（シート上の数値・"21.0" 対応） */
function normUserStop_(value) {
  return normUserId_(value);
}

function normAdminLevel_(value) {
  return normUserId_(value);
}

function isFcOwnerAdminLevel_(level) {
  return normAdminLevel_(level) === String(getConfig_().FC_OWNER_ADMIN_LEVEL || '21');
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Drive 共有 API — ユーザー未登録（英語・日本語） */
function isDriveNoSuchUserError_(message) {
  var msg = String(message || '');
  return (
    msg.indexOf('No such user') !== -1 ||
    msg.indexOf('such user') !== -1 ||
    msg.indexOf('ユーザーが存在しません') !== -1 ||
    msg.indexOf('存在しないユーザー') !== -1 ||
    msg.indexOf('invalid user') !== -1
  );
}

/** Drive 共有 API — 閲覧者でない / 権限なし（解除時） */
function isDriveNotViewerError_(message) {
  var msg = String(message || '');
  return (
    msg.indexOf('permission') !== -1 ||
    msg.indexOf('権限') !== -1 ||
    msg.indexOf('not found') !== -1 ||
    msg.indexOf('Invalid') !== -1 ||
    msg.indexOf('閲覧者') !== -1
  );
}

function formatMonthFolderName_(month) {
  return (month < 10 ? '0' : '') + month + '月';
}

/**
 * 配信文面用 — AIが付けがちな Markdown 記法を除去してプレーンテキストにする
 */
function sanitizeDeliveryText_(text) {
  if (!text) return '';

  var lines = String(text).split('\n');
  var out = [];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim();

    if (/^[\s#*\-─━=_]{3,}$/.test(trimmed)) continue;
    if (/^-{3,}$/.test(trimmed)) continue;

    line = line.replace(/^#{1,6}\s+/, '');
    line = line.replace(/\*\*([^*]+)\*\*/g, '$1');
    line = line.replace(/__([^_]+)__/g, '$1');
    line = line.replace(/\*([^*\s][^*]*?)\*/g, '$1');
    line = line.replace(/_([^_\s][^_]*?)_/g, '$1');
    if (/^-\s+/.test(line)) line = '・' + line.replace(/^-\s+/, '');

    out.push(line);
  }

  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(getConfig_().SPREADSHEET_ID);
}

function getOrCreateSheet_(spreadsheet, name, headers) {
  name = String(name || '').trim();
  if (!name) {
    throw new Error('作成対象のシート名が空です（Config.gs の SUPERVISING_SHEET_NAME / KPI_SHEET_NAME 等を確認してください）');
  }
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
    if (headers && headers.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

var LOG_BATCH_ = null;
var LOG_SKIP_ = false;

function setLogSkip_(skip) {
  LOG_SKIP_ = !!skip;
}

function beginLogBatch_() {
  LOG_BATCH_ = [];
}

function flushLogBatch_() {
  if (!LOG_BATCH_ || !LOG_BATCH_.length) {
    LOG_BATCH_ = null;
    return;
  }
  var cfg = getConfig_();
  var headers = [
    '処理日時',
    '対象年月',
    '店舗名',
    'kintoneShopName',
    'レポート種別',
    'ファイル名',
    'コピー先URL',
    'コピー',
    '権限付与',
    'メール通知',
    'エラー',
  ];
  var sheet = getOrCreateSheet_(getSpreadsheet_(), cfg.LOG_SHEET_NAME, headers);
  var startRow = sheet.getLastRow() + 1;
  sheet
    .getRange(startRow, 1, LOG_BATCH_.length, headers.length)
    .setValues(LOG_BATCH_);
  LOG_BATCH_ = null;
}

function appendLogRow_(row) {
  if (LOG_SKIP_) return;
  if (LOG_BATCH_) {
    LOG_BATCH_.push(row);
    return;
  }
  var cfg = getConfig_();
  var headers = [
    '処理日時',
    '対象年月',
    '店舗名',
    'kintoneShopName',
    'レポート種別',
    'ファイル名',
    'コピー先URL',
    'コピー',
    '権限付与',
    'メール通知',
    'エラー',
  ];
  var sheet = getOrCreateSheet_(getSpreadsheet_(), cfg.LOG_SHEET_NAME, headers);
  sheet.appendRow(row);
}

function sendHqAlert_(subject, body) {
  var cfg = getConfig_();
  if (!cfg.HQ_ALERT_EMAIL || !isValidEmail_(cfg.HQ_ALERT_EMAIL)) return;
  MailApp.sendEmail({
    to: cfg.HQ_ALERT_EMAIL,
    subject: '【FC月次レポート自動化】' + subject,
    body: body,
  });
}

function listYearMonthsBetween_(startYm, endYm) {
  var result = [];
  var y = Number(startYm.slice(0, 4));
  var m = Number(startYm.slice(4, 6));
  var endY = Number(endYm.slice(0, 4));
  var endM = Number(endYm.slice(4, 6));

  while (y < endY || (y === endY && m <= endM)) {
    var yyyyMM = '' + y + (m < 10 ? '0' : '') + m;
    result.push({
      yyyyMM: yyyyMM,
      year: y,
      month: m,
      label: y + '年' + m + '月',
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return result;
}

/**
 * Drive フォルダを開く（どの ID で失敗したか分かるエラー）
 */
function getDriveFolder_(folderId, label) {
  var id = String(folderId || '').trim();
  if (!id) {
    throw new Error(label + ' のフォルダ ID が空です。Config.gs を確認してください。');
  }
  try {
    return DriveApp.getFolderById(id);
  } catch (e) {
    var userEmail = '（取得できず）';
    try {
      userEmail = Session.getActiveUser().getEmail() || userEmail;
    } catch (err) {
      // noop
    }
    throw new Error(
      label +
        ' にアクセスできません。\n' +
        'フォルダ ID: ' +
        id +
        '\n' +
        '・Config.gs の ID が正しいか\n' +
        '・スクリプト実行アカウント（' +
        userEmail +
        '）にフォルダの閲覧権限があるか\n' +
        'を確認してください。\n' +
        '元のエラー: ' +
        e
    );
  }
}
