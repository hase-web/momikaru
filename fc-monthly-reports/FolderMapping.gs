/**
 * kintoneShopName → Driveフォルダ名 / FC・直営 のマッピング
 */

function ensureFolderMappingSheet_() {
  var cfg = getConfig_();
  var headers = [
    'kintoneShopName',
    'Driveフォルダ名',
    '種別(FC/直営)',
    'DriveフォルダID(任意)',
    'メモ',
    '配信方法',
  ];
  var sheet = getOrCreateSheet_(getSpreadsheet_(), cfg.FOLDER_MAPPING_SHEET_NAME, headers);
  ensureDeliveryChannelColumn_(sheet);
  if (sheet.getLastRow() > 1) return sheet;

  var defaults = [
    ['八木山動物公園駅前店', '八木山', 'FC', '1OzeDyiTRmBXu4BUnhGUENFCggoy5WuJ-', '宮城県'],
    ['中吉田店', '静岡中吉田店', 'FC', '', '静岡県'],
    ['鎌ヶ谷ユニオン通り店', '鎌ヶ谷ユニオン通り店', 'FC', '1Fm9lvtHkkO05NNZb93o1DZw152bIak5q', ''],
    ['焼津三ケ名', '焼津三ヶ名', 'FC', '17M6OwlEmC2cWjkqToSbmmb0OU7OqRwzy', ''],
    ['浜北小松本店', '浜北小松店', 'FC', '', ''],
    ['金沢伏見台店', '金沢伏見店', '直営', '1dj_HzgTkXy0M6ciTVgmwSpSr7SrrLuCk', ''],
    ['高岡戸出店', '高岡戸出店', '直営', '', ''],
    ['田中町店', '田中町店', '直営', '', ''],
    ['山室店', '山室店', '直営', '', ''],
    ['富山本店', '富山本店', '直営', '', ''],
    ['小黒店', '小黒店', '直営', '', ''],
    ['可児広見店', '可児広見店', '直営', '', ''],
    ['愛知高浜店', '愛知高浜店', '直営', '', ''],
    ['岐阜長良店', '岐阜長良店', '直営', '', ''],
    ['藤枝駅南店', '藤枝駅南店', '直営', '', ''],
    ['下川原店', '下川原店', '直営', '', ''],
    ['島田花みずき通り店', '島田はなみずき通り店', '直営', '1wO_meRMxIp_fAOMay5uIKcw6w_UFf82y', ''],
    ['総本店', '総本店', '直営', '', ''],
    ['静岡本店', '静岡本店', '直営', '', ''],
  ];

  sheet.getRange(2, 1, defaults.length, headers.length).setValues(defaults);
  return sheet;
}

/** F列「配信方法」を既存シートに追加（古いシートはE列までしかない） */
function ensureDeliveryChannelColumn_(sheet) {
  if (!sheet) return;

  var header = String(sheet.getRange(1, 6).getValue() || '').trim();
  if (header !== '配信方法') {
    sheet.getRange(1, 6).setValue('配信方法');
  }

  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var numRows = lastRow - 1;
    var values = sheet.getRange(2, 6, numRows, 1).getValues();
    var changed = false;
    for (var i = 0; i < values.length; i++) {
      if (!String(values[i][0] || '').trim()) {
        values[i][0] = 'LINE';
        changed = true;
      }
    }
    if (changed) {
      sheet.getRange(2, 6, numRows, 1).setValues(values);
    }
  }

  applyDeliveryChannelValidation_(sheet);
}

/** F列「配信方法」にプルダウンを設定 */
function applyDeliveryChannelValidation_(sheet) {
  var col = 6;
  var options = ['', 'LINE', 'LINE+メール', 'メール', 'LINEのみ', '両方'];
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(options, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, col, Math.max(sheet.getMaxRows(), 500), 1).setDataValidation(rule);
  if (sheet.getLastRow() >= 1) {
    sheet.getRange(1, col).setNote(
      'LINE（空欄も同じ）= 基本。LINE送信\n' +
        'LINE+メール = LINEに加えてメールも送る\n' +
        'メール = メールのみ\n' +
        'LINEのみ = LINE必須（未紐づけはエラー）\n' +
        '※「両方」は LINE+メール と同じ'
    );
  }
}

/**
 * 店舗マスタの全店舗を「店舗フォルダマッピング」に行追加（F列で配信方法を選べるようにする）
 */
function syncDeliveryChannelRows() {
  setupDeliveryChannelColumnNow();
}

function loadFolderMappings_() {
  ensureFolderMappingSheet_();
  var cfg = getConfig_();
  var sheet = getSpreadsheet_().getSheetByName(cfg.FOLDER_MAPPING_SHEET_NAME);
  var values = sheet.getDataRange().getValues();
  var map = {};

  for (var i = 1; i < values.length; i++) {
    var kintoneShopName = String(values[i][0] || '').trim();
    if (!kintoneShopName) continue;

    var driveFolderName = String(values[i][1] || '').trim();
    map[kintoneShopName] = {
      driveFolderName: driveFolderName || kintoneShopName,
      storeType: String(values[i][2] || 'FC').trim() || 'FC',
      driveFolderId: String(values[i][3] || '').trim(),
      memo: String(values[i][4] || '').trim(),
      deliveryChannel: String(values[i][5] || '').trim(),
    };
  }

  return map;
}

function getFolderMappingForShop_(kintoneShopName, folderMappings) {
  if (folderMappings[kintoneShopName]) {
    return folderMappings[kintoneShopName];
  }
  return {
    driveFolderName: kintoneShopName,
    storeType: 'FC',
    driveFolderId: '',
    memo: '',
    deliveryChannel: '',
  };
}

/**
 * @return {{folder:GoogleAppsScript.Drive.Folder, storeType:string, driveFolderName:string}|null}
 */
function resolveStoreFolder_(kintoneShopName, fcCache, directCache, folderMappings) {
  var mapping = getFolderMappingForShop_(kintoneShopName, folderMappings);
  var isDirect = mapping.storeType === '直営';

  if (mapping.driveFolderId) {
    try {
      return {
        folder: DriveApp.getFolderById(mapping.driveFolderId),
        storeType: mapping.storeType,
        driveFolderName: mapping.driveFolderName,
      };
    } catch (e) {
      throw new Error(
        'フォルダIDが無効です: ' +
          kintoneShopName +
          ' → ' +
          mapping.driveFolderId +
          ' (' +
          e +
          ')'
      );
    }
  }

  if (isDirect) {
    if (!directCache) {
      throw new Error('直営店フォルダ（DIRECT_ROOT_FOLDER_ID）が未設定です: ' + kintoneShopName);
    }
    var directFolder = findStoreFolder_(directCache, mapping.driveFolderName);
    if (!directFolder) return null;
    return {
      folder: directFolder,
      storeType: '直営',
      driveFolderName: mapping.driveFolderName,
    };
  }

  var fcFolder = findStoreFolder_(fcCache, mapping.driveFolderName);
  if (!fcFolder) return null;
  return {
    folder: fcFolder,
    storeType: 'FC',
    driveFolderName: mapping.driveFolderName,
  };
}

function buildDriveCaches_(options) {
  var cfg = getConfig_();
  options = options || {};

  var fcRoot = getDriveFolder_(cfg.DEST_ROOT_FOLDER_ID, 'コピー先（B_FC加盟店）');
  var fcCache = options.fcStoreCache || buildStoreFolderCache_(fcRoot);
  var directCache = options.directStoreCache || null;

  if (cfg.DIRECT_ROOT_FOLDER_ID) {
    if (!directCache) {
      var directRoot = getDriveFolder_(cfg.DIRECT_ROOT_FOLDER_ID, 'コピー先（直営店）');
      directCache = buildStoreFolderCache_(directRoot);
    }
  }

  return { fcCache: fcCache, directCache: directCache };
}

/** 既存の「店舗フォルダマッピング」シートにフォルダIDを反映 */
function patchFolderMappingIds() {
  ensureFolderMappingSheet_();
  var cfg = getConfig_();
  var sheet = getSpreadsheet_().getSheetByName(cfg.FOLDER_MAPPING_SHEET_NAME);
  var patches = {
    八木山動物公園駅前店: {
      driveFolderName: '八木山',
      driveFolderId: '1OzeDyiTRmBXu4BUnhGUENFCggoy5WuJ-',
    },
    鎌ヶ谷ユニオン通り店: {
      driveFolderName: '鎌ヶ谷ユニオン通り店',
      driveFolderId: '1Fm9lvtHkkO05NNZb93o1DZw152bIak5q',
    },
    金沢伏見台店: {
      driveFolderName: '金沢伏見店',
      driveFolderId: '1dj_HzgTkXy0M6ciTVgmwSpSr7SrrLuCk',
    },
    島田花みずき通り店: {
      driveFolderName: '島田はなみずき通り店',
      driveFolderId: '1wO_meRMxIp_fAOMay5uIKcw6w_UFf82y',
    },
    秋田中央店: {
      driveFolderName: '秋田中央店',
      driveFolderId: '1G-HsMdlik9MPTKFrMj0Vme4j24T7-NL7',
      storeType: 'FC',
    },
  };

  var values = sheet.getDataRange().getValues();
  var updated = 0;

  for (var key in patches) {
    var patch = patches[key];
    var rowIndex = -1;
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0] || '').trim() === key) {
        rowIndex = i + 1;
        break;
      }
    }
    if (rowIndex < 0) {
      sheet.appendRow([
        key,
        patch.driveFolderName || key,
        patch.storeType || 'FC',
        patch.driveFolderId || '',
        '自動追加',
      ]);
      updated += 1;
      continue;
    }
    if (patch.driveFolderName) sheet.getRange(rowIndex, 2).setValue(patch.driveFolderName);
    if (patch.storeType) sheet.getRange(rowIndex, 3).setValue(patch.storeType);
    if (patch.driveFolderId) sheet.getRange(rowIndex, 4).setValue(patch.driveFolderId);
    updated += 1;
  }

  var msg = 'フォルダIDを ' + updated + ' 件反映しました。';
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}

/**
 * 全店舗のフォルダIDを一括反映（初回のみ推奨）
 *
 * - B_FC加盟店 / 直営店 ルート配下を一度だけ全走査して index を作る
 * - 「店舗フォルダマッピング」シートの DriveフォルダID(任意) を可能な限り埋める
 *
 * 注意: ルート配下が巨大だと数分かかることがあります（最初の1回だけ）。
 */
function syncAllStoreFolderIds() {
  ensureFolderMappingSheet_();
  var cfg = getConfig_();
  var sheet = getSpreadsheet_().getSheetByName(cfg.FOLDER_MAPPING_SHEET_NAME);

  var shops = loadShopMaster_();
  var mappings = loadFolderMappings_();

  // 1回の全走査でキャッシュを作り、全店舗に使い回す（これを毎回やると重い）
  var caches = buildDriveCaches_({});

  var updated = 0;
  var notFound = 0;
  var multiHit = 0;

  // 既存シート値を読み、行番号を引く
  var values = sheet.getDataRange().getValues();
  var rowByShop = {};
  for (var i = 1; i < values.length; i++) {
    var key = String(values[i][0] || '').trim();
    if (key) rowByShop[key] = i + 1;
  }

  shops.forEach(function (shop) {
    var key = shop.kintoneShopName;
    var mapping = getFolderMappingForShop_(key, mappings);

    // 既にIDが入っているならスキップ
    if (mapping.driveFolderId) return;

    var cache = mapping.storeType === '直営' ? caches.directCache : caches.fcCache;
    if (!cache) return;

    // findStoreFolder_ は複数ヒット時に例外を投げるので、それはカウントしてスキップ
    var folder = null;
    try {
      folder = findStoreFolder_(cache, mapping.driveFolderName);
    } catch (e) {
      multiHit += 1;
      return;
    }
    if (!folder) {
      notFound += 1;
      return;
    }

    var rowIndex = rowByShop[key];
    if (!rowIndex) {
      sheet.appendRow([key, mapping.driveFolderName || key, mapping.storeType || 'FC', folder.getId(), '自動同期']);
      updated += 1;
      return;
    }
    sheet.getRange(rowIndex, 4).setValue(folder.getId());
    updated += 1;
  });

  var msg =
    'フォルダID一括同期 完了\n' +
    '更新: ' +
    updated +
    '\n見つからず: ' +
    notFound +
    '\n同名複数: ' +
    multiHit +
    '\n\n※同名複数/見つからずの店舗は、手動でDriveフォルダIDを入力してください。';
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e2) {
    Logger.log(msg);
  }
}
