/**
 * オーナーメール — userm + userxshop（userStop=0）を優先、なければ shopm.mail
 */

function findSheetWithHeaders_(spreadsheet, nameCandidates, requiredHeaders) {
  var i;
  var j;
  var sheet;
  var header;
  var ok;

  for (i = 0; i < nameCandidates.length; i++) {
    sheet = spreadsheet.getSheetByName(nameCandidates[i]);
    if (!sheet) continue;
    if (sheetHasHeaders_(sheet, requiredHeaders)) return sheet;
  }

  var sheets = spreadsheet.getSheets();
  for (j = 0; j < sheets.length; j++) {
    if (sheetHasHeaders_(sheets[j], requiredHeaders)) return sheets[j];
  }
  return null;
}

function sheetHasHeaders_(sheet, requiredHeaders) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return false;

  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h).trim();
  });

  for (var i = 0; i < requiredHeaders.length; i++) {
    if (header.indexOf(requiredHeaders[i]) < 0) return false;
  }
  return true;
}

function headerIndex_(header, names) {
  for (var i = 0; i < names.length; i++) {
    var idx = header.indexOf(names[i]);
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * kintoneShopName → オーナーメール配列
 * @return {Object.<string, string[]>}
 */
function buildShopKeysByShopId_() {
  var map = {};
  try {
    loadShopMaster_().forEach(function (shop) {
      if (!shop.shopId) return;
      map[shop.shopId] = {
        kintoneShopName: shop.kintoneShopName,
        momiShopCd: shop.momiShopCd || '',
      };
    });
  } catch (e) {
    Logger.log('buildShopKeysByShopId_: ' + e);
  }
  return map;
}

function getUsermSheet_(spreadsheet) {
  var cfg = getConfig_();
  spreadsheet = spreadsheet || getSpreadsheet_();
  var names = [cfg.USERM_SHEET_NAME, 'userm', 'userM'];
  for (var i = 0; i < names.length; i++) {
    var sheet = spreadsheet.getSheetByName(names[i]);
    if (sheet && sheetHasHeaders_(sheet, ['mail', 'adminLevel', 'userStop'])) {
      return sheet;
    }
  }
  return null;
}

function getUserxshopSheet_(spreadsheet) {
  var cfg = getConfig_();
  spreadsheet = spreadsheet || getSpreadsheet_();
  var names = [cfg.USERXSHOP_SHEET_NAME, 'userxshop', 'userXshop'];
  for (var i = 0; i < names.length; i++) {
    var sheet = spreadsheet.getSheetByName(names[i]);
    if (sheet && sheetHasHeaders_(sheet, ['userId', 'shopId'])) {
      return sheet;
    }
  }
  return null;
}

function findUserxshopSheet_(spreadsheet) {
  return getUserxshopSheet_(spreadsheet);
}

/**
 * userm を id で引ける形に読み込む
 * @return {Object.<string, {mail:string, userStop:string, adminLevel:string, active:boolean, fcOwner:boolean}>}
 */
function loadUsermById_() {
  var index = {};
  var userSheet = getUsermSheet_(getSpreadsheet_());
  if (!userSheet) return index;

  var values = userSheet.getDataRange().getValues();
  if (values.length < 2) return index;

  var header = values[0].map(function (h) {
    return String(h).trim();
  });
  var col = {
    userId: headerIndex_(header, ['userId', 'user_id', 'id', 'usermId']),
    mail: headerIndex_(header, ['mail', 'Mail', 'メール']),
    userStop: headerIndex_(header, ['userStop', 'user_stop']),
    adminLevel: headerIndex_(header, ['adminLevel', 'admin_level']),
  };
  if (col.userId < 0 || col.mail < 0) return index;

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var uid = normUserId_(row[col.userId]);
    if (!uid) continue;

    var userStop = col.userStop >= 0 ? normUserStop_(row[col.userStop]) : '0';
    var adminLevel = col.adminLevel >= 0 ? normAdminLevel_(row[col.adminLevel]) : '';
    var mail = normalizeEmail_(row[col.mail]);
    var active = userStop === '0';
    var fcOwner = col.adminLevel < 0 ? active : active && isFcOwnerAdminLevel_(adminLevel);

    index[uid] = {
      mail: mail,
      userStop: userStop,
      adminLevel: adminLevel,
      active: active,
      fcOwner: fcOwner,
    };
  }

  return index;
}

function loadOwnerEmailIndex_() {
  var ss = getSpreadsheet_();
  var index = {};
  var shopById = buildShopKeysByShopId_();
  var usermById = loadUsermById_();

  var linkSheet = getUserxshopSheet_(ss);
  if (!linkSheet || !Object.keys(usermById).length) {
    return index;
  }

  var linkValues = linkSheet.getDataRange().getValues();
  if (linkValues.length < 2) return index;

  var linkHeader = linkValues[0].map(function (h) {
    return String(h).trim();
  });
  var linkCol = {
    userId: headerIndex_(linkHeader, ['userId', 'user_id', 'id', 'usermId']),
    shopId: headerIndex_(linkHeader, ['shopId', 'shop_id']),
    kintoneShopName: headerIndex_(linkHeader, [
      'kintoneShopName',
      'shopName',
      '店舗名',
    ]),
    momiShopCd: headerIndex_(linkHeader, ['momiShopCd', 'shopCd']),
  };
  if (linkCol.userId < 0 || linkCol.shopId < 0) return index;

  function addEmailToKeys(shopKeys, mail) {
    shopKeys.forEach(function (key) {
      if (!key || !mail) return;
      if (!index[key]) index[key] = [];
      if (index[key].indexOf(mail) < 0) index[key].push(mail);
    });
  }

  for (var i = 1; i < linkValues.length; i++) {
    var row = linkValues[i];
    var linkUserId = normUserId_(row[linkCol.userId]);
    var user = usermById[linkUserId];
    if (!user || !user.fcOwner || !isValidEmail_(user.mail)) continue;

    var shopKeys = [];
    if (linkCol.kintoneShopName >= 0) {
      var kn = String(row[linkCol.kintoneShopName] || '').trim();
      if (kn) shopKeys.push(kn);
    }
    if (linkCol.momiShopCd >= 0) {
      var cd = String(row[linkCol.momiShopCd] || '').trim();
      if (cd) shopKeys.push('cd:' + cd);
    }
    var sid = normUserId_(row[linkCol.shopId]);
    if (sid) {
      shopKeys.push('sid:' + sid);
      var shopInfo = shopById[sid];
      if (shopInfo) {
        if (shopInfo.kintoneShopName) shopKeys.push(shopInfo.kintoneShopName);
        if (shopInfo.momiShopCd) shopKeys.push('cd:' + shopInfo.momiShopCd);
      }
    }

    addEmailToKeys(shopKeys, user.mail);
  }

  return index;
}

/**
 * @param {Object} shop loadShopMaster_ の1件
 * @param {Object.<string, string[]>} ownerIndex loadOwnerEmailIndex_()
 * @return {string[]}
 */
function resolveOwnerEmailsForShop_(shop, ownerIndex) {
  ownerIndex = ownerIndex || {};
  var emails = [];

  var byName = ownerIndex[shop.kintoneShopName];
  if (byName && byName.length) {
    emails = byName.slice();
  }

  if (shop.momiShopCd) {
    var byCd = ownerIndex['cd:' + shop.momiShopCd];
    if (byCd) {
      byCd.forEach(function (m) {
        if (emails.indexOf(m) < 0) emails.push(m);
      });
    }
  }

  if (shop.shopId) {
    var bySid = ownerIndex['sid:' + shop.shopId];
    if (bySid) {
      bySid.forEach(function (m) {
        if (emails.indexOf(m) < 0) emails.push(m);
      });
    }
  }

  if (!emails.length) {
    emails = resolveOwnerEmailsViaJoin_(shop);
  }

  if (!emails.length && isValidEmail_(shop.mail)) {
    emails.push(shop.mail);
  }

  return emails;
}

/**
 * userxshop.shopId → userm（FCオーナー）を直接 JOIN
 * @return {string[]}
 */
function resolveOwnerEmailsViaJoin_(shop) {
  var emails = [];
  if (!shop || !shop.shopId) return emails;

  var usermById = loadUsermById_();
  var linkSheet = getUserxshopSheet_(getSpreadsheet_());
  if (!linkSheet || !Object.keys(usermById).length) return emails;

  var values = linkSheet.getDataRange().getValues();
  if (values.length < 2) return emails;

  var header = values[0].map(function (h) {
    return String(h).trim();
  });
  var userCol = headerIndex_(header, ['userId', 'user_id', 'id', 'usermId']);
  var shopCol = headerIndex_(header, ['shopId', 'shop_id']);
  if (userCol < 0 || shopCol < 0) return emails;

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (normUserId_(row[shopCol]) !== shop.shopId) continue;

    var user = usermById[normUserId_(row[userCol])];
    if (!user || !user.fcOwner || !isValidEmail_(user.mail)) continue;
    if (emails.indexOf(user.mail) < 0) emails.push(user.mail);
  }

  return emails;
}

/** 岩出店のオーナーメール解決結果を確認（共有付け直し前の診断用） */
function previewOwnerEmailsIwade() {
  var shop = findShopByKintoneName_('岩出店');
  if (!shop) throw new Error('店舗が見つかりません: 岩出店');

  var ss = getSpreadsheet_();
  var usermSheet = getUsermSheet_(ss);
  var linkSheet = getUserxshopSheet_(ss);
  var usermById = loadUsermById_();
  var fcOwners = resolveOwnerEmailsViaJoin_(shop);
  var emails = resolveOwnerEmailsForShop_(shop, loadOwnerEmailIndex_());

  var lines = [
    '岩出店 オーナーメール解決',
    'shopId: ' + (shop.shopId || 'なし'),
    'usermタブ: ' + (usermSheet ? usermSheet.getName() : '未検出'),
    'userxshopタブ: ' + (linkSheet ? linkSheet.getName() : '未検出'),
    'userm読込: ' + Object.keys(usermById).length + '件',
    'FCオーナー(adminLevel=21): ' + (fcOwners.join(', ') || 'なし'),
    'shop.mail（フォールバック）: ' + (shop.mail || 'なし'),
    '解決結果: ' + (emails.join(', ') || 'なし'),
  ];
  var msg = lines.join('\n');
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
  return { shop: shop, fcOwners: fcOwners, emails: emails };
}

function getLineLinkSpreadsheet_() {
  var cfg = getConfig_();
  var props = PropertiesService.getScriptProperties();
  var id =
    props.getProperty('MAPPING_SHEET_ID') ||
    cfg.LINE_LINK_SPREADSHEET_ID ||
    cfg.SPREADSHEET_ID;
  return SpreadsheetApp.openById(id);
}

function isLineLinkActive_(status) {
  var s = String(status || '').trim();
  if (!s) return true;
  if (s === '登録済' || s === '有効' || s === 'active' || s === '0') return true;
  if (s === '無効' || s === '停止' || s === 'inactive') return false;
  return true;
}

/**
 * userm_id → lineUserId[]
 * @return {Object.<string, string[]>}
 */
function loadLineLinkByUsermIndex_() {
  var cfg = getConfig_();
  var index = {};

  var ss = getLineLinkSpreadsheet_();
  var sheet = ss.getSheetByName(cfg.LINE_LINK_SHEET_NAME);
  if (!sheet) sheet = ss.getSheetByName('line_link');
  if (!sheet) return index;

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return index;

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var lineUserId = String(row[0] || '').trim();
    var usermId = normUserId_(row[1]);
    var status = row.length > 3 ? row[3] : '';
    if (!lineUserId || !usermId) continue;
    if (!isLineLinkActive_(status)) continue;

    if (!index[usermId]) index[usermId] = [];
    if (index[usermId].indexOf(lineUserId) < 0) index[usermId].push(lineUserId);
  }

  return index;
}

/**
 * 店舗 → オーナー userm_id[]（userxshop）
 * @return {Object.<string, string[]>}
 */
function loadOwnerUserIdsIndex_() {
  var ss = getSpreadsheet_();
  var index = {};
  var shopById = buildShopKeysByShopId_();
  var usermById = loadUsermById_();

  var linkSheet = getUserxshopSheet_(ss);
  if (!linkSheet) return index;

  var values = linkSheet.getDataRange().getValues();
  if (values.length < 2) return index;

  var header = values[0].map(function (h) {
    return String(h).trim();
  });
  var col = {
    userId: headerIndex_(header, ['userId', 'user_id', 'id', 'usermId']),
    shopId: headerIndex_(header, ['shopId', 'shop_id']),
    kintoneShopName: headerIndex_(header, ['kintoneShopName', 'shopName', '店舗名']),
  };
  if (col.userId < 0 || col.shopId < 0) return index;

  function addKey(key, userId) {
    if (!key || !userId) return;
    if (!index[key]) index[key] = [];
    if (index[key].indexOf(userId) < 0) index[key].push(userId);
  }

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var userId = normUserId_(row[col.userId]);
    if (!userId || !usermById[userId] || !usermById[userId].fcOwner) continue;

    if (col.kintoneShopName >= 0) {
      addKey(String(row[col.kintoneShopName] || '').trim(), userId);
    }
    var sid = normUserId_(row[col.shopId]);
    if (sid) {
      addKey('sid:' + sid, userId);
      var shopInfo = shopById[sid];
      if (shopInfo && shopInfo.kintoneShopName) {
        addKey(shopInfo.kintoneShopName, userId);
      }
    }
  }

  return index;
}

/**
 * @return {string[]}
 */
function resolveLineUserIdsForShop_(shop, ownerUserIndex, lineLinkIndex) {
  ownerUserIndex = ownerUserIndex || {};
  lineLinkIndex = lineLinkIndex || {};
  var userIds = [];

  var byName = ownerUserIndex[shop.kintoneShopName];
  if (byName) userIds = byName.slice();

  if (shop.shopId) {
    var byShop = ownerUserIndex['sid:' + shop.shopId] || [];
    byShop.forEach(function (uid) {
      if (userIds.indexOf(uid) < 0) userIds.push(uid);
    });
  }

  var lineIds = [];
  userIds.forEach(function (uid) {
    var linked = lineLinkIndex[uid] || [];
    linked.forEach(function (lineId) {
      if (lineIds.indexOf(lineId) < 0) lineIds.push(lineId);
    });
  });

  return lineIds;
}

/**
 * 店舗フォルダマッピング F列「配信方法」
 * - LINE（空欄も同じ）: 基本。LINE送信。未紐づけ時のみメールへフォールバック
 * - LINE+メール（両方）: LINE必須＋メールも送る（メール希望の店舗向け）
 * - メール: メールのみ（LINEは送らない）
 * - LINEのみ: LINEのみ（未紐づけはエラー・フォールバックなし）
 */
function normalizeDeliveryChannel_(raw) {
  var s = String(raw || '').trim();
  if (!s) return 'LINE';
  if (s === '両方' || s === 'LINE+メール' || s === 'LINE＋メール') return 'LINE+メール';
  return s;
}

/**
 * @return {{raw:string, normalized:string, useLine:boolean, useMail:boolean, fallbackToMail:boolean, useChatPost:boolean}}
 */
function resolveDeliveryChannels_(shop, folderMappings) {
  var cfg = getConfig_();
  var mapping = getFolderMappingForShop_(shop.kintoneShopName, folderMappings || {});
  var raw = String(mapping.deliveryChannel || cfg.DEFAULT_DELIVERY_CHANNEL || 'LINE').trim();
  var normalized = normalizeDeliveryChannel_(raw || 'LINE');

  var useMail = normalized === 'メール' || normalized === 'LINE+メール';
  var useLine =
    normalized === 'LINE' ||
    normalized === 'LINEのみ' ||
    normalized === 'LINE+メール' ||
    normalized === 'Chat' ||
    normalized === 'チャット';
  var fallbackToMail =
    (normalized === 'LINE' || normalized === 'Chat' || normalized === 'チャット') && !useMail;

  return {
    raw: raw || 'LINE',
    normalized: normalized,
    useLine: useLine,
    useMail: useMail,
    fallbackToMail: fallbackToMail,
    useChatPost: useLine && !!getChatWebhookUrl_(),
  };
}

/**
 * 全店舗の配信先（LINE / メール）と5日時の想定チャネルを一覧出力
 */
function auditDeliveryChannels() {
  ensureFolderMappingSheet_();
  applyDeliveryChannelValidation_(
    getSpreadsheet_().getSheetByName(getConfig_().FOLDER_MAPPING_SHEET_NAME)
  );

  var sheetName = '配信先確認';
  var headers = [
    'kintoneShopName',
    '店舗名',
    '配信方法(設定)',
    'LINE紐づけ数',
    'メール',
    '5日の想定',
    '備考',
  ];
  var sheet = getOrCreateSheet_(getSpreadsheet_(), sheetName, headers);

  var shops = loadShopMaster_();
  var folderMappings = loadFolderMappings_();
  var ownerIndex = loadOwnerEmailIndex_();
  var ownerUserIndex = loadOwnerUserIdsIndex_();
  var lineLinkIndex = loadLineLinkByUsermIndex_();

  var rows = shops.map(function (shop) {
    var channels = resolveDeliveryChannels_(shop, folderMappings);
    var lineIds = channels.useLine
      ? resolveLineUserIdsForShop_(shop, ownerUserIndex, lineLinkIndex)
      : [];
    var emails = resolveOwnerEmailsForShop_(shop, ownerIndex);
    var canLine = channels.useLine && lineIds.length > 0;
    var canMail = channels.useMail && emails.length > 0;
    var mailFallback = false;
    if (!canMail && channels.fallbackToMail && !canLine && emails.length) {
      canMail = true;
      mailFallback = true;
    }

    var predicted = '不可';
    var note = '';
    if (canLine && canMail && channels.useMail) predicted = 'LINE+メール';
    else if (canLine && channels.normalized === 'LINE+メール' && !canMail) {
      predicted = 'LINEのみ（メール未登録）';
    } else if (canLine) predicted = 'LINE';
    else if (canMail && mailFallback) predicted = 'メール(フォールバック)';
    else if (canMail) predicted = 'メール';
    else if (channels.fallbackToMail && !emails.length) note = 'LINE未登録・メールなし';
    else if (channels.normalized === 'LINEのみ' && !canLine) note = 'LINEのみ指定だが未登録';
    else if (!canLine && !canMail) note = '送信先なし';

    return [
      shop.kintoneShopName,
      shop.name,
      channels.raw || 'LINE(デフォルト)',
      lineIds.length,
      emails.join(', '),
      predicted,
      note,
    ];
  });

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  var msg = '配信先確認シートを更新しました（' + rows.length + '店舗）';
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}
