/**
 * Andy shop シート + 店舗マッピングタブから店舗マスタを読み込む
 */

function findShopSheet_(spreadsheet) {
  var cfg = getConfig_();
  var candidates = [cfg.SHOP_SHEET_NAME, 'shopm', 'shop', 'Shop', 'SHOP', '店舗'];

  for (var i = 0; i < candidates.length; i++) {
    var sheet = spreadsheet.getSheetByName(candidates[i]);
    if (sheet && sheetHasShopHeaders_(sheet)) return sheet;
  }

  var sheets = spreadsheet.getSheets();
  for (var j = 0; j < sheets.length; j++) {
    if (sheetHasShopHeaders_(sheets[j])) return sheets[j];
  }

  var names = sheets.map(function (s) {
    return s.getName();
  });
  throw new Error(
    '店舗マスタのシートが見つかりません（name / mail / kintoneShopName 列が必要）。' +
      '存在するタブ: ' +
      names.join(', ')
  );
}

function sheetHasShopHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return false;

  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h).trim();
  });

  return (
    header.indexOf('name') >= 0 &&
    header.indexOf('mail') >= 0 &&
    header.indexOf('kintoneShopName') >= 0
  );
}

function deriveKintoneShopNameFromName_(name) {
  return String(name)
    .replace(/^SALON de MOMIKARU/i, '')
    .replace(/^Platinumもみかる/i, '')
    .replace(/^プレミアムもみかる/i, '')
    .replace(/^もみかる/i, '')
    .trim();
}

function loadShopMaster_() {
  var ss = getSpreadsheet_();
  var shopSheet = findShopSheet_(ss);

  var values = shopSheet.getDataRange().getValues();
  if (values.length < 2) return [];

  var header = values[0].map(function (h) {
    return String(h).trim();
  });
  var col = {
    id: header.indexOf('id'),
    name: header.indexOf('name'),
    mail: header.indexOf('mail'),
    startDate: header.indexOf('startDate'),
    endDate: header.indexOf('endDate'),
    kintoneShopName: header.indexOf('kintoneShopName'),
    momiShopCd: header.indexOf('momiShopCd'),
  };

  if (col.name < 0 || col.mail < 0 || col.kintoneShopName < 0) {
    throw new Error('shop シートに name / mail / kintoneShopName 列が必要です。');
  }

  var aliases = loadMappingAliases_();
  var shops = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var name = String(row[col.name] || '').trim();
    var kintoneShopName = String(row[col.kintoneShopName] || '').trim();
    var mail = normalizeEmail_(row[col.mail]);
    if (!name) continue;
    if (!kintoneShopName) {
      kintoneShopName = deriveKintoneShopNameFromName_(name);
    }
    if (!kintoneShopName) continue;

    shops.push({
      rowIndex: i + 1,
      shopId: col.id >= 0 ? normUserId_(row[col.id]) : '',
      name: name,
      kintoneShopName: kintoneShopName,
      mail: mail,
      momiShopCd: col.momiShopCd >= 0 ? String(row[col.momiShopCd] || '').trim() : '',
      startDate: col.startDate >= 0 ? row[col.startDate] : null,
      endDate: col.endDate >= 0 ? row[col.endDate] : null,
      aliases: aliases[kintoneShopName] || [],
    });
  }

  shops.sort(function (a, b) {
    return b.name.length - a.name.length;
  });

  return shops;
}

function loadMappingAliases_() {
  var cfg = getConfig_();
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(cfg.MAPPING_SHEET_NAME);
  var map = {};

  if (!sheet) return map;

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return map;

  for (var i = 1; i < values.length; i++) {
    var alias = String(values[i][0] || '').trim();
    var kintoneShopName = String(values[i][1] || '').trim();
    if (!alias || !kintoneShopName) continue;
    if (!map[kintoneShopName]) map[kintoneShopName] = [];
    map[kintoneShopName].push(alias);
  }
  return map;
}

function isShopActiveForMonth_(shop, targetYm) {
  if (shop.endDate) {
    var end = new Date(shop.endDate);
    if (!isNaN(end.getTime())) {
      var reportEnd = new Date(
        Number(targetYm.slice(0, 4)),
        Number(targetYm.slice(4, 6)),
        0
      );
      if (end < reportEnd) return false;
    }
  }
  return true;
}

/**
 * ファイル名から店舗を特定（長い店舗名を優先）
 * @return {{shop:Object, matchedBy:string}|null}
 */
function matchShopByFileName_(fileName, shops, targetYm) {
  var baseName = String(fileName);

  for (var i = 0; i < shops.length; i++) {
    var shop = shops[i];
    if (!isShopActiveForMonth_(shop, targetYm)) continue;

    if (baseName.indexOf(shop.name) !== -1) {
      return { shop: shop, matchedBy: 'name' };
    }

    var aliases = [shop.kintoneShopName].concat(shop.aliases || []);
    for (var j = 0; j < aliases.length; j++) {
      if (aliases[j] && baseName.indexOf(aliases[j]) !== -1) {
        return { shop: shop, matchedBy: aliases[j] };
      }
    }
  }
  return null;
}

function ensureMappingSheet_() {
  var cfg = getConfig_();
  getOrCreateSheet_(getSpreadsheet_(), cfg.MAPPING_SHEET_NAME, [
    'ファイル名に含まれる文字列',
    'kintoneShopName（Driveフォルダ名）',
    'メモ',
  ]);
}
