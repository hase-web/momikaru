/**
 * 本部コックピット — アップロード・プレビュー・下書き管理・v2ダッシュボード
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('CockpitDashboard')
    .setTitle('もみかるFC 月次スーパーバイジング')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function openCockpit() {
  var html = HtmlService.createHtmlOutputFromFile('CockpitDashboard')
    .setWidth(1400)
    .setHeight(900);
  SpreadsheetApp.getUi().showModalDialog(html, '月次スーパーバイジング コックピット');
}

function cockpitGetDashboard(targetYm, filter, searchText) {
  targetYm = String(targetYm || '').trim();
  if (!/^\d{6}$/.test(targetYm)) {
    targetYm = getTargetYearMonth_().yyyyMM;
  }
  filter = String(filter || 'all');
  searchText = String(searchText || '').trim().toLowerCase();

  // コックピット（本部SV）：出張もみかるは除外、直営店は表示する
  var folderMappings = loadFolderMappings_();
  var shops = loadShopMaster_().filter(function (shop) {
    if (!isShopActiveForMonth_(shop, targetYm)) return false;
    // 出張もみかるは直営扱い（shopmに残っていても本部SVコックピットには出さない）
    if (String(shop.name || '').indexOf('出張もみかる') !== -1) return false;
    return true;
  });

  var supervisingIndex = loadSupervisingIndexForYm_(targetYm);
  var kpiIndex = loadKpiIndexForYm_(targetYm);
  var items = [];
  var stats = { total: 0, attention: 0, draft: 0, approved: 0, none: 0 };

  shops.forEach(function (shop) {
    var key = shop.kintoneShopName;
    var sup = supervisingIndex[key];
    var kpi = kpiIndex[key];
    var workStatus = 'none';

    if (sup) {
      workStatus = String(sup.status || 'draft') === 'approved' ? 'approved' : 'draft';
    }
    if (workStatus === 'none') stats.none += 1;
    else if (workStatus === 'draft') stats.draft += 1;
    else stats.approved += 1;

    var attention = isAttentionShop_(workStatus, kpi);
    if (attention) stats.attention += 1;

    var priorityTheme = inferPriorityTheme_(kpi);
    var item = {
      kintoneShopName: key,
      name: shop.name,
      workStatus: workStatus,
      attention: attention,
      priorityTheme: priorityTheme,
      hasMonthlyPdf: !!(sup && sup.monthlyPdfId),
      hasAnalysisPdf: !!(sup && sup.analysisPdfId),
      sales: kpi ? kpi.sales : null,
      bedUtilization: kpi ? kpi.bedUtilization : null,
      missedAppointments: kpi ? kpi.missedAppointments : null,
      salesLabel: formatYen_(kpi ? kpi.sales : null),
      bedUtilizationLabel: formatPercent_(kpi ? kpi.bedUtilization : null),
      missedLabel: kpi && kpi.missedAppointments != null ? kpi.missedAppointments + '件' : '—',
    };

    if (filter === 'attention' && !attention) return;
    if (filter === 'draft' && workStatus !== 'draft') return;
    if (filter === 'approved' && workStatus !== 'approved') return;
    if (filter === 'none' && workStatus !== 'none') return;
    if (filter === '集客' && priorityTheme !== '集客') return;
    if (filter === '求人' && priorityTheme !== '求人') return;
    if (filter === '両方' && priorityTheme !== '両方') return;
    if (filter === '好調' && priorityTheme !== '好調') return;

    if (searchText) {
      var hay = (key + ' ' + shop.name).toLowerCase();
      if (hay.indexOf(searchText) < 0) return;
    }

    items.push(item);
    stats.total += 1;
  });

  items.sort(function (a, b) {
    if (a.attention !== b.attention) return a.attention ? -1 : 1;
    if (a.workStatus !== b.workStatus) {
      var order = { none: 0, draft: 1, approved: 2 };
      return (order[a.workStatus] || 9) - (order[b.workStatus] || 9);
    }
    return String(a.kintoneShopName).localeCompare(String(b.kintoneShopName), 'ja');
  });

  return {
    targetYm: targetYm,
    targetLabel: formatYmLabel_(targetYm),
    filter: filter,
    stats: {
      all: shops.length,
      attention: stats.attention,
      draft: stats.draft,
      approved: stats.approved,
      none: stats.none,
      shown: stats.total,
    },
    shops: items,
    hasApiKey: !!getAnthropicApiKey_(),
    maxPdfMb: Math.floor(COCKPIT_MAX_PDF_BYTES_ / 1024 / 1024),
  };
}

function formatYmLabel_(targetYm) {
  return (
    targetYm.slice(0, 4) +
    '年' +
    Number(targetYm.slice(4, 6)) +
    '月'
  );
}

function cockpitGetShopPanel(targetYm, kintoneShopName) {
  targetYm = String(targetYm || '').trim();
  kintoneShopName = String(kintoneShopName || '').trim();
  var shop = findShopByKintoneName_(kintoneShopName);
  if (!shop) {
    throw new Error('店舗が見つかりません: ' + kintoneShopName);
  }

  var record = cockpitLoadRecord(targetYm, kintoneShopName);
  var kpi = loadKpiRecord_(targetYm, kintoneShopName);
  var priorityTheme = inferPriorityTheme_(kpi);
  var workStatus = 'none';
  if (String(record.status) === 'approved') workStatus = 'approved';
  else if (record.monthlyPdfId || record.analysisPdfId || record.editedBody || record.aiDraft) {
    workStatus = 'draft';
  }

  return {
    shop: { kintoneShopName: shop.kintoneShopName, name: shop.name },
    targetYm: targetYm,
    targetLabel: formatYmLabel_(targetYm),
    record: record,
    kpi: kpi,
    trend: null,
    priorityTheme: priorityTheme,
    workStatus: workStatus,
    attention: isAttentionShop_(workStatus, kpi),
  };
}

/**
 * HTML Service 側で稀にオブジェクトが null で届く場合があるため、JSON 文字列版も用意する（デバッグ兼フォールバック）。
 */
function cockpitGetShopPanelJson(targetYm, kintoneShopName) {
  var panel = cockpitGetShopPanel(targetYm, kintoneShopName);
  return JSON.stringify(panel);
}

function cockpitGetKpiTrend(kintoneShopName, endYm, months) {
  kintoneShopName = String(kintoneShopName || '').trim();
  endYm = String(endYm || '').trim();
  months = months || 12;
  if (!kintoneShopName) throw new Error('店舗を選択してください。');

  var cacheKey = 'kpiTrend:' + kintoneShopName + ':' + endYm + ':' + months;
  try {
    var cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    // noop
  }

  var trend = loadKpiTrend_(kintoneShopName, endYm, months);
  try {
    CacheService.getScriptCache().put(cacheKey, JSON.stringify(trend), 10 * 60);
  } catch (e2) {
    // noop
  }
  return trend;
}

function cockpitSaveKpi(payload) {
  payload = payload || {};
  var targetYm = String(payload.targetYm || '').trim();
  var kintoneShopName = String(payload.kintoneShopName || '').trim();
  if (!/^\d{6}$/.test(targetYm)) {
    throw new Error('対象年月は YYYYMM 形式で指定してください。');
  }
  var shop = findShopByKintoneName_(kintoneShopName);
  if (!shop) {
    throw new Error('店舗が見つかりません: ' + kintoneShopName);
  }

  var record = {
    targetYm: targetYm,
    kintoneShopName: kintoneShopName,
    shopName: shop.name,
    sales: parseKpiNumber_(payload.sales),
    visitors: parseKpiNumber_(payload.visitors),
    unitPrice: parseKpiNumber_(payload.unitPrice),
    bedUtilization: parseKpiNumber_(payload.bedUtilization),
    bedUtilizationUnits: parseKpiNumber_(payload.bedUtilizationUnits),
    missedAppointments: parseKpiNumber_(payload.missedAppointments),
    newVisitors: parseKpiNumber_(payload.newVisitors),
    newRepeatRatio: parseKpiNumber_(payload.newRepeatRatio),
    breakEven: parseKpiNumber_(payload.breakEven),
    priorityTheme: String(payload.priorityTheme || '').trim(),
  };

  return saveKpiRecord_(record);
}

function cockpitLoadRecord(targetYm, kintoneShopName) {
  var record = loadSupervisingRecord_(targetYm, kintoneShopName);
  if (!record) {
    var shop = findShopByKintoneName_(kintoneShopName);
    return {
      targetYm: targetYm,
      kintoneShopName: kintoneShopName,
      shopName: shop ? shop.name : '',
      monthlyPdfId: '',
      monthlyPdfName: '',
      monthlyPdfUrl: '',
      analysisPdfId: '',
      analysisPdfName: '',
      analysisPdfUrl: '',
      aiDraft: '',
      editedBody: '',
      status: 'draft',
    };
  }
  return record;
}

function getCockpitUploadFolder_(kintoneShopName, targetYm) {
  var cfg = getConfig_();
  var destRoot = getDriveFolder_(cfg.DEST_ROOT_FOLDER_ID, 'コピー先（B_FC加盟店）');
  var rootName = cfg.COCKPIT_UPLOAD_ROOT_NAME || 'FC月次レポート_コックピット';

  var rootIt = destRoot.getFoldersByName(rootName);
  var root = rootIt.hasNext() ? rootIt.next() : destRoot.createFolder(rootName);

  var shopFolder = getOrCreateChildFolder_(root, kintoneShopName);
  return getOrCreateChildFolder_(shopFolder, targetYm);
}

function saveUploadedPdf_(folder, reportType, fileName, base64Data) {
  if (!base64Data) return null;
  var bytes = Utilities.base64Decode(base64Data);
  assertPdfSize_(Utilities.newBlob(bytes), reportType);
  var safeName = String(fileName || reportType + '.pdf').replace(/[\\/:*?"<>|]/g, '_');
  if (!/\.pdf$/i.test(safeName)) safeName += '.pdf';

  var existing = folder.getFilesByName(safeName);
  while (existing.hasNext()) {
    existing.next().setTrashed(true);
  }

  var blob = Utilities.newBlob(bytes, 'application/pdf', safeName);
  var file = folder.createFile(blob);
  return {
    id: file.getId(),
    name: file.getName(),
    url: file.getUrl(),
  };
}

/**
 * コックピットから PDF をアップロード
 * @param {{targetYm:string,kintoneShopName:string,monthly?:{name:string,data:string},analysis?:{name:string,data:string}}} payload
 */
function cockpitUploadFiles(payload) {
  payload = payload || {};
  var targetYm = String(payload.targetYm || '').trim();
  var kintoneShopName = String(payload.kintoneShopName || '').trim();
  if (!/^\d{6}$/.test(targetYm)) {
    throw new Error('対象年月は YYYYMM 形式で指定してください。');
  }
  if (!kintoneShopName) {
    throw new Error('店舗を選択してください。');
  }

  var shop = findShopByKintoneName_(kintoneShopName);
  if (!shop) {
    throw new Error('店舗が見つかりません: ' + kintoneShopName);
  }

  if (!payload.monthly && !payload.analysis) {
    throw new Error('月次レポートまたは顧客分析の PDF を1つ以上選択してください。');
  }

  var folder = getCockpitUploadFolder_(kintoneShopName, targetYm);
  var record = loadSupervisingRecord_(targetYm, kintoneShopName) || {
    targetYm: targetYm,
    kintoneShopName: kintoneShopName,
    shopName: shop.name,
    status: 'draft',
  };

  if (payload.monthly && payload.monthly.data) {
    var monthly = saveUploadedPdf_(
      folder,
      '月次レポート',
      payload.monthly.name,
      payload.monthly.data
    );
    record.monthlyPdfId = monthly.id;
    record.monthlyPdfName = monthly.name;
    record.monthlyPdfUrl = monthly.url;
  }

  if (payload.analysis && payload.analysis.data) {
    var analysis = saveUploadedPdf_(
      folder,
      '顧客分析',
      payload.analysis.name,
      payload.analysis.data
    );
    record.analysisPdfId = analysis.id;
    record.analysisPdfName = analysis.name;
    record.analysisPdfUrl = analysis.url;
  }

  record.status = 'draft';
  return saveSupervisingRecord_(record);
}

function findFirstPdfInFolder_(folder) {
  if (!folder) return null;
  // フォルダ内ファイルを全走査すると重いので、まずクエリ検索（PDFのみ）で拾う
  try {
    var q =
      '"' +
      folder.getId() +
      '" in parents and trashed=false and (mimeType="application/pdf" or title contains ".pdf")';
    var it = DriveApp.searchFiles(q);
    if (it.hasNext()) {
      var f = it.next();
      return { id: f.getId(), name: f.getName(), url: f.getUrl() };
    }
  } catch (e) {
    // フォールバックして従来走査
  }

  var files = folder.getFiles();
  while (files.hasNext()) {
    var f2 = files.next();
    if (f2.getMimeType() === MimeType.PDF || /\.pdf$/i.test(f2.getName())) {
      return { id: f2.getId(), name: f2.getName(), url: f2.getUrl() };
    }
  }
  return null;
}

/**
 * 各店舗フォルダ（本番コピー先）から PDF を読み込む
 */
function cockpitLoadFromStoreFolder(targetYm, kintoneShopName) {
  var shop = findShopByKintoneName_(kintoneShopName);
  if (!shop) {
    throw new Error('店舗が見つかりません: ' + kintoneShopName);
  }

  var year = Number(targetYm.slice(0, 4));
  var month = Number(targetYm.slice(4, 6));
  var folderMappings = loadFolderMappings_();
  var resolved = resolveStoreFolderFast_(kintoneShopName, folderMappings);
  if (!resolved) {
    // フォルダがネストしている/同名がある等のケースにだけフォールバック（重い）
    var caches = buildDriveCaches_({});
    resolved = resolveStoreFolder_(
      kintoneShopName,
      caches.fcCache,
      caches.directCache,
      folderMappings
    );
  }

  if (!resolved || !resolved.folder) {
    throw new Error('店舗フォルダが見つかりません: ' + kintoneShopName);
  }

  var storeFolder = resolved.folder;
  var monthlyFolder = findReportDestinationFolder_(
    storeFolder,
    '月次レポート',
    year,
    month
  );
  var analysisFolder = findReportDestinationFolder_(
    storeFolder,
    '顧客分析',
    year,
    month
  );

  var monthly = findFirstPdfInFolder_(monthlyFolder);
  var analysis = findFirstPdfInFolder_(analysisFolder);

  if (!monthly && !analysis) {
    throw new Error(
      '店舗フォルダに ' +
        year +
        '年' +
        month +
        '月分の PDF が見つかりません。先にコピーを実行するか、アップロードしてください。'
    );
  }

  var record = loadSupervisingRecord_(targetYm, kintoneShopName) || {
    targetYm: targetYm,
    kintoneShopName: kintoneShopName,
    shopName: shop.name,
    status: 'draft',
  };

  if (monthly) {
    record.monthlyPdfId = monthly.id;
    record.monthlyPdfName = monthly.name;
    record.monthlyPdfUrl = monthly.url;
  }
  if (analysis) {
    record.analysisPdfId = analysis.id;
    record.analysisPdfName = analysis.name;
    record.analysisPdfUrl = analysis.url;
  }

  return saveSupervisingRecord_(record);
}

function cockpitGenerateDraft(targetYm, kintoneShopName) {
  return generateSupervisingDraft_(targetYm, kintoneShopName);
}

/**
 * ダッシュボード用途：毎回の全フォルダ走査を避けるため、まずルート直下の名前検索で解決する。
 * 見つからない/複数ヒット等のときは null を返し、呼び出し側で従来のキャッシュ探索にフォールバックする。
 *
 * @return {{folder:GoogleAppsScript.Drive.Folder, storeType:string, driveFolderName:string}|null}
 */
function resolveStoreFolderFast_(kintoneShopName, folderMappings) {
  var cfg = getConfig_();
  var mapping = getFolderMappingForShop_(kintoneShopName, folderMappings);
  var isDirect = mapping.storeType === '直営';

  // 直近に解決したフォルダIDをキャッシュ（同一店舗の繰り返し読込が速くなる）
  var cacheKey = 'storeFolderId:' + mapping.storeType + ':' + mapping.driveFolderName;
  try {
    var cachedId = CacheService.getScriptCache().get(cacheKey);
    if (cachedId) {
      return {
        folder: DriveApp.getFolderById(cachedId),
        storeType: mapping.storeType,
        driveFolderName: mapping.driveFolderName,
      };
    }
  } catch (e) {
    // noop
  }

  if (mapping.driveFolderId) {
    try {
      return {
        folder: DriveApp.getFolderById(mapping.driveFolderId),
        storeType: mapping.storeType,
        driveFolderName: mapping.driveFolderName,
      };
    } catch (e) {
      // IDが壊れている場合はフォールバックさせる（既存ロジックでエラーメッセージを出す）
      return null;
    }
  }

  var rootId = isDirect ? cfg.DIRECT_ROOT_FOLDER_ID : cfg.DEST_ROOT_FOLDER_ID;
  if (!rootId) return null;
  var root = DriveApp.getFolderById(rootId);
  var it = root.getFoldersByName(mapping.driveFolderName);
  if (!it.hasNext()) return null;
  var folder = it.next();
  if (it.hasNext()) return null; // 同名が複数なら従来ロジックに任せる

  try {
    CacheService.getScriptCache().put(cacheKey, folder.getId(), 6 * 60 * 60);
  } catch (e) {
    // noop
  }

  return {
    folder: folder,
    storeType: mapping.storeType,
    driveFolderName: mapping.driveFolderName,
  };
}

function cockpitSaveComment(targetYm, kintoneShopName, editedBody, status) {
  var shop = findShopByKintoneName_(kintoneShopName);
  if (!shop) {
    throw new Error('店舗が見つかりません: ' + kintoneShopName);
  }

  var record = loadSupervisingRecord_(targetYm, kintoneShopName) || {
    targetYm: targetYm,
    kintoneShopName: kintoneShopName,
    shopName: shop.name,
    status: 'draft',
  };

  record.editedBody = String(editedBody || '');
  record.status = status || record.status || 'draft';
  return saveSupervisingRecord_(record);
}
