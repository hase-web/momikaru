/**
 * フェーズ1: 月次PDF + 顧客分析PDF から数値指標を抽出 → 店舗月次KPI に保存
 * ソースは PDF のみ（スーパーバイジング本文は使わない）
 */

var METRICS_STATE_KEY_ = 'monthly_metrics_state_v1';

var METRICS_JSON_KEYS_ = [
  '実売上',
  '来客数',
  '客単価',
  'ベッド稼働率',
  'ベッド稼働台数',
  '取りこぼし件数',
  '新規来客数',
  '新規リピート比率',
  '損益分岐点',
  'リピート率',
  '年代別来客構成',
  '性別構成',
];

function buildMetricsExtractionPrompt_(shopName, targetYm) {
  var year = Number(targetYm.slice(0, 4));
  var month = Number(targetYm.slice(4, 6));
  var label = year + '年' + month + '月';

  return [
    'あなたはもみかるFC本部のデータ抽出担当です。',
    '添付の「月次レポート」「顧客分析」PDFから、数値のみを読み取り JSON で返してください。',
    '',
    '店舗名: ' + shopName,
    '対象月: ' + label,
    '',
    'ルール:',
    '- PDFに明記された数値だけを使う。推測・補完しない',
    '- 見つからない項目は null',
    '- 金額は円（整数）、率はパーセント数値（例: 23.5）、人数・件数は整数',
    '- 年代別来客構成・性別構成は PDF の集計表どおりのオブジェクト',
    '- 説明文・Markdown・コードフェンスは付けない。JSON オブジェクト1つのみ',
    '',
    '出力キー（すべて含める）:',
    JSON.stringify(METRICS_JSON_KEYS_),
    '',
    'JSON 例:',
    '{',
    '  "実売上": 1234567,',
    '  "来客数": 320,',
    '  "客単価": 3850,',
    '  "ベッド稼働率": 24.5,',
    '  "ベッド稼働台数": 180,',
    '  "取りこぼし件数": 12,',
    '  "新規来客数": 45,',
    '  "新規リピート比率": 38.2,',
    '  "損益分岐点": 980000,',
    '  "リピート率": 62.0,',
    '  "年代別来客構成": {"20代":5,"30代":20,"40代":35,"50代":25,"60代以上":15},',
    '  "性別構成": {"男性":30,"女性":70}',
    '}',
  ].join('\n');
}

function parseMetricsJsonFromClaude_(text) {
  var raw = String(text || '').trim();
  if (!raw) throw new Error('Claude から空の応答です');

  var fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) raw = fenced[1].trim();

  var start = raw.indexOf('{');
  var end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('JSON が見つかりません: ' + raw.slice(0, 200));
  }

  return JSON.parse(raw.slice(start, end + 1));
}

function callClaudeForMetricsExtraction_(monthlyPdf, analysisPdf, shopName, targetYm) {
  var apiKey = getAnthropicApiKey_();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY が未設定です');
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
    text: buildMetricsExtractionPrompt_(shopName, targetYm),
  });

  var payload = {
    model: getAnthropicModel_(),
    max_tokens: 1024,
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
  var text = (json.content || [])
    .filter(function (p) {
      return p.type === 'text';
    })
    .map(function (p) {
      return p.text;
    })
    .join('\n')
    .trim();

  return parseMetricsJsonFromClaude_(text);
}

function metricsJsonToKpiRecord_(targetYm, shop, metrics) {
  metrics = metrics || {};
  var record = {
    targetYm: targetYm,
    kintoneShopName: shop.kintoneShopName,
    shopName: shop.name,
    sales: parseKpiNumber_(metrics['実売上']),
    visitors: parseKpiNumber_(metrics['来客数']),
    unitPrice: parseKpiNumber_(metrics['客単価']),
    bedUtilization: parseKpiNumber_(metrics['ベッド稼働率']),
    bedUtilizationUnits: parseKpiNumber_(metrics['ベッド稼働台数']),
    missedAppointments: parseKpiNumber_(metrics['取りこぼし件数']),
    newVisitors: parseKpiNumber_(metrics['新規来客数']),
    newRepeatRatio: parseKpiNumber_(metrics['新規リピート比率']),
    breakEven: parseKpiNumber_(metrics['損益分岐点']),
    priorityTheme: '',
  };
  record.priorityTheme = inferPriorityTheme_(record);
  return { record: record, rawMetrics: metrics };
}

/**
 * 1店舗×1ヶ月の KPI を PDF から抽出して保存
 * @param {Object} options skipIfExists: 既存行があればスキップ
 */
function extractKpiFromPdfsForShop_(targetYm, kintoneShopName, options) {
  options = options || {};
  var shop = findShopByKintoneName_(kintoneShopName);
  if (!shop) throw new Error('店舗が見つかりません: ' + kintoneShopName);

  if (options.skipIfExists) {
    var existing = loadKpiRecord_(targetYm, kintoneShopName);
    if (existing && existing.sales != null) {
      return { status: 'skipped', reason: 'KPI既存', record: existing };
    }
  }

  var record = linkSupervisingPdfsFromStore_(targetYm, kintoneShopName);
  if (!record) {
    return { status: 'pending', reason: 'PDF未揃い' };
  }

  var monthlyPdf = readPdfFromDriveId_(record.monthlyPdfId, '月次レポート');
  var analysisPdf = readPdfFromDriveId_(record.analysisPdfId, '顧客分析');
  if (!monthlyPdf || !analysisPdf) {
    return { status: 'pending', reason: 'PDF読込失敗' };
  }

  var metrics = callClaudeForMetricsExtraction_(
    monthlyPdf,
    analysisPdf,
    shop.name,
    targetYm
  );
  var mapped = metricsJsonToKpiRecord_(targetYm, shop, metrics);
  var saved = saveKpiRecord_(mapped.record);
  saveReportMetricsExtras_(targetYm, kintoneShopName, shop.name, mapped.rawMetrics);

  return { status: 'ok', record: saved, rawMetrics: mapped.rawMetrics };
}

function getMetricsState_() {
  var raw = PropertiesService.getScriptProperties().getProperty(METRICS_STATE_KEY_);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function setMetricsState_(state) {
  PropertiesService.getScriptProperties().setProperty(
    METRICS_STATE_KEY_,
    JSON.stringify(state)
  );
}

function clearMetricsState_() {
  PropertiesService.getScriptProperties().deleteProperty(METRICS_STATE_KEY_);
}

function clearMetricsContinuationTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'continueMonthlyMetrics_') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function scheduleMetricsContinuation_() {
  clearMetricsContinuationTriggers_();
  ScriptApp.newTrigger('continueMonthlyMetrics_')
    .timeBased()
    .after(2 * 60 * 1000)
    .create();
}

/**
 * 対象月の店舗をバッチ処理（PDF揃い店舗のみ）
 */
function processMetricsBatchForYm_(targetYm, offset, options) {
  options = options || {};
  var cfg = getConfig_();
  var batchSize = options.batchSize || cfg.DELIVERY_BATCH_SIZE || 3;
  var shops = loadDeliveryTargetShops_(targetYm);

  var summary = {
    targetYm: targetYm,
    offset: offset,
    total: shops.length,
    processed: 0,
    ok: 0,
    skipped: 0,
    pending: 0,
    errors: [],
  };

  var slice = shops.slice(offset, offset + batchSize);
  slice.forEach(function (shop) {
    summary.processed += 1;
    try {
      var result = extractKpiFromPdfsForShop_(targetYm, shop.kintoneShopName, {
        skipIfExists: options.skipIfExists !== false,
      });
      if (result.status === 'ok') summary.ok += 1;
      else if (result.status === 'skipped') summary.skipped += 1;
      else if (result.status === 'pending') summary.pending += 1;
      else summary.errors.push(shop.kintoneShopName + ': ' + (result.reason || result.status));
    } catch (e) {
      summary.errors.push(shop.kintoneShopName + ': ' + String(e));
    }
  });

  var nextOffset = offset + slice.length;
  var hasMore = nextOffset < shops.length;

  if (hasMore) {
    setMetricsState_({
      targetYm: targetYm,
      offset: nextOffset,
      startedAt: new Date().toISOString(),
    });
    scheduleMetricsContinuation_();
  } else {
    clearMetricsState_();
    clearMetricsContinuationTriggers_();
    if (options.syncBot !== false) {
      try {
        summary.botSync = syncReportMetricsToBot_();
      } catch (e) {
        summary.botSyncError = String(e);
      }
    }
    if (options.sendHqSummary !== false) {
      var target = buildTargetMeta_(targetYm);
      sendHqAlert_(
        target.label + ' KPI抽出完了',
        [
          '対象店舗: ' + shops.length,
          '抽出成功: ' + summary.ok,
          'スキップ（既存）: ' + summary.skipped,
          'PDF未揃い: ' + summary.pending,
          summary.errors.length
            ? '【エラー】\n' + summary.errors.join('\n')
            : 'エラー: なし',
          summary.botSync
            ? 'Bot同期: ' + summary.botSync.written + '行'
            : summary.botSyncError
              ? 'Bot同期エラー: ' + summary.botSyncError
              : '',
        ].join('\n')
      );
    }
  }

  summary.nextOffset = nextOffset;
  summary.hasMore = hasMore;
  return summary;
}

/** 毎月5日配信パイプラインから呼ぶ（安全モードでも実行可） */
function runMonthlyMetricsPipeline_(targetYm, options) {
  options = options || {};
  clearMetricsState_();
  clearMetricsContinuationTriggers_();
  return processMetricsBatchForYm_(targetYm, 0, options);
}

function continueMonthlyMetrics_() {
  var state = getMetricsState_();
  if (!state || !state.targetYm) return;
  clearMetricsContinuationTriggers_();
  processMetricsBatchForYm_(state.targetYm, state.offset || 0, {
    sendHqSummary: true,
    syncBot: true,
  });
}

/** メニュー: 前月分を全店舗抽出 */
function runMonthlyMetricsExtraction() {
  var target = getTargetYearMonth_();
  return runMonthlyMetricsPipeline_(target.yyyyMM, { sendHqSummary: true, syncBot: true });
}

/** メニュー: 岩出店のみ強制再抽出（テスト用） */
function testExtractMetricsIwade() {
  var target = getTargetYearMonth_();
  var result = extractKpiFromPdfsForShop_(target.yyyyMM, '岩出店', {
    skipIfExists: false,
  });
  Logger.log(JSON.stringify(result, null, 2));
  try {
    SpreadsheetApp.getUi().alert(
      '岩出店 ' +
        target.label +
        '\n結果: ' +
        result.status +
        (result.reason ? '\n' + result.reason : '')
    );
  } catch (e) {
    Logger.log(String(result));
  }
  return result;
}
