/**
 * エントリポイント・トリガー・メニュー
 */

/** 毎月4日 9:00（JST）— 前月分をコピー */
function runMonthlyCopy() {
  var target = getTargetYearMonth_();
  processMonthlyCopyForYm_(target.yyyyMM, { sendHqSummary: true });
}

/** 毎月5日 9:00（JST）— 前月分をオーナーへ通知 */
function runMonthlyNotify() {
  var target = getTargetYearMonth_();
  processMonthlyNotifyForYm_(target.yyyyMM, { sendHqSummary: true });
}

/** 初回: 2026年1月〜前月まで一括コピー（メールは送らない） */
function runBackfillCopyFrom2026() {
  var cfg = getConfig_();
  var end = getTargetYearMonth_();
  var months = listYearMonthsBetween_(cfg.BACKFILL_START_YM, end.yyyyMM);
  var destRoot = getDriveFolder_(cfg.DEST_ROOT_FOLDER_ID, 'コピー先（B_FC加盟店）');
  var directRoot = cfg.DIRECT_ROOT_FOLDER_ID
    ? getDriveFolder_(cfg.DIRECT_ROOT_FOLDER_ID, 'コピー先（直営店）')
    : null;
  var fcStoreCache = buildStoreFolderCache_(destRoot);
  var directStoreCache = directRoot ? buildStoreFolderCache_(directRoot) : null;
  var results = [];

  months.forEach(function (m) {
    results.push(
      processMonthlyCopyForYm_(m.yyyyMM, {
        sendHqSummary: false,
        fcStoreCache: fcStoreCache,
        directStoreCache: directStoreCache,
      })
    );
  });

  sendHqAlert_(
    '初回バックフィル完了',
    results
      .map(function (r) {
        return (
          r.targetYm +
          ': コピー' +
          r.copied +
          ' / スキップ' +
          r.skipped +
          ' / エラー' +
          r.errors.length +
          ' / 未マッチ' +
          r.unmatched.length
        );
      })
      .join('\n')
  );
}

/** ドライラン（当月処理対象=前月） */
function testDryRunCopy() {
  var target = getTargetYearMonth_();
  var result = processMonthlyCopyForYm_(target.yyyyMM, {
    dryRun: true,
    sendHqSummary: false,
    skipLog: true,
  });
  Logger.log(JSON.stringify(result, null, 2));
  var msg =
    'ドライラン完了: ' +
    target.label +
    '\nソース月フォルダ: ' +
    result.sourceFolders +
    '\n店舗数: ' +
    Object.keys(result.storesTouched || {}).length +
    '\n未マッチ: ' +
    (result.unmatched || []).length +
    '\nエラー: ' +
    (result.errors || []).length;
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}

/** 特定月を手動コピー（例: manualCopyForYm('202601')） */
function manualCopyForYm(yyyyMM) {
  return processMonthlyCopyForYm_(yyyyMM, { sendHqSummary: true });
}

/** 2026年6月分をコピー（引数不要・実行ボタン1発） */
function runCopy202606() {
  var result = manualCopyForYm('202606');
  showCopyResultAlert_(result, '2026年6月');
}

function showCopyResultAlert_(result, label) {
  var msg =
    label +
    ' コピー完了\n' +
    'コピー: ' +
    result.copied +
    '\nスキップ: ' +
    result.skipped +
    '\n未マッチ: ' +
    (result.unmatched || []).length +
    '\nエラー: ' +
    (result.errors || []).length;
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}

/** 特定月を手動通知 */
function manualNotifyForYm(yyyyMM) {
  return processMonthlyNotifyForYm_(yyyyMM, { sendHqSummary: true });
}

/** 月次トリガーを登録（初回セットアップ時に1回実行） */
function installMonthlyTriggers() {
  var handlers = [
    'runMonthlyCopy',
    'runMonthlyNotify',
    'continueMonthlyDelivery_',
    'continueMonthlyMetrics_',
    'continueFcMigrateBatch_',
    'continueFcRegrantBatch_',
  ];
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (handlers.indexOf(trigger.getHandlerFunction()) >= 0) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('runMonthlyCopy')
    .timeBased()
    .onMonthDay(4)
    .atHour(9)
    .inTimezone(FC_REPORT_CONFIG.TIMEZONE)
    .create();

  ScriptApp.newTrigger('runMonthlyNotify')
    .timeBased()
    .onMonthDay(5)
    .atHour(9)
    .inTimezone(FC_REPORT_CONFIG.TIMEZONE)
    .create();

  SpreadsheetApp.getUi().alert(
    'トリガーを登録しました。\n' +
      '・毎月4日 9:00 コピー\n' +
      '・毎月5日 9:00 オーナー配信（PDF確認→スーパーバイジング→LINE/メール）\n' +
      '・5日: 配信完了後に PDF から KPI 抽出 → Bot_ReportMetrics 同期\n' +
      '※5日処理は店舗数分バッチ処理します（数十分かかる場合があります）\n\n' +
      '【重要】オーナー配信は現在「' +
      getOwnerDeliveryStatusLabel_() +
      '」\n' +
      '本部承認前は無効のままにしてください。承認後に「本番配信を有効化」を実行。\n' +
      '※安全モードでも KPI 抽出・Bot 同期は実行されます。'
  );
}

function onOpen() {
  try {
    setupDeliveryChannelColumnOnOpen_();
  } catch (e) {
    Logger.log('setupDeliveryChannelColumnOnOpen_: ' + e);
  }

  SpreadsheetApp.getUi()
    .createMenu('FC月次レポート')
    .addItem('ドライラン（コピー確認）', 'testDryRunCopy')
    .addItem('2026年6月分をコピー', 'runCopy202606')
    .addItem('今月分コピー（前月レポート）', 'runMonthlyCopy')
    .addItem('今月分オーナー通知（要・本番有効化）', 'runMonthlyNotify')
    .addSeparator()
    .addSubMenu(
      SpreadsheetApp.getUi()
        .createMenu('本番配信の安全設定')
        .addItem('状態を確認', 'showOwnerDeliveryStatus')
        .addItem('本番配信を有効化（要本部承認）', 'enableOwnerDeliveryLive')
        .addItem('本番配信を停止（安全モード）', 'disableOwnerDeliveryLive')
    )
    .addSeparator()
    .addItem('フォルダIDを反映', 'patchFolderMappingIds')
    .addItem('フォルダIDを一括同期（初回のみ）', 'syncAllStoreFolderIds')
    .addItem('F列「配信方法」を追加・整備', 'setupDeliveryChannelColumnNow')
    .addItem('フォルダ確認（全店舗一覧）', 'auditFcStoreFolders')
    .addSubMenu(
      SpreadsheetApp.getUi()
        .createMenu('FC月次レポートフォルダ')
        .addItem('移行の進捗を確認', 'showFcMigrateProgress')
        .addItem('岩出店のみ移行（テスト）', 'migrateFcReportFoldersIwade')
        .addItem('岩出店：オーナーメール確認', 'previewOwnerEmailsIwade')
        .addItem('岩出店のみ共有付け直し（テスト）', 'regrantFcFolderAccessIwade')
        .addItem('全店舗：フォルダ移行（続きから）', 'migrateAllFcReportFolders')
        .addItem('フォルダ移行の続き', 'continueFcMigrateBatch_')
        .addItem('全店舗：共有付け直し（続きから）', 'regrantAllFcFolderAccess')
        .addItem('共有付け直しの続き', 'continueFcRegrantBatch_')
    )
    .addItem('初回バックフィル（2026/1〜）', 'runBackfillCopyFrom2026')
    .addItem('月次トリガー登録', 'installMonthlyTriggers')
    .addSeparator()
    .addItem('配信ドライラン（全店舗・送信なし）', 'testDryRunDelivery')
    .addItem('配信先確認（LINE/メール一覧）', 'auditDeliveryChannels')
    .addItem('1店舗テスト配信（本部LINEのみ・岩出店）', 'testDeliveryIwadeToMe')
    .addSeparator()
    .addSubMenu(
      SpreadsheetApp.getUi()
        .createMenu('BOT指標（フェーズ1）')
        .addItem('岩出店のみKPI抽出（PDF）', 'testExtractMetricsIwade')
        .addItem('前月分を全店舗抽出', 'runMonthlyMetricsExtraction')
        .addItem('Bot_ReportMetricsへ同期', 'syncReportMetricsToBotNow')
    )
    .addSeparator()
    .addItem('コックピットを開く', 'openCockpit')
    .addItem('コックピット v1（単店舗）', 'openCockpitV1')
    .addToUi();
}

/** 店舗シートのタブ名を確認（トラブル時） */
function listSpreadsheetTabs() {
  var ss = getSpreadsheet_();
  var names = ss.getSheets().map(function (s) {
    return s.getName() + (sheetHasShopHeaders_(s) ? ' ← 店舗マスタ' : '');
  });
  SpreadsheetApp.getUi().alert('タブ一覧:\n' + names.join('\n'));
}

/** Drive フォルダへのアクセス確認（トラブル時に実行） */
function testDriveAccess() {
  var cfg = getConfig_();
  var user = '';
  try {
    user = Session.getActiveUser().getEmail();
  } catch (e) {
    user = '';
  }
  var lines = ['実行アカウント: ' + (user || '（取得できず）'), ''];

  try {
    var src = getDriveFolder_(cfg.SOURCE_ROOT_FOLDER_ID, 'コピー元（月次レポート置場）');
    lines.push('OK コピー元: ' + src.getName());
    lines.push('   ID: ' + cfg.SOURCE_ROOT_FOLDER_ID);
  } catch (e) {
    lines.push('NG コピー元: ' + e);
  }

  lines.push('');

  try {
    var dest = getDriveFolder_(cfg.DEST_ROOT_FOLDER_ID, 'コピー先（B_FC加盟店）');
    lines.push('OK コピー先: ' + dest.getName());
    lines.push('   ID: ' + cfg.DEST_ROOT_FOLDER_ID);
  } catch (e) {
    lines.push('NG コピー先: ' + e);
  }

  SpreadsheetApp.getUi().alert(lines.join('\n'));
}

/**
 * スプレッドシートを開いたとき — F列がなければ自動追加
 */
function setupDeliveryChannelColumnOnOpen_() {
  var cfg = getConfig_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;
  var sheet = ss.getSheetByName(cfg.FOLDER_MAPPING_SHEET_NAME);
  if (!sheet) return;
  if (String(sheet.getRange('F1').getDisplayValue() || '').trim() === '配信方法') return;
  setupDeliveryChannelColumnCore_(sheet);
}

/**
 * F列「配信方法」を強制追加（メニュー・Apps Script エディタから実行）
 */
function setupDeliveryChannelColumnNow() {
  var cfg = getConfig_();
  var ss = SpreadsheetApp.openById(cfg.SPREADSHEET_ID);
  var sheetName = cfg.FOLDER_MAPPING_SHEET_NAME;
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    var tabList = ss.getSheets()
      .map(function (s) {
        return '・' + s.getName();
      })
      .join('\n');
    logOrAlert_(
      'タブ「' + sheetName + '」が見つかりません。\n\n現在のタブ:\n' + tabList
    );
    return;
  }

  var count = setupDeliveryChannelColumnCore_(sheet);
  Logger.log(
    '完了: F列「配信方法」を追加しました（' +
      count +
      '店舗分）。スプレッドシートの「' +
      sheetName +
      '」タブのF列を確認してください。'
  );
}

/** UIが使えるときだけアラート（エディタ実行では呼ばない） */
function logOrAlert_(message) {
  Logger.log(message);
}

/** @return {number} 配信方法を入れた店舗行数 */
function setupDeliveryChannelColumnCore_(sheet) {
  sheet.getRange('F1').setValue('配信方法').setFontWeight('bold');
  sheet.setColumnWidth(6, 140);

  var lastRow = getLastDataRowInColumn_(sheet, 1);
  var filled = 0;

  if (lastRow >= 2) {
    var numRows = lastRow - 1;
    var aValues = sheet.getRange(2, 1, numRows, 1).getValues();
    var range = sheet.getRange(2, 6, numRows, 1);
    var values = range.getValues();
    for (var i = 0; i < values.length; i++) {
      var shopName = String(aValues[i][0] || '').trim();
      if (!shopName) {
        values[i][0] = '';
        continue;
      }
      if (!String(values[i][0] || '').trim()) {
        values[i][0] = 'LINE';
        filled += 1;
      }
    }
    range.setValues(values);

    var options = ['', 'LINE', 'LINE+メール', 'メール', 'LINEのみ', '両方'];
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(options, true)
      .setAllowInvalid(true)
      .build();
    sheet.getRange(2, 6, numRows, 1).setDataValidation(rule);
  }

  sheet.getRange('F1').setNote(
    'LINE=基本 / LINE+メール=LINEとメール両方 / メール=メールのみ'
  );

  return filled;
}

function getLastDataRowInColumn_(sheet, col) {
  var maxScan = Math.min(sheet.getLastRow(), 2000);
  if (maxScan < 2) return maxScan;
  var values = sheet.getRange(1, col, maxScan, 1).getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0] || '').trim()) return i + 1;
  }
  return 1;
}

/** 店舗行の追加のみ（アラートなし） */
function syncDeliveryChannelRowsQuiet_(sheet) {
  var shops = loadShopMaster_();
  var values = sheet.getDataRange().getValues();
  var existing = {};
  var i;

  for (i = 1; i < values.length; i++) {
    var key = String(values[i][0] || '').trim();
    if (key) existing[key] = true;
  }

  shops.forEach(function (shop) {
    var kn = shop.kintoneShopName;
    if (!kn || existing[kn]) return;
    sheet.appendRow([kn, kn, 'FC', '', '', 'LINE']);
    existing[kn] = true;
  });
}

/**
 * B_FC加盟店 内に kintoneShopName と同名フォルダがあるか全店舗チェック
 * 結果は「フォルダ確認」タブに出力
 */
function auditFcStoreFolders() {
  var cfg = getConfig_();
  var sheetName = 'フォルダ確認';
  var headers = [
    'kintoneShopName',
    '店舗名(name)',
    '種別',
    'Driveフォルダ名',
    'メール',
    'フォルダ',
    'フォルダパス',
    '備考',
  ];

  ensureFolderMappingSheet_();
  var folderMappings = loadFolderMappings_();
  var shops = loadShopMaster_();
  var caches = buildDriveCaches_({});

  var rows = shops.map(function (shop) {
    var mapping = getFolderMappingForShop_(shop.kintoneShopName, folderMappings);
    var hits = [];
    var status = 'なし';
    var path = '';
    var note = '';

    try {
      var resolved = resolveStoreFolder_(
        shop.kintoneShopName,
        caches.fcCache,
        caches.directCache,
        folderMappings
      );
      if (resolved) {
        status = 'あり';
        path = resolved.folder.getName();
        if (mapping.driveFolderId) {
          note = 'ID指定';
        }
      }
    } catch (e) {
      status = 'エラー';
      note = String(e);
    }

    return [
      shop.kintoneShopName,
      shop.name,
      mapping.storeType,
      mapping.driveFolderName,
      shop.mail,
      status,
      path,
      note,
    ];
  });

  rows.sort(function (a, b) {
    if (a[5] === b[5]) return String(a[0]).localeCompare(String(b[0]), 'ja');
    return a[5] === 'なし' ? -1 : b[5] === 'なし' ? 1 : 0;
  });

  var ss = getSpreadsheet_();
  var old = ss.getSheetByName(sheetName);
  if (old) ss.deleteSheet(old);
  var sheet = ss.insertSheet(sheetName);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  var missing = rows.filter(function (r) {
    return r[5] === 'なし';
  }).length;

  var msg =
    'フォルダ確認タブを更新しました。\n' +
    '全店舗: ' +
    rows.length +
    '\nフォルダなし: ' +
    missing +
    '\nフォルダあり: ' +
    (rows.length - missing);

  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}
