/**
 * オーナーへの月次配信（毎月5日）
 * 月次PDF + 顧客分析PDF が揃った店舗に、スーパーバイジング付きメールを自動送信
 */

var DELIVERY_STATE_KEY_ = 'monthly_delivery_state_v1';
var OWNER_DELIVERY_ENABLED_KEY_ = 'OWNER_DELIVERY_ENABLED';

/** オーナーへの本番配信（LINE・メール）が許可されているか。未設定=無効 */
function isOwnerDeliveryLive_() {
  return (
    PropertiesService.getScriptProperties().getProperty(OWNER_DELIVERY_ENABLED_KEY_) ===
    'true'
  );
}

function setOwnerDeliveryLive_(enabled) {
  PropertiesService.getScriptProperties().setProperty(
    OWNER_DELIVERY_ENABLED_KEY_,
    enabled ? 'true' : 'false'
  );
}

function getOwnerDeliveryStatusLabel_() {
  return isOwnerDeliveryLive_() ? '有効（オーナーに送信する）' : '無効（安全モード）';
}

function buildTargetLabel_(targetYm) {
  return targetYm.slice(0, 4) + '年' + Number(targetYm.slice(4, 6)) + '月';
}

function buildTargetMeta_(targetYm) {
  return {
    yyyyMM: targetYm,
    year: Number(targetYm.slice(0, 4)),
    month: Number(targetYm.slice(4, 6)),
    label: buildTargetLabel_(targetYm),
  };
}

function isDeliveryExcludedShop_(shop) {
  return String(shop.name || '').indexOf('出張もみかる') !== -1;
}

function loadDeliveryTargetShops_(targetYm) {
  return loadShopMaster_().filter(function (shop) {
    if (!isShopActiveForMonth_(shop, targetYm)) return false;
    if (isDeliveryExcludedShop_(shop)) return false;
    return true;
  });
}

function formatKpiSummaryBlock_(kpi) {
  if (!kpi) return '';

  var lines = ['【今月の主な数値（月次レポートより）】'];
  if (kpi.sales != null) lines.push('・実売上：' + formatYen_(kpi.sales));
  if (kpi.visitors != null) lines.push('・来客数：' + Math.round(kpi.visitors) + '人');
  if (kpi.unitPrice != null) lines.push('・客単価：' + formatYen_(kpi.unitPrice));
  if (kpi.bedUtilization != null) {
    lines.push('・ベッド稼働率：' + kpi.bedUtilization + '%');
  }
  if (kpi.missedAppointments != null) {
    lines.push('・取りこぼし：' + Math.round(kpi.missedAppointments) + '件');
  }
  if (kpi.newVisitors != null) lines.push('・新規来客数：' + Math.round(kpi.newVisitors) + '人');
  if (kpi.newRepeatRatio != null) {
    lines.push('・新規リピート比率：' + kpi.newRepeatRatio + '%');
  }

  if (lines.length <= 1) return '';
  lines.push('');
  lines.push('※上記はレポート記載値の抜粋です。詳細はPDFをご確認ください。');
  return lines.join('\n');
}

function buildOwnerDeliveryEmail_(shop, target, fcReportFolderUrl, kpi, supervisingBody) {
  var fcName = getFcReportRootFolderName_();
  var parts = [
    shop.name + ' オーナー様',
    '',
    'いつもお世話になっております。もみかるFC本部です。',
    '',
    target.label +
      '分の「月次レポート」「顧客分析」（PDF）を、貴店専用の Google ドライブフォルダ（' +
      fcName +
      '）に格納いたしました。',
    '',
    '▼ 貴店フォルダ（閲覧用）',
    fcReportFolderUrl,
    '',
    'フォルダ内の構成:',
    '  ・' + fcName + ' / 月次レポート / ' + target.year + ' / ' + formatMonthFolderName_(target.month) + ' /',
    '  ・' + fcName + ' / 顧客分析 / ' + target.year + ' / ' + formatMonthFolderName_(target.month) + ' /',
    '',
  ];

  var kpiBlock = formatKpiSummaryBlock_(kpi);
  if (kpiBlock) {
    parts.push(kpiBlock);
    parts.push('');
  }

  parts.push('【スーパーバイジング】');
  parts.push('');
  parts.push(sanitizeDeliveryText_(supervisingBody));
  parts.push('');
  parts.push('ご不明点がございましたら、本部までお問い合わせください。');
  parts.push('');
  parts.push('もみかるFC本部');

  return parts.join('\n');
}

function wasAlreadyNotified_(targetYm, kintoneShopName) {
  var cfg = getConfig_();
  var sheet = getSpreadsheet_().getSheetByName(cfg.LOG_SHEET_NAME);
  if (!sheet) return false;

  var values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    var row = values[i];
    if (String(row[1]) !== targetYm) continue;
    if (String(row[3]) !== kintoneShopName) continue;
    if (String(row[9]) === 'sent') return true;
  }
  return false;
}

function markNotifySent_(targetYm, kintoneShopName, note) {
  var cfg = getConfig_();
  var sheet = getSpreadsheet_().getSheetByName(cfg.LOG_SHEET_NAME);
  if (!sheet) return;

  var values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    var row = values[i];
    if (String(row[1]) !== targetYm) continue;
    if (String(row[3]) !== kintoneShopName) continue;
    if (String(row[9]) === 'sent') return;
    sheet.getRange(i + 1, 10).setValue('sent');
    if (note) sheet.getRange(i + 1, 11).setValue(note);
    return;
  }

  appendLogRow_([
    new Date(),
    targetYm,
    '',
    kintoneShopName,
    '通知',
    '',
    '',
    '',
    '',
    'sent',
    note || '',
  ]);
}

function getDeliveryState_() {
  var raw = PropertiesService.getScriptProperties().getProperty(DELIVERY_STATE_KEY_);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function setDeliveryState_(state) {
  PropertiesService.getScriptProperties().setProperty(
    DELIVERY_STATE_KEY_,
    JSON.stringify(state)
  );
}

function clearDeliveryState_() {
  PropertiesService.getScriptProperties().deleteProperty(DELIVERY_STATE_KEY_);
}

function clearDeliveryContinuationTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'continueMonthlyDelivery_') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function scheduleDeliveryContinuation_() {
  clearDeliveryContinuationTriggers_();
  ScriptApp.newTrigger('continueMonthlyDelivery_')
    .timeBased()
    .after(90 * 1000)
    .create();
}

function resolveStoreFolderForDelivery_(shop, folderMappings) {
  var resolved = resolveStoreFolderFast_(shop.kintoneShopName, folderMappings);
  if (resolved && resolved.folder) return resolved;

  var caches = buildDriveCaches_({});
  resolved = resolveStoreFolder_(
    shop.kintoneShopName,
    caches.fcCache,
    caches.directCache,
    folderMappings
  );
  return resolved;
}

/**
 * 1店舗分の配信処理
 */
function deliverMonthlyReportForShop_(shop, targetYm, target, options) {
  options = options || {};
  var dryRun = !!options.dryRun;
  var testMode = !!options.testMode;

  if (!dryRun && !testMode && !isOwnerDeliveryLive_()) {
    return { status: 'blocked', reason: '本番配信無効（安全モード）' };
  }

  var testLineUserId = String(options.testLineUserId || getDeliveryTestLineUserId_() || '').trim();
  var ownerIndex = options.ownerIndex || {};
  var ownerUserIndex = options.ownerUserIndex || {};
  var lineLinkIndex = options.lineLinkIndex || {};
  var folderMappings = options.folderMappings || loadFolderMappings_();
  var channels = resolveDeliveryChannels_(shop, folderMappings);

  if (!testMode && wasAlreadyNotified_(targetYm, shop.kintoneShopName)) {
    return { status: 'skipped', reason: '送信済み' };
  }

  var lineUserIds = channels.useLine
    ? resolveLineUserIdsForShop_(shop, ownerUserIndex, lineLinkIndex)
    : [];
  var emails =
    channels.useMail || channels.fallbackToMail
      ? resolveOwnerEmailsForShop_(shop, ownerIndex)
      : [];

  var realLineUserIds = lineUserIds.slice();
  var realEmails = emails.slice();

  if (testMode) {
    if (!testLineUserId) {
      return {
        status: 'error',
        reason:
          'テスト用 lineUserId がありません。スクリプトプロパティ DELIVERY_TEST_LINE_USER_ID を設定するか、testLineUserId を渡してください',
      };
    }
    lineUserIds = [testLineUserId];
    emails = [];
    channels = {
      raw: 'テスト',
      useLine: true,
      useMail: false,
      useChatPost: false,
    };
  }

  var canLine = channels.useLine && lineUserIds.length > 0;
  var canMail = channels.useMail && emails.length > 0;
  var mailFallback = false;
  if (!canMail && channels.fallbackToMail && !canLine && emails.length) {
    canMail = true;
    mailFallback = true;
  }

  if (!canLine && !canMail) {
    if (channels.useLine && !lineUserIds.length && !channels.fallbackToMail) {
      return { status: 'error', reason: 'LINE未登録（配信方法=LINEのみ）' };
    }
    if (channels.useLine && !lineUserIds.length && channels.fallbackToMail && !emails.length) {
      return {
        status: 'error',
        reason: 'LINE未登録かつメールなし（userxshop→line_link / userm.mail を確認）',
      };
    }
    if (channels.useMail && !emails.length) {
      return { status: 'error', reason: 'オーナーメールなし' };
    }
    return { status: 'error', reason: '送信先なし' };
  }

  if (!linkSupervisingPdfsFromStore_(targetYm, shop.kintoneShopName)) {
    return { status: 'pending', reason: 'PDF未揃い（月次・顧客分析の両方が必要）' };
  }

  var resolved = resolveStoreFolderForDelivery_(shop, folderMappings);
  if (!resolved || !resolved.folder) {
    return { status: 'error', reason: '店舗フォルダなし' };
  }

  var storeFolder = resolved.folder;
  var fcReportFolder = getOrCreateFcReportRootFolder_(storeFolder, dryRun);
  var supervisingBody = '';
  var generated = false;

  if (dryRun) {
    var existing = loadSupervisingRecord_(targetYm, shop.kintoneShopName);
    supervisingBody =
      getSupervisingDisplayBody_(existing) || '（ドライラン：AI生成はスキップ）';
  } else {
    emails.forEach(function (email) {
      try {
        revokeViewerIfNeeded_(storeFolder, email, false);
        grantViewerIfNeeded_(fcReportFolder, email, false);
      } catch (e) {
        // 権限付与失敗はログのみ
      }
    });

    var prepared = prepareSupervisingBodyForDelivery_(targetYm, shop.kintoneShopName);
    supervisingBody = prepared.body;
    generated = prepared.generated;
  }

  var kpi = loadKpiRecord_(targetYm, shop.kintoneShopName);
  var subject =
    '【もみかるFC】' +
    target.label +
    ' 月次レポート・顧客分析・スーパーバイジング（' +
    shop.kintoneShopName +
    '）';
  var body = buildOwnerDeliveryEmail_(
    shop,
    target,
    fcReportFolder.getUrl(),
    kpi,
    supervisingBody
  );

  if (testMode) {
    body =
      '【テスト配信・本部確認用】\n' +
      '本来の店舗: ' +
      shop.kintoneShopName +
      '（' +
      shop.name +
      '）\n' +
      '本来のLINE宛先数: ' +
      realLineUserIds.length +
      ' / メール: ' +
      realEmails.length +
      '件\n' +
      '※オーナーには届いていません\n' +
      '────────────────\n\n' +
      body;
  }

  if (dryRun) {
    var predicted = '不明';
    if (canLine && canMail && channels.useMail) predicted = 'LINE+メール';
    else if (canLine && channels.normalized === 'LINE+メール' && !canMail) {
      predicted = 'LINEのみ（メール未登録）';
    }
    else if (canLine) predicted = 'LINE';
    else if (canMail && mailFallback) predicted = 'メール(フォールバック)';
    else if (canMail) predicted = 'メール';

    return {
      status: 'dry_run',
      channels: channels.raw || 'LINE',
      predicted: predicted,
      lineUserIds: lineUserIds,
      emails: emails,
      realLineUserIds: realLineUserIds,
      realEmails: realEmails,
      testMode: testMode,
      generated: generated,
      subject: subject,
      supervisingReady: supervisingBody.indexOf('ドライラン') < 0,
    };
  }

  var channelNotes = [];
  var lineResult = { lineSent: 0, chatPosted: false };

  if (channels.useLine && lineUserIds.length) {
    var chatPrefix = testMode
      ? ''
      : '【月次配信・' + shop.kintoneShopName + '】\n';
    if (!testMode) {
      lineResult = deliverLineAndChat_(lineUserIds, chatPrefix, body);
    } else {
      pushLineMessages_(lineUserIds[0], body);
      lineResult.lineSent = 1;
    }
    channelNotes.push('LINE:' + lineResult.lineSent + (testMode ? '(テスト)' : ''));
    if (lineResult.chatPosted) channelNotes.push('Chat:OK');
  } else if (channels.useLine && !lineUserIds.length && (channels.useMail || mailFallback)) {
    channelNotes.push('LINE:スキップ(未登録)');
  }

  if (canMail && emails.length) {
    MailApp.sendEmail({
      to: emails.join(','),
      subject: subject,
      body: body,
    });
    channelNotes.push(
      (mailFallback ? 'mail:fallback:' : 'mail:') + emails.join(',')
    );
  }

  if (!channelNotes.length) {
    return { status: 'error', reason: '送信チャネルなし' };
  }

  if (!testMode) {
    markNotifySent_(
      targetYm,
      shop.kintoneShopName,
      (generated ? 'auto_sent+ai' : 'auto_sent+approved') + '|' + channelNotes.join('|')
    );
  }

  appendLogRow_([
    new Date(),
    targetYm,
    shop.name,
    shop.kintoneShopName,
    testMode ? '通知(テスト)' : '通知',
    '',
    fcReportFolder.getUrl(),
    testMode ? 'test' : 'sent',
    channelNotes.join(' / '),
    testMode ? '' : 'sent',
    (testMode ? 'テスト→' + testLineUserId + ' ' : '') + (generated ? 'ai生成' : '承認済み'),
  ]);

  return {
    status: testMode ? 'test_sent' : 'sent',
    channels: channels.raw,
    lineUserIds: lineUserIds,
    emails: emails,
    realLineUserIds: realLineUserIds,
    realEmails: realEmails,
    testMode: testMode,
    generated: generated,
    lineSent: lineResult.lineSent,
  };
}

/**
 * バッチ配信（全店舗を数店舗ずつ処理し、残りは継続トリガー）
 */
function processMonthlyDeliveryBatch_(targetYm, offset, options) {
  options = options || {};
  var cfg = getConfig_();
  var batchSize = options.batchSize || cfg.DELIVERY_BATCH_SIZE || 3;
  var target = buildTargetMeta_(targetYm);
  var shops = loadDeliveryTargetShops_(targetYm);
  var ownerIndex = loadOwnerEmailIndex_();
  var ownerUserIndex = loadOwnerUserIdsIndex_();
  var lineLinkIndex = loadLineLinkByUsermIndex_();
  var folderMappings = loadFolderMappings_();

  var summary = {
    targetYm: targetYm,
    offset: offset,
    total: shops.length,
    processed: 0,
    sent: 0,
    skipped: 0,
    pending: 0,
    errors: [],
  };

  var slice = shops.slice(offset, offset + batchSize);
  slice.forEach(function (shop) {
    summary.processed += 1;
    try {
      var result = deliverMonthlyReportForShop_(shop, targetYm, target, {
        dryRun: options.dryRun,
        ownerIndex: ownerIndex,
        ownerUserIndex: ownerUserIndex,
        lineLinkIndex: lineLinkIndex,
        folderMappings: folderMappings,
      });

      if (result.status === 'sent' || result.status === 'dry_run') summary.sent += 1;
      else if (result.status === 'skipped') summary.skipped += 1;
      else if (result.status === 'pending') summary.pending += 1;
      else if (result.status === 'blocked') summary.blocked = (summary.blocked || 0) + 1;
      else if (result.status === 'error') {
        summary.errors.push(shop.kintoneShopName + ': ' + result.reason);
      }
    } catch (e) {
      summary.errors.push(shop.kintoneShopName + ': ' + String(e));
    }
  });

  var nextOffset = offset + slice.length;
  var hasMore = nextOffset < shops.length;

  if (hasMore && !options.dryRun) {
    setDeliveryState_({
      targetYm: targetYm,
      offset: nextOffset,
      startedAt: new Date().toISOString(),
    });
    scheduleDeliveryContinuation_();
  } else {
    clearDeliveryState_();
    clearDeliveryContinuationTriggers_();

    if (!options.dryRun && options.sendHqSummary !== false) {
      sendHqAlert_(
        target.label + ' オーナー配信完了',
        [
          '対象店舗: ' + shops.length,
          '今回処理: ' + summary.processed + '（offset ' + offset + '）',
          '送信/試行: ' + summary.sent,
          'スキップ（送信済）: ' + summary.skipped,
          'PDF未揃い: ' + summary.pending,
          summary.errors.length
            ? '【エラー】\n' + summary.errors.join('\n')
            : 'エラー: なし',
          hasMore ? '' : '全バッチ完了',
        ].join('\n')
      );
    }

    if (!hasMore && !options.dryRun) {
      try {
        runMonthlyMetricsPipeline_(targetYm, { sendHqSummary: true, syncBot: true });
      } catch (metricsErr) {
        Logger.log('runMonthlyMetricsPipeline_ (after delivery): ' + metricsErr);
        if (options.sendHqSummary !== false) {
          sendHqAlert_(
            target.label + ' KPI抽出エラー',
            String(metricsErr)
          );
        }
      }
    }
  }

  summary.nextOffset = nextOffset;
  summary.hasMore = hasMore;
  return summary;
}

/** 毎月5日トリガーから呼ばれる */
function processMonthlyNotifyForYm_(targetYm, options) {
  options = options || {};

  if (!options.dryRun && !isOwnerDeliveryLive_()) {
    var target = buildTargetMeta_(targetYm);
    var msg =
      target.label +
      ' のオーナー配信は実行されませんでした。\n' +
      '理由: 本番配信が無効（安全モード）\n' +
      '本部承認後、メニュー「本番配信を有効化」を実行してください。';
    sendHqAlert_('オーナー配信スキップ（安全モード）', msg);
    try {
      runMonthlyMetricsPipeline_(targetYm, { sendHqSummary: true, syncBot: true });
    } catch (metricsErr) {
      Logger.log('runMonthlyMetricsPipeline_ (safe mode): ' + metricsErr);
    }
    try {
      SpreadsheetApp.getUi().alert(msg);
    } catch (e) {
      Logger.log(msg);
    }
    return {
      blocked: true,
      reason: 'OWNER_DELIVERY_DISABLED',
      targetYm: targetYm,
    };
  }

  clearDeliveryState_();
  clearDeliveryContinuationTriggers_();
  return processMonthlyDeliveryBatch_(targetYm, 0, options);
}

/** バッチ継続（内部トリガー） */
function continueMonthlyDelivery_() {
  var state = getDeliveryState_();
  if (!state || !state.targetYm) return;

  clearDeliveryContinuationTriggers_();
  processMonthlyDeliveryBatch_(state.targetYm, state.offset || 0, {
    sendHqSummary: true,
  });
}

/** ドライラン（AI生成なし・全店舗シミュレーション） */
function testDryRunDelivery() {
  var target = getTargetYearMonth_();
  var summary = runDeliveryPreFlight_(target.yyyyMM);
  var msg =
    '配信ドライラン（全店舗）\n' +
    '対象月: ' +
    target.label +
    '\n\n' +
    '配信可: ' +
    summary.ready +
    '店舗\n' +
    '  LINE: ' +
    summary.viaLine +
    ' / メール(フォールバック): ' +
    summary.viaMailFallback +
    ' / メールのみ: ' +
    summary.viaMailOnly +
    ' / 両方: ' +
    summary.viaBoth +
    '\n\n' +
    'PDF未揃い: ' +
    summary.pending +
    '\n送信済みスキップ: ' +
    summary.skipped +
    '\n不可: ' +
    summary.blocked +
    '\n\n' +
    '詳細は「配信ドライラン」シートを確認してください。';
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
  Logger.log(JSON.stringify(summary, null, 2));
}

/**
 * 5日前の本番確認 — 全店舗を送信せずに配信可否を一覧化
 */
function runDeliveryPreFlight_(targetYm) {
  var target = buildTargetMeta_(targetYm);
  var shops = loadDeliveryTargetShops_(targetYm);
  var ownerIndex = loadOwnerEmailIndex_();
  var ownerUserIndex = loadOwnerUserIdsIndex_();
  var lineLinkIndex = loadLineLinkByUsermIndex_();
  var folderMappings = loadFolderMappings_();

  var summary = {
    targetYm: targetYm,
    total: shops.length,
    ready: 0,
    viaLine: 0,
    viaMailFallback: 0,
    viaMailOnly: 0,
    viaBoth: 0,
    pending: 0,
    skipped: 0,
    blocked: 0,
    errors: [],
  };

  var rows = shops.map(function (shop) {
    var result;
    try {
      result = deliverMonthlyReportForShop_(shop, targetYm, target, {
        dryRun: true,
        ownerIndex: ownerIndex,
        ownerUserIndex: ownerUserIndex,
        lineLinkIndex: lineLinkIndex,
        folderMappings: folderMappings,
      });
    } catch (e) {
      result = { status: 'error', reason: String(e) };
    }

    var rowStatus = '';
    var predicted = '';
    var note = '';

    if (result.status === 'dry_run') {
      summary.ready += 1;
      predicted = result.predicted || '';
      if (predicted === 'LINE') summary.viaLine += 1;
      else if (predicted === 'メール(フォールバック)') summary.viaMailFallback += 1;
      else if (predicted === 'メール') summary.viaMailOnly += 1;
      else if (predicted === 'LINE+メール') summary.viaBoth += 1;
      rowStatus = '配信可';
      if (!result.supervisingReady) note = 'スーパーバイジング未作成（5日にAI生成）';
    } else if (result.status === 'skipped') {
      summary.skipped += 1;
      rowStatus = '送信済み';
      note = result.reason || '';
    } else if (result.status === 'pending') {
      summary.pending += 1;
      rowStatus = 'PDF未揃い';
      note = result.reason || '';
    } else {
      summary.blocked += 1;
      rowStatus = '不可';
      note = result.reason || '';
      summary.errors.push(shop.kintoneShopName + ': ' + note);
    }

    return [
      shop.kintoneShopName,
      shop.name,
      result.channels || '',
      predicted,
      (result.realLineUserIds || result.lineUserIds || []).length,
      (result.realEmails || result.emails || []).join(', '),
      rowStatus,
      note,
    ];
  });

  writeDeliveryPreFlightSheet_(rows);

  return summary;
}

function writeDeliveryPreFlightSheet_(rows) {
  var sheetName = '配信ドライラン';
  var headers = [
    'kintoneShopName',
    '店舗名',
    '配信方法(設定)',
    '5日の想定',
    'LINE紐づけ数',
    'メール',
    '判定',
    '備考',
  ];
  var ss = getSpreadsheet_();
  var old = ss.getSheetByName(sheetName);
  if (old) ss.deleteSheet(old);
  var sheet = ss.insertSheet(sheetName);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  sheet.autoResizeColumns(1, headers.length);
}

/** スクリプトプロパティ DELIVERY_TEST_LINE_USER_ID（本部テスト用） */
function getDeliveryTestLineUserId_() {
  return PropertiesService.getScriptProperties().getProperty('DELIVERY_TEST_LINE_USER_ID');
}

function showOwnerDeliveryStatus() {
  var msg =
    'オーナー本番配信: ' +
    getOwnerDeliveryStatusLabel_() +
    '\n\n' +
    '無効のとき:\n' +
    '・5日トリガー・手動配信はオーナーに届かない\n' +
    '・LINE・メールともに送信しない\n' +
    '・ドライラン・本部LINEテストは利用可';
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}

function enableOwnerDeliveryLive() {
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert(
    '本番配信を有効化',
    'オーナーへ LINE・メールが実際に送られるようになります。\n' +
      '本部から送付OKの指示が出ている場合のみ有効化してください。\n\n' +
      '有効化しますか？',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;
  setOwnerDeliveryLive_(true);
  ui.alert('本番配信を有効化しました。');
}

function disableOwnerDeliveryLive() {
  setOwnerDeliveryLive_(false);
  clearDeliveryState_();
  clearDeliveryContinuationTriggers_();
  try {
    SpreadsheetApp.getUi().alert(
      '本番配信を停止しました（安全モード）。\nオーナーへの LINE・メール送信は行われません。'
    );
  } catch (e) {
    Logger.log('本番配信を停止（安全モード）');
  }
}

/**
 * 1店舗を本部テスト用 LINE にだけ送る（オーナー・メール・Chat には届かない）
 * スクリプトプロパティ DELIVERY_TEST_LINE_USER_ID を設定しておくと毎回 ID 不要
 */
function testDeliveryForShopToMe(targetYm, kintoneShopName, testLineUserId) {
  var shop = findShopByKintoneName_(kintoneShopName);
  if (!shop) throw new Error('店舗が見つかりません: ' + kintoneShopName);

  var target = buildTargetMeta_(targetYm);
  var ownerIndex = loadOwnerEmailIndex_();
  var ownerUserIndex = loadOwnerUserIdsIndex_();
  var lineLinkIndex = loadLineLinkByUsermIndex_();
  return deliverMonthlyReportForShop_(shop, targetYm, target, {
    dryRun: false,
    testMode: true,
    testLineUserId: testLineUserId || getDeliveryTestLineUserId_(),
    ownerIndex: ownerIndex,
    ownerUserIndex: ownerUserIndex,
    lineLinkIndex: lineLinkIndex,
  });
}

/** 実行ボタン用（岩出店・202606 の例。店舗名・月は書き換え可） */
function testDeliveryIwadeToMe() {
  var lineUserId =
    getDeliveryTestLineUserId_() || 'U4916f26e81f9da31cdf3234c5e30e5c9';
  var result = testDeliveryForShopToMe('202606', '岩出店', lineUserId);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/** 1店舗だけ試す（AI生成あり）※オーナー本番宛先に送る。テストは testDeliveryIwadeToMe を使う */
function testDeliveryForShop(targetYm, kintoneShopName) {
  var shop = findShopByKintoneName_(kintoneShopName);
  if (!shop) throw new Error('店舗が見つかりません: ' + kintoneShopName);

  var target = buildTargetMeta_(targetYm);
  var ownerIndex = loadOwnerEmailIndex_();
  var ownerUserIndex = loadOwnerUserIdsIndex_();
  var lineLinkIndex = loadLineLinkByUsermIndex_();
  return deliverMonthlyReportForShop_(shop, targetYm, target, {
    dryRun: false,
    ownerIndex: ownerIndex,
    ownerUserIndex: ownerUserIndex,
    lineLinkIndex: lineLinkIndex,
  });
}
