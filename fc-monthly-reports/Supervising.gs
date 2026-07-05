/**
 * スーパーバイジング下書きの保存・Claude API 生成
 */

var SUPERVISING_HEADERS_ = [
  '対象年月',
  'kintoneShopName',
  '店舗名',
  '月次PDF_ID',
  '月次PDF名',
  '月次PDF_URL',
  '顧客分析PDF_ID',
  '顧客分析PDF名',
  '顧客分析PDF_URL',
  'AI下書き',
  '編集後本文',
  '状態',
  '更新日時',
  '更新者',
];

var SUPERVISING_COL_ = {};
SUPERVISING_HEADERS_.forEach(function (h, i) {
  SUPERVISING_COL_[h] = i;
});

var COCKPIT_MAX_PDF_BYTES_ = 8 * 1024 * 1024;

function ensureSupervisingSheet_() {
  return getOrCreateSheet_(
    getSpreadsheet_(),
    getConfig_().SUPERVISING_SHEET_NAME,
    SUPERVISING_HEADERS_
  );
}

function findShopByKintoneName_(kintoneShopName) {
  var shops = loadShopMaster_();
  for (var i = 0; i < shops.length; i++) {
    if (shops[i].kintoneShopName === kintoneShopName) return shops[i];
  }
  return null;
}

function loadSupervisingRecord_(targetYm, kintoneShopName) {
  var sheet = ensureSupervisingSheet_();
  var values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    var row = values[i];
    if (String(row[SUPERVISING_COL_['対象年月']]) !== targetYm) continue;
    if (String(row[SUPERVISING_COL_['kintoneShopName']]) !== kintoneShopName) continue;
    return rowToSupervisingRecord_(row);
  }
  return null;
}

function loadSupervisingIndexForYm_(targetYm) {
  var sheet = ensureSupervisingSheet_();
  var values = sheet.getDataRange().getValues();
  var index = {};
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (String(row[SUPERVISING_COL_['対象年月']]) !== targetYm) continue;
    var key = String(row[SUPERVISING_COL_['kintoneShopName']]);
    index[key] = rowToSupervisingRecord_(row);
  }
  return index;
}

function rowToSupervisingRecord_(row) {
  return {
    targetYm: String(row[SUPERVISING_COL_['対象年月']] || ''),
    kintoneShopName: String(row[SUPERVISING_COL_['kintoneShopName']] || ''),
    shopName: String(row[SUPERVISING_COL_['店舗名']] || ''),
    monthlyPdfId: String(row[SUPERVISING_COL_['月次PDF_ID']] || ''),
    monthlyPdfName: String(row[SUPERVISING_COL_['月次PDF名']] || ''),
    monthlyPdfUrl: String(row[SUPERVISING_COL_['月次PDF_URL']] || ''),
    analysisPdfId: String(row[SUPERVISING_COL_['顧客分析PDF_ID']] || ''),
    analysisPdfName: String(row[SUPERVISING_COL_['顧客分析PDF名']] || ''),
    analysisPdfUrl: String(row[SUPERVISING_COL_['顧客分析PDF_URL']] || ''),
    aiDraft: String(row[SUPERVISING_COL_['AI下書き']] || ''),
    editedBody: String(row[SUPERVISING_COL_['編集後本文']] || ''),
    status: String(row[SUPERVISING_COL_['状態']] || 'draft'),
    updatedAt: row[SUPERVISING_COL_['更新日時']],
    updatedBy: String(row[SUPERVISING_COL_['更新者']] || ''),
  };
}

function saveSupervisingRecord_(record) {
  var sheet = ensureSupervisingSheet_();
  var values = sheet.getDataRange().getValues();
  var rowIndex = -1;

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (String(row[SUPERVISING_COL_['対象年月']]) !== record.targetYm) continue;
    if (String(row[SUPERVISING_COL_['kintoneShopName']]) !== record.kintoneShopName) continue;
    rowIndex = i + 1;
    break;
  }

  var now = new Date();
  // container-bound 以外や権限不足でも落とさない（updatedBy は参考情報なので空でOK）
  var user = '';
  try {
    user = Session.getActiveUser().getEmail() || '';
  } catch (e) {
    user = '';
  }
  var out = [
    record.targetYm,
    record.kintoneShopName,
    record.shopName || '',
    record.monthlyPdfId || '',
    record.monthlyPdfName || '',
    record.monthlyPdfUrl || '',
    record.analysisPdfId || '',
    record.analysisPdfName || '',
    record.analysisPdfUrl || '',
    record.aiDraft || '',
    record.editedBody || '',
    record.status || 'draft',
    now,
    user,
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, out.length).setValues([out]);
  } else {
    sheet.appendRow(out);
  }

  return rowToSupervisingRecord_(out);
}

function getAnthropicApiKey_() {
  return String(PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY') || '').trim();
}

function getAnthropicModel_() {
  return (
    String(PropertiesService.getScriptProperties().getProperty('ANTHROPIC_MODEL') || '').trim() ||
    'claude-sonnet-4-6'
  );
}

function blobToBase64_(blob) {
  return Utilities.base64Encode(blob.getBytes());
}

function assertPdfSize_(blob, label) {
  if (blob.getBytes().length > COCKPIT_MAX_PDF_BYTES_) {
    throw new Error(
      label +
        ' のファイルが大きすぎます（上限 ' +
        Math.floor(COCKPIT_MAX_PDF_BYTES_ / 1024 / 1024) +
        'MB）。PDFを分割するか、軽量版をアップロードしてください。'
    );
  }
}

function readPdfFromDriveId_(fileId, label) {
  if (!fileId) return null;
  var file = DriveApp.getFileById(fileId);
  var blob = file.getBlob();
  assertPdfSize_(blob, label);
  return {
    id: file.getId(),
    name: file.getName(),
    url: file.getUrl(),
    base64: blobToBase64_(blob),
    mimeType: blob.getContentType() || 'application/pdf',
  };
}

function buildSupervisingPrompt_(shopName, targetYm) {
  var year = Number(targetYm.slice(0, 4));
  var month = Number(targetYm.slice(4, 6));
  var label = year + '年' + month + '月';

  return [
    'あなたはもみかるFC本部のスーパーバイザーです。',
    '加盟店オーナー向けの月次スーパーバイジングコメントを日本語で作成してください。',
    '',
    '店舗名: ' + shopName,
    '対象月: ' + label,
    '',
    '添付の「月次レポート」「顧客分析」のPDFを読み、次の構成で出力してください。',
    '',
    '【総括】',
    '（2〜3文。数値の印象を端的に）',
    '',
    '【良かった点】',
    '・（2〜4点、箇条書き）',
    '',
    '【改善・注力ポイント】',
    '・（2〜4点、箇条書き。批判的すぎず具体的に）',
    '',
    '【来月への提案】',
    '・（1〜2点）',
    '',
    'トーン: 敬意を持ち、励ましつつ具体的。断定しすぎず、データに基づく表現を使う。',
    '絵文字は使わない。見出しの【】はそのまま出力する。',
    'Markdown記法（#, **, ---, * など）は使わず、プレーンテキストのみで書く。',
    '区切り線（--- や ────）は入れない。',
  ].join('\n');
}

function callClaudeForSupervising_(monthlyPdf, analysisPdf, shopName, targetYm) {
  var apiKey = getAnthropicApiKey_();
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY が未設定です。Apps Script → プロジェクトの設定 → スクリプト プロパティ に API キーを追加してください。'
    );
  }

  var content = [];
  if (monthlyPdf) {
    content.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: monthlyPdf.base64,
      },
    });
    content.push({
      type: 'text',
      text: '上記は月次レポートPDF（' + monthlyPdf.name + '）です。',
    });
  }
  if (analysisPdf) {
    content.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: analysisPdf.base64,
      },
    });
    content.push({
      type: 'text',
      text: '上記は顧客分析PDF（' + analysisPdf.name + '）です。',
    });
  }
  content.push({
    type: 'text',
    text: buildSupervisingPrompt_(shopName, targetYm),
  });

  var payload = {
    model: getAnthropicModel_(),
    max_tokens: 2048,
    messages: [{ role: 'user', content: content }],
  };

  var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  var body = response.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('Claude API エラー (' + code + '): ' + body.slice(0, 500));
  }

  var json = JSON.parse(body);
  var parts = json.content || [];
  var text = parts
    .filter(function (p) {
      return p.type === 'text';
    })
    .map(function (p) {
      return p.text;
    })
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('Claude API から本文が返りませんでした。');
  }
  return text;
}

/**
 * スーパーバイジング下書きを生成してシートに保存
 */
function generateSupervisingDraft_(targetYm, kintoneShopName) {
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

  var monthlyPdf = readPdfFromDriveId_(record.monthlyPdfId, '月次レポート');
  var analysisPdf = readPdfFromDriveId_(record.analysisPdfId, '顧客分析');

  if (!monthlyPdf && !analysisPdf) {
    throw new Error(
      'PDFが未登録です。コックピットからアップロードするか、Driveから読み込んでください。'
    );
  }

  var draft = callClaudeForSupervising_(
    monthlyPdf,
    analysisPdf,
    shop.name,
    targetYm
  );

  record.aiDraft = draft;
  if (!record.editedBody) {
    record.editedBody = draft;
  }
  record.status = 'draft';
  return saveSupervisingRecord_(record);
}

/**
 * 店舗フォルダの PDF をスーパーバイジングレコードに紐付け
 * @return {Object|null} 月次・顧客分析の両方あるときレコード、なければ null
 */
function linkSupervisingPdfsFromStore_(targetYm, kintoneShopName) {
  var shop = findShopByKintoneName_(kintoneShopName);
  if (!shop) return null;

  var year = Number(targetYm.slice(0, 4));
  var month = Number(targetYm.slice(4, 6));
  var folderMappings = loadFolderMappings_();
  var resolved = resolveStoreFolderFast_(kintoneShopName, folderMappings);
  if (!resolved || !resolved.folder) {
    var caches = buildDriveCaches_({});
    resolved = resolveStoreFolder_(
      kintoneShopName,
      caches.fcCache,
      caches.directCache,
      folderMappings
    );
  }
  if (!resolved || !resolved.folder) return null;

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
  if (!monthly || !analysis) return null;

  var record = loadSupervisingRecord_(targetYm, kintoneShopName) || {
    targetYm: targetYm,
    kintoneShopName: kintoneShopName,
    shopName: shop.name,
    status: 'draft',
  };

  record.monthlyPdfId = monthly.id;
  record.monthlyPdfName = monthly.name;
  record.monthlyPdfUrl = monthly.url;
  record.analysisPdfId = analysis.id;
  record.analysisPdfName = analysis.name;
  record.analysisPdfUrl = analysis.url;

  return saveSupervisingRecord_(record);
}

/**
 * 5日配信用：承認済みならそのまま、なければ AI 生成
 * @return {{record:Object, body:string, generated:boolean}}
 */
function prepareSupervisingBodyForDelivery_(targetYm, kintoneShopName) {
  var record = linkSupervisingPdfsFromStore_(targetYm, kintoneShopName);
  if (!record) {
    throw new Error('月次レポート・顧客分析の PDF が両方揃っていません');
  }

  if (record.status === 'approved' && String(record.editedBody || '').trim()) {
    return {
      record: record,
      body: String(record.editedBody).trim(),
      generated: false,
    };
  }

  record = generateSupervisingDraft_(targetYm, kintoneShopName);
  var body = String(record.editedBody || record.aiDraft || '').trim();
  if (!body) {
    throw new Error('スーパーバイジング本文が空です');
  }

  record.status = 'auto_sent';
  record = saveSupervisingRecord_(record);

  return {
    record: record,
    body: body,
    generated: true,
  };
}

function getSupervisingDisplayBody_(record) {
  if (!record) return '';
  if (record.status === 'approved' && String(record.editedBody || '').trim()) {
    return sanitizeDeliveryText_(String(record.editedBody).trim());
  }
  return sanitizeDeliveryText_(String(record.editedBody || record.aiDraft || '').trim());
}
