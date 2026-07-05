/**
 * 店舗月次KPI — コックピットダッシュボード用
 */

var KPI_HEADERS_ = [
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
  '更新日時',
];

var KPI_COL_ = {};
KPI_HEADERS_.forEach(function (h, i) {
  KPI_COL_[h] = i;
});

function ensureKpiSheet_() {
  return getOrCreateSheet_(
    getSpreadsheet_(),
    getConfig_().KPI_SHEET_NAME,
    KPI_HEADERS_
  );
}

function rowToKpiRecord_(row) {
  return {
    targetYm: String(row[KPI_COL_['対象年月']] || ''),
    kintoneShopName: String(row[KPI_COL_['kintoneShopName']] || ''),
    shopName: String(row[KPI_COL_['店舗名']] || ''),
    sales: parseKpiNumber_(row[KPI_COL_['実売上']]),
    visitors: parseKpiNumber_(row[KPI_COL_['来客数']]),
    unitPrice: parseKpiNumber_(row[KPI_COL_['客単価']]),
    bedUtilization: parseKpiNumber_(row[KPI_COL_['ベッド稼働率']]),
    bedUtilizationUnits: parseKpiNumber_(row[KPI_COL_['ベッド稼働台数']]),
    missedAppointments: parseKpiNumber_(row[KPI_COL_['取りこぼし件数']]),
    newVisitors: parseKpiNumber_(row[KPI_COL_['新規来客数']]),
    newRepeatRatio: parseKpiNumber_(row[KPI_COL_['新規リピート比率']]),
    breakEven: parseKpiNumber_(row[KPI_COL_['損益分岐点']]),
    priorityTheme: String(row[KPI_COL_['優先テーマ']] || '').trim(),
    updatedAt: row[KPI_COL_['更新日時']],
  };
}

function parseKpiNumber_(value) {
  if (value === '' || value === null || value === undefined) return null;
  var n = Number(value);
  return isNaN(n) ? null : n;
}

function loadKpiRecord_(targetYm, kintoneShopName) {
  var sheet = ensureKpiSheet_();
  var values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    var row = values[i];
    if (String(row[KPI_COL_['対象年月']]) !== targetYm) continue;
    if (String(row[KPI_COL_['kintoneShopName']]) !== kintoneShopName) continue;
    return rowToKpiRecord_(row);
  }
  return null;
}

function loadKpiIndexForYm_(targetYm) {
  var sheet = ensureKpiSheet_();
  var values = sheet.getDataRange().getValues();
  var index = {};
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (String(row[KPI_COL_['対象年月']]) !== targetYm) continue;
    var key = String(row[KPI_COL_['kintoneShopName']]);
    index[key] = rowToKpiRecord_(row);
  }
  return index;
}

function loadKpiTrend_(kintoneShopName, endYm, months) {
  months = months || 12;
  var sheet = ensureKpiSheet_();
  var values = sheet.getDataRange().getValues();
  var rows = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (String(row[KPI_COL_['kintoneShopName']]) !== kintoneShopName) continue;
    rows.push(rowToKpiRecord_(row));
  }

  rows.sort(function (a, b) {
    return String(a.targetYm).localeCompare(String(b.targetYm));
  });

  if (endYm) {
    rows = rows.filter(function (r) {
      return String(r.targetYm) <= String(endYm);
    });
  }

  if (rows.length > months) {
    rows = rows.slice(rows.length - months);
  }

  return rows.map(function (r) {
    return {
      targetYm: r.targetYm,
      sales: r.sales,
      bedUtilization: r.bedUtilization,
      visitors: r.visitors,
      missedAppointments: r.missedAppointments,
    };
  });
}

function saveKpiRecord_(record) {
  var sheet = ensureKpiSheet_();
  var values = sheet.getDataRange().getValues();
  var rowIndex = -1;

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (String(row[KPI_COL_['対象年月']]) !== record.targetYm) continue;
    if (String(row[KPI_COL_['kintoneShopName']]) !== record.kintoneShopName) continue;
    rowIndex = i + 1;
    break;
  }

  var out = [
    record.targetYm,
    record.kintoneShopName,
    record.shopName || '',
    record.sales != null ? record.sales : '',
    record.visitors != null ? record.visitors : '',
    record.unitPrice != null ? record.unitPrice : '',
    record.bedUtilization != null ? record.bedUtilization : '',
    record.bedUtilizationUnits != null ? record.bedUtilizationUnits : '',
    record.missedAppointments != null ? record.missedAppointments : '',
    record.newVisitors != null ? record.newVisitors : '',
    record.newRepeatRatio != null ? record.newRepeatRatio : '',
    record.breakEven != null ? record.breakEven : '',
    record.priorityTheme || '',
    new Date(),
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, out.length).setValues([out]);
  } else {
    sheet.appendRow(out);
  }

  return rowToKpiRecord_(out);
}

function inferPriorityTheme_(kpi) {
  if (!kpi) return '';
  if (kpi.priorityTheme) return kpi.priorityTheme;

  var util = kpi.bedUtilization;
  var missed = kpi.missedAppointments;
  if (util == null) return '';

  if (util >= 25 && (missed == null || missed < 15)) return '好調';
  if (util < 22 && (missed == null || missed < 15)) return '集客';
  if (util < 22 && missed != null && missed >= 15) return '両方';
  if (missed != null && missed >= 20) return '両方';
  if (util >= 22 && missed != null && missed >= 15) return '求人';
  return '集客';
}

function isAttentionShop_(workStatus, kpi) {
  if (workStatus !== 'approved') return true;
  if (!kpi) return false;
  if (kpi.missedAppointments != null && kpi.missedAppointments >= 25) return true;
  if (kpi.bedUtilization != null && kpi.bedUtilization < 18) return true;
  return false;
}

function formatYen_(n) {
  if (n == null || isNaN(n)) return '—';
  return '¥' + Math.round(n).toLocaleString('ja-JP');
}

function formatPercent_(n) {
  if (n == null || isNaN(n)) return '—';
  return n + '%';
}
