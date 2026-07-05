/**
 * Drive コピー・フォルダ作成
 */

function buildStoreFolderCache_(destRoot) {
  var cache = {};
  indexFoldersRecursive_(destRoot, cache, []);
  return cache;
}

function indexFoldersRecursive_(folder, cache, pathParts) {
  var name = folder.getName();
  var nextPath = pathParts.concat([name]);

  if (!cache[name]) cache[name] = [];
  cache[name].push({ folder: folder, path: nextPath.join(' / ') });

  var sub = folder.getFolders();
  while (sub.hasNext()) {
    indexFoldersRecursive_(sub.next(), cache, nextPath);
  }
}

function findStoreFolder_(cache, kintoneShopName) {
  var hits = cache[kintoneShopName] || [];
  if (hits.length === 1) return hits[0].folder;
  if (hits.length > 1) {
    throw new Error(
      '店舗フォルダ「' +
        kintoneShopName +
        '」が複数見つかりました: ' +
        hits.map(function (h) {
          return h.path;
        }).join(', ')
    );
  }
  return null;
}

function getOrCreateChildFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

function findChildFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : null;
}

function getFcReportRootFolderName_() {
  return getConfig_().FC_REPORT_ROOT_NAME || 'FC月次レポート';
}

/** 店舗フォルダ内の FC 専用ルート（オーナー共有対象） */
function getOrCreateFcReportRootFolder_(storeFolder, dryRun) {
  var name = getFcReportRootFolderName_();
  if (dryRun) {
    return findChildFolder_(storeFolder, name) || storeFolder;
  }
  return getOrCreateChildFolder_(storeFolder, name);
}

function findReportPathUnder_(parent, reportType, year, month) {
  if (!parent) return null;
  var typeFolder = findChildFolder_(parent, reportType);
  if (!typeFolder) return null;
  var yearFolder = findChildFolder_(typeFolder, String(year));
  if (!yearFolder) return typeFolder;
  var monthFolder = findChildFolder_(yearFolder, formatMonthFolderName_(month));
  return monthFolder || yearFolder;
}

/** 読み取り用：FC月次レポート配下を優先し、なければ旧配置（店舗直下）も探す */
function findReportDestinationFolder_(storeFolder, reportType, year, month) {
  var fcRoot = findChildFolder_(storeFolder, getFcReportRootFolderName_());
  if (fcRoot) {
    var inFc = findReportPathUnder_(fcRoot, reportType, year, month);
    if (inFc) return inFc;
  }
  return findReportPathUnder_(storeFolder, reportType, year, month);
}

function getReportDestinationFolder_(storeFolder, reportType, year, month, dryRun) {
  var fcRoot = getOrCreateFcReportRootFolder_(storeFolder, dryRun);
  if (dryRun) {
    var typeFolder = findChildFolder_(fcRoot, reportType);
    if (!typeFolder) return fcRoot;
    var yearFolder = findChildFolder_(typeFolder, String(year));
    if (!yearFolder) return typeFolder;
    var monthFolder = findChildFolder_(yearFolder, formatMonthFolderName_(month));
    return monthFolder || yearFolder;
  }
  var typeFolder = getOrCreateChildFolder_(fcRoot, reportType);
  var yearFolder = getOrCreateChildFolder_(typeFolder, String(year));
  return getOrCreateChildFolder_(yearFolder, formatMonthFolderName_(month));
}

function findSourceMonthFolders_(sourceRoot, targetYm) {
  var yearFolderName = targetYm.slice(0, 4);
  var yearFolders = sourceRoot.getFoldersByName(yearFolderName);
  if (!yearFolders.hasNext()) return [];

  var yearFolder = yearFolders.next();
  var prefix = targetYm;
  var result = [];
  var monthFolders = yearFolder.getFolders();

  while (monthFolders.hasNext()) {
    var folder = monthFolders.next();
    var folderName = folder.getName();
    if (folderName.indexOf(prefix) !== 0) continue;
    var reportType = detectReportType_(folderName, '');
    if (!reportType) continue;
    result.push({ folder: folder, reportType: reportType, folderName: folderName });
  }

  return result;
}

function fileAlreadyExists_(destFolder, fileName) {
  var files = destFolder.getFilesByName(fileName);
  return files.hasNext();
}

function copyFileIfNeeded_(file, destFolder, dryRun) {
  var name = file.getName();
  if (dryRun) {
    return { status: 'dry_run', name: name, url: destFolder.getUrl() };
  }
  if (fileAlreadyExists_(destFolder, name)) {
    return { status: 'skipped', name: name, url: destFolder.getUrl() };
  }
  var copied = file.makeCopy(name, destFolder);
  return { status: 'copied', name: name, url: destFolder.getUrl(), fileId: copied.getId() };
}

function grantViewerIfNeeded_(folder, email, dryRun) {
  if (!email || !isValidEmail_(email)) {
    return { status: 'invalid_email', email: email || '' };
  }

  if (dryRun) {
    return { status: 'dry_run', email: email };
  }

  try {
    folder.addViewer(email);
    return { status: 'granted', email: email };
  } catch (e) {
    var msg = String(e);
    if (msg.indexOf('already') !== -1 || msg.indexOf('既に') !== -1) {
      return { status: 'already', email: email };
    }
    if (isDriveNoSuchUserError_(msg)) {
      return { status: 'no_such_user', email: email };
    }
    throw e;
  }
}

function revokeViewerIfNeeded_(folder, email, dryRun) {
  if (!email || !isValidEmail_(email)) {
    return { status: 'invalid_email', email: email || '' };
  }
  if (dryRun) {
    return { status: 'dry_run', email: email };
  }
  try {
    folder.removeViewer(email);
    return { status: 'revoked', email: email };
  } catch (e) {
    var msg = String(e);
    if (isDriveNotViewerError_(msg) || isDriveNoSuchUserError_(msg)) {
      return { status: isDriveNoSuchUserError_(msg) ? 'no_such_user' : 'not_viewer', email: email };
    }
    throw e;
  }
}

/**
 * 店舗直下の 月次レポート / 顧客分析 を FC月次レポート 配下へ移動
 */
/**
 * FCフォルダ移行・共有付け直し用（全Drive走査しない）
 */
function resolveStoreFolderForFcOps_(kintoneShopName, folderMappings) {
  folderMappings = folderMappings || loadFolderMappings_();
  var resolved = resolveStoreFolderFast_(kintoneShopName, folderMappings);
  if (resolved && resolved.folder) return resolved;
  throw new Error(
    '店舗フォルダを特定できません: ' +
      kintoneShopName +
      ' → 店舗フォルダマッピングの「DriveフォルダID」を確認するか、' +
      'メニュー「フォルダIDを一括同期（初回のみ）」を実行してください。'
  );
}

function migrateFcReportFoldersForShop_(kintoneShopName, options) {
  options = options || {};
  var shop = findShopByKintoneName_(kintoneShopName);
  if (!shop) throw new Error('店舗が見つかりません: ' + kintoneShopName);

  var folderMappings = options.folderMappings || loadFolderMappings_();
  var resolved = resolveStoreFolderForFcOps_(kintoneShopName, folderMappings);

  var storeFolder = resolved.folder;
  var fcRoot = getOrCreateFcReportRootFolder_(storeFolder, false);
  var moved = [];
  var skipped = [];

  ['月次レポート', '顧客分析'].forEach(function (name) {
    var legacy = findChildFolder_(storeFolder, name);
    if (!legacy) {
      skipped.push(name + ': 店舗直下に無し');
      return;
    }
    if (findChildFolder_(fcRoot, name)) {
      skipped.push(name + ': FC月次レポート配下に既存のためスキップ');
      return;
    }
    if (!options.dryRun) {
      legacy.moveTo(fcRoot);
    }
    moved.push(name);
  });

  return {
    kintoneShopName: kintoneShopName,
    storeFolderUrl: storeFolder.getUrl(),
    fcReportFolderUrl: fcRoot.getUrl(),
    moved: moved,
    skipped: skipped,
    dryRun: !!options.dryRun,
  };
}

/**
 * 店舗フォルダの共有を外し、FC月次レポート のみオーナーに共有
 */
function regrantFcFolderAccessForShop_(kintoneShopName, options) {
  options = options || {};
  var shop = findShopByKintoneName_(kintoneShopName);
  if (!shop) throw new Error('店舗が見つかりません: ' + kintoneShopName);

  var folderMappings = options.folderMappings || loadFolderMappings_();
  var resolved = resolveStoreFolderForFcOps_(kintoneShopName, folderMappings);

  var ownerIndex = options.ownerIndex || loadOwnerEmailIndex_();
  var emails = resolveOwnerEmailsForShop_(shop, ownerIndex);
  var storeFolder = resolved.folder;
  var fcRoot = getOrCreateFcReportRootFolder_(storeFolder, false);
  var dryRun = !!options.dryRun;
  var revoked = [];
  var granted = [];

  emails.forEach(function (email) {
    var r = revokeViewerIfNeeded_(storeFolder, email, dryRun);
    revoked.push({ email: email, status: r.status });
    var g = grantViewerIfNeeded_(fcRoot, email, dryRun);
    granted.push({ email: email, status: g.status });
  });

  return {
    kintoneShopName: kintoneShopName,
    storeFolderUrl: storeFolder.getUrl(),
    fcReportFolderUrl: fcRoot.getUrl(),
    emails: emails,
    revoked: revoked,
    granted: granted,
    dryRun: dryRun,
  };
}

var FC_MIGRATE_STATE_KEY_ = 'fc_migrate_state_v1';
var FC_REGRANT_STATE_KEY_ = 'fc_regrant_state_v1';
var FC_MIGRATE_BATCH_SIZE_ = 20;
var FC_REGRANT_BATCH_SIZE_ = 15;

function getFcBatchState_(key) {
  var raw = PropertiesService.getScriptProperties().getProperty(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function setFcBatchState_(key, state) {
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(state));
}

function clearFcBatchState_(key) {
  PropertiesService.getScriptProperties().deleteProperty(key);
}

function clearFcBatchContinuationTriggers_(handlerName) {
  try {
    ScriptApp.getProjectTriggers().forEach(function (trigger) {
      if (trigger.getHandlerFunction() === handlerName) {
        ScriptApp.deleteTrigger(trigger);
      }
    });
  } catch (e) {
    Logger.log('clearFcBatchContinuationTriggers_: ' + e);
  }
}

/** @return {boolean} トリガー作成に成功したか */
function scheduleFcBatchContinuation_(handlerName) {
  try {
    clearFcBatchContinuationTriggers_(handlerName);
    ScriptApp.newTrigger(handlerName).timeBased().after(90 * 1000).create();
    return true;
  } catch (e) {
    Logger.log('scheduleFcBatchContinuation_: ' + e);
    return false;
  }
}

function notifyFcBatchPartial_(title, currentOffset, total, errors, continueHint) {
  var msg =
    title +
    '\n途中まで完了: ' +
    currentOffset +
    ' / ' +
    total +
    ' 店舗\n\n' +
    '続き: Apps Script エディタで「' +
    (continueHint || 'continueFcMigrateBatch_') +
    '」を実行\n' +
    'またはメニューから同じ操作を再実行' +
    (errors.length ? '\n\nエラー:\n' + errors.join('\n') : '');
  sendHqAlert_(title + '（途中）', msg);
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}

function processFcMigrateBatch_(offset, options) {
  options = options || {};
  var startedAt = Date.now();
  var maxRunMs = options.maxRunMs || 4 * 60 * 1000;
  var maxShopsPerRun = options.maxShopsPerRun || 15;
  var shops = loadShopMaster_().filter(function (s) {
    return String(s.kintoneShopName || '').trim();
  });
  var folderMappings = loadFolderMappings_();
  var summary = {
    offset: offset,
    total: shops.length,
    processed: 0,
    ok: 0,
    errors: [],
    batchCount: 0,
    lastShop: '',
  };
  var currentOffset = offset;

  while (currentOffset < shops.length) {
    if (summary.batchCount > 0 && Date.now() - startedAt > maxRunMs) {
      break;
    }
    if (summary.batchCount >= maxShopsPerRun) {
      break;
    }

    var shop = shops[currentOffset];
    var label = '[' + (currentOffset + 1) + '/' + shops.length + '] ' + shop.kintoneShopName;
    Logger.log('FC移行 ' + label);
    summary.lastShop = shop.kintoneShopName;
    summary.processed += 1;

    try {
      migrateFcReportFoldersForShop_(shop.kintoneShopName, {
        folderMappings: folderMappings,
      });
      summary.ok += 1;
    } catch (e) {
      summary.errors.push(shop.kintoneShopName + ': ' + String(e));
    }

    currentOffset += 1;
    summary.batchCount += 1;

    setFcBatchState_(FC_MIGRATE_STATE_KEY_, {
      offset: currentOffset,
      lastShop: shop.kintoneShopName,
      startedAt: new Date().toISOString(),
    });
  }

  var hasMore = currentOffset < shops.length;
  summary.nextOffset = currentOffset;
  summary.hasMore = hasMore;

  if (hasMore) {
    notifyFcBatchPartial_(
      'FC月次レポート移行',
      currentOffset,
      shops.length,
      summary.errors.concat(['最後に処理: ' + summary.lastShop]),
      'continueFcMigrateBatch_'
    );
    return summary;
  }

  clearFcBatchState_(FC_MIGRATE_STATE_KEY_);
  var msg =
    'FC月次レポートへ移動完了\n' +
    '成功: ' +
    summary.ok +
    ' / ' +
    shops.length +
    (summary.errors.length ? '\n\nエラー:\n' + summary.errors.join('\n') : '');
  if (options.sendHqSummary !== false) {
    sendHqAlert_('FC月次レポート移行完了', msg);
    try {
      SpreadsheetApp.getUi().alert(msg);
    } catch (e) {
      Logger.log(msg);
    }
  }
  return summary;
}

function processFcRegrantBatch_(offset, options) {
  options = options || {};
  var startedAt = Date.now();
  var maxRunMs = options.maxRunMs || 4 * 60 * 1000;
  var maxShopsPerRun = options.maxShopsPerRun || 10;
  var shops = loadShopMaster_().filter(function (s) {
    return String(s.kintoneShopName || '').trim();
  });
  var folderMappings = loadFolderMappings_();
  var ownerIndex = loadOwnerEmailIndex_();
  var summary = {
    offset: offset,
    total: shops.length,
    processed: 0,
    ok: 0,
    errors: [],
    batchCount: 0,
    lastShop: '',
  };
  var currentOffset = offset;

  while (currentOffset < shops.length) {
    if (summary.batchCount > 0 && Date.now() - startedAt > maxRunMs) {
      break;
    }
    if (summary.batchCount >= maxShopsPerRun) {
      break;
    }

    var shop = shops[currentOffset];
    var label = '[' + (currentOffset + 1) + '/' + shops.length + '] ' + shop.kintoneShopName;
    Logger.log('FC共有付け直し ' + label);
    summary.lastShop = shop.kintoneShopName;
    summary.processed += 1;

    try {
      regrantFcFolderAccessForShop_(shop.kintoneShopName, {
        folderMappings: folderMappings,
        ownerIndex: ownerIndex,
      });
      summary.ok += 1;
    } catch (e) {
      summary.errors.push(shop.kintoneShopName + ': ' + String(e));
    }

    currentOffset += 1;
    summary.batchCount += 1;

    setFcBatchState_(FC_REGRANT_STATE_KEY_, {
      offset: currentOffset,
      lastShop: shop.kintoneShopName,
      startedAt: new Date().toISOString(),
    });
  }

  var hasMore = currentOffset < shops.length;
  summary.nextOffset = currentOffset;
  summary.hasMore = hasMore;

  if (hasMore) {
    notifyFcBatchPartial_(
      'FC月次レポート共有付け直し',
      currentOffset,
      shops.length,
      summary.errors.concat(['最後に処理: ' + summary.lastShop]),
      'continueFcRegrantBatch_'
    );
    return summary;
  }

  clearFcBatchState_(FC_REGRANT_STATE_KEY_);
  var msg =
    'FC月次レポート共有の付け直し完了\n' +
    '処理店舗: ' +
    summary.ok +
    ' / ' +
    shops.length +
    (summary.errors.length ? '\n\nエラー:\n' + summary.errors.join('\n') : '');
  if (options.sendHqSummary !== false) {
    sendHqAlert_('FC月次レポート共有付け直し完了', msg);
    try {
      SpreadsheetApp.getUi().alert(msg);
    } catch (e) {
      Logger.log(msg);
    }
  }
  return summary;
}

function migrateAllFcReportFolders() {
  var existing = getFcBatchState_(FC_MIGRATE_STATE_KEY_);
  if (existing && existing.offset > 0) {
    return processFcMigrateBatch_(existing.offset, { sendHqSummary: true });
  }
  clearFcBatchState_(FC_MIGRATE_STATE_KEY_);
  return processFcMigrateBatch_(0, { sendHqSummary: true });
}

/** 先頭からやり直す（通常は使わない） */
function migrateAllFcReportFoldersFromStart() {
  clearFcBatchState_(FC_MIGRATE_STATE_KEY_);
  return processFcMigrateBatch_(0, { sendHqSummary: true });
}

function showFcMigrateProgress() {
  var state = getFcBatchState_(FC_MIGRATE_STATE_KEY_);
  var total = loadShopMaster_().filter(function (s) {
    return String(s.kintoneShopName || '').trim();
  }).length;
  var msg = state
    ? '移行の途中です\n' +
      '進捗: ' +
      (state.offset || 0) +
      ' / ' +
      total +
      ' 店舗\n' +
      '最後に処理: ' +
      (state.lastShop || '（不明）') +
      '\n\n続きは continueFcMigrateBatch_ を実行'
    : '移行の途中状態なし（未開始または完了）';
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
  return state;
}

function continueFcMigrateBatch_() {
  var state = getFcBatchState_(FC_MIGRATE_STATE_KEY_);
  if (!state) {
    try {
      SpreadsheetApp.getUi().alert('続きの移行処理はありません（すべて完了済みの可能性があります）');
    } catch (e) {
      Logger.log('continueFcMigrateBatch_: no state');
    }
    return;
  }
  return processFcMigrateBatch_(state.offset || 0, { sendHqSummary: true });
}

function regrantAllFcFolderAccess() {
  var existing = getFcBatchState_(FC_REGRANT_STATE_KEY_);
  if (existing && existing.offset > 0) {
    return processFcRegrantBatch_(existing.offset, { sendHqSummary: true });
  }
  clearFcBatchState_(FC_REGRANT_STATE_KEY_);
  return processFcRegrantBatch_(0, { sendHqSummary: true });
}

function continueFcRegrantBatch_() {
  var state = getFcBatchState_(FC_REGRANT_STATE_KEY_);
  if (!state) {
    try {
      SpreadsheetApp.getUi().alert('続きの共有付け直しはありません（すべて完了済みの可能性があります）');
    } catch (e) {
      Logger.log('continueFcRegrantBatch_: no state');
    }
    return;
  }
  return processFcRegrantBatch_(state.offset || 0, { sendHqSummary: true });
}

/** 1店舗テスト（岩出店） */
function migrateFcReportFoldersIwade() {
  var result = migrateFcReportFoldersForShop_('岩出店', {});
  try {
    SpreadsheetApp.getUi().alert(
      '岩出店\n移動: ' +
        (result.moved.join(', ') || 'なし') +
        '\nスキップ: ' +
        (result.skipped.join(', ') || 'なし')
    );
  } catch (e) {
    Logger.log(JSON.stringify(result));
  }
  return result;
}

/** 1店舗テスト（岩出店）— 親フォルダ共有解除 → FC月次レポートのみ共有 */
function regrantFcFolderAccessIwade() {
  var result = regrantFcFolderAccessForShop_('岩出店', {});
  var lines = ['岩出店 共有付け直し完了', '対象メール: ' + (result.emails.join(', ') || 'なし')];
  if (result.revoked.length) {
    lines.push(
      '親フォルダ解除: ' +
        result.revoked
          .map(function (r) {
            return r.email + '(' + r.status + ')';
          })
          .join(', ')
    );
  }
  if (result.granted.length) {
    lines.push(
      'FC月次レポート付与: ' +
        result.granted
          .map(function (g) {
            return g.email + '(' + g.status + ')';
          })
          .join(', ')
    );
  }
  var failed = result.granted.filter(function (g) {
    return g.status === 'no_such_user';
  });
  if (failed.length) {
    lines.push(
      '※ Googleアカウント未登録のメールです。userm.mail を確認してください: ' +
        failed.map(function (g) {
          return g.email;
        }).join(', ')
    );
  }
  var msg = lines.join('\n');
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
  return result;
}

/**
 * 指定月のレポートをコピー
 * @param {string} targetYm YYYYMM
 * @param {{dryRun?:boolean, sendHqSummary?:boolean}} options
 */
function processMonthlyCopyForYm_(targetYm, options) {
  options = options || {};
  var dryRun = !!options.dryRun;
  var skipLog = !!options.skipLog;
  var cfg = getConfig_();
  var target = {
    yyyyMM: targetYm,
    year: Number(targetYm.slice(0, 4)),
    month: Number(targetYm.slice(4, 6)),
    label: targetYm.slice(0, 4) + '年' + Number(targetYm.slice(4, 6)) + '月',
  };

  if (!skipLog) beginLogBatch_();
  setLogSkip_(skipLog);

  try {
    return processMonthlyCopyForYmCore_(targetYm, target, options);
  } finally {
    if (!skipLog) flushLogBatch_();
    setLogSkip_(false);
  }
}

function processMonthlyCopyForYmCore_(targetYm, target, options) {
  options = options || {};
  var dryRun = !!options.dryRun;
  var cfg = getConfig_();

  if (!options.skipLog) {
    ensureMappingSheet_();
    ensureFolderMappingSheet_();
  }
  var shops = loadShopMaster_();
  var folderMappings = loadFolderMappings_();
  var sourceRoot = getDriveFolder_(cfg.SOURCE_ROOT_FOLDER_ID, 'コピー元（月次レポート置場）');
  var caches = buildDriveCaches_({
    fcStoreCache: options.fcStoreCache,
    directStoreCache: options.directStoreCache,
  });
  var storeCache = caches.fcCache;
  var directCache = caches.directCache;
  var sourceFolders = findSourceMonthFolders_(sourceRoot, targetYm);

  var summary = {
    targetYm: targetYm,
    sourceFolders: sourceFolders.length,
    copied: 0,
    skipped: 0,
    errors: [],
    unmatched: [],
    storesTouched: {},
  };

  if (!sourceFolders.length) {
    summary.errors.push('ソースに ' + targetYm + ' のフォルダが見つかりません。');
    if (options.sendHqSummary !== false) {
      sendHqAlert_(
        target.label + ' コピー: ソース未検出',
        summary.errors.join('\n')
      );
    }
    return summary;
  }

  sourceFolders.forEach(function (src) {
    var files = src.folder.getFiles();
    while (files.hasNext()) {
      var file = files.next();
      var fileName = file.getName();
      var mime = file.getMimeType();

      if (isExcludedFile_(fileName)) continue;

      var isPdf = mime === MimeType.PDF || /\.pdf$/i.test(fileName);
      var isExcel =
        mime === MimeType.MICROSOFT_EXCEL ||
        mime ===
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        /\.xlsx?$/i.test(fileName);

      if (!isPdf && !isExcel) continue;
      if (src.reportType === '顧客分析' && !isPdf) continue;

      var match = matchShopByFileName_(fileName, shops, targetYm);
      if (!match) {
        summary.unmatched.push(fileName);
        appendLogRow_([
          new Date(),
          targetYm,
          '',
          '',
          src.reportType,
          fileName,
          '',
          '未マッチ',
          '',
          '',
          '店舗を特定できませんでした',
        ]);
        continue;
      }

      var shop = match.shop;
      var storeFolder;
      var resolved;
      try {
        resolved = resolveStoreFolder_(
          shop.kintoneShopName,
          storeCache,
          directCache,
          folderMappings
        );
        storeFolder = resolved ? resolved.folder : null;
      } catch (e) {
        summary.errors.push(String(e));
        appendLogRow_([
          new Date(),
          targetYm,
          shop.name,
          shop.kintoneShopName,
          src.reportType,
          fileName,
          '',
          'エラー',
          '',
          '',
          String(e),
        ]);
        continue;
      }

      if (!storeFolder) {
        var mapping = getFolderMappingForShop_(shop.kintoneShopName, folderMappings);
        var missingMsg =
          'Driveに店舗フォルダがありません: ' +
          shop.kintoneShopName +
          ' → 「' +
          mapping.driveFolderName +
          '」(' +
          mapping.storeType +
          ')';
        summary.errors.push(missingMsg + ' (' + fileName + ')');
        appendLogRow_([
          new Date(),
          targetYm,
          shop.name,
          shop.kintoneShopName,
          src.reportType,
          fileName,
          '',
          'エラー',
          '',
          '',
          missingMsg,
        ]);
        continue;
      }

      var destFolder = getReportDestinationFolder_(
        storeFolder,
        src.reportType,
        target.year,
        target.month,
        dryRun
      );

      var copyResult;
      try {
        copyResult = copyFileIfNeeded_(file, destFolder, dryRun);
      } catch (e) {
        summary.errors.push(fileName + ': ' + e);
        appendLogRow_([
          new Date(),
          targetYm,
          shop.name,
          shop.kintoneShopName,
          src.reportType,
          fileName,
          destFolder.getUrl(),
          'エラー',
          '',
          '',
          String(e),
        ]);
        continue;
      }

      if (copyResult.status === 'copied') summary.copied += 1;
      if (copyResult.status === 'skipped') summary.skipped += 1;

      var fcRoot = getOrCreateFcReportRootFolder_(storeFolder, dryRun);
      summary.storesTouched[shop.kintoneShopName] = {
        shop: shop,
        storeFolder: storeFolder,
        fcReportFolder: fcRoot,
      };

      appendLogRow_([
        new Date(),
        targetYm,
        shop.name,
        shop.kintoneShopName,
        src.reportType,
        fileName,
        destFolder.getUrl(),
        copyResult.status,
        '',
        '',
        '',
      ]);
    }
  });

  Object.keys(summary.storesTouched).forEach(function (key) {
    var entry = summary.storesTouched[key];
    if (dryRun) return;
    var permResult;
    try {
      permResult = grantViewerIfNeeded_(
        entry.fcReportFolder || getOrCreateFcReportRootFolder_(entry.storeFolder, dryRun),
        entry.shop.mail,
        dryRun
      );
    } catch (e) {
      permResult = { status: 'error', error: String(e) };
      summary.errors.push(key + ' 権限付与: ' + String(e));
    }
    appendLogRow_([
      new Date(),
      targetYm,
      entry.shop.name,
      entry.shop.kintoneShopName,
      '権限付与',
      '',
      (entry.fcReportFolder || entry.storeFolder).getUrl(),
      '',
      permResult.status,
      '',
      permResult.error || '',
    ]);
  });

  if (options.sendHqSummary !== false && !dryRun) {
    var body = [
      '対象: ' + target.label,
      'ソース月フォルダ数: ' + summary.sourceFolders,
      'コピー: ' + summary.copied,
      'スキップ（既存）: ' + summary.skipped,
      '店舗数: ' + Object.keys(summary.storesTouched).length,
      '',
      summary.unmatched.length
        ? '【未マッチファイル】\n' + summary.unmatched.join('\n')
        : '未マッチ: なし',
      '',
      summary.errors.length
        ? '【エラー】\n' + summary.errors.join('\n')
        : 'エラー: なし',
    ].join('\n');
    sendHqAlert_(target.label + ' コピー完了', body);
  }

  return summary;
}
