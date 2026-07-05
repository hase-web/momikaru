/**
 * LINE Push / Google Chat 投稿（本部サポート連携 GAS と同じ API パターン）
 *
 * Script Properties:
 *   LINE_CHANNEL_ACCESS_TOKEN — LINE Messaging API
 *   CHAT_WEBHOOK_URL          — Google Chat Incoming Webhook（本部スペース用・任意）
 */

var LINE_MAX_TEXT_LEN_ = 4500;
var LINE_MAX_MESSAGES_PER_PUSH_ = 5;

function getLineChannelAccessToken_() {
  return PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
}

function getChatWebhookUrl_() {
  return PropertiesService.getScriptProperties().getProperty('CHAT_WEBHOOK_URL');
}

function splitTextForLine_(text, maxLen) {
  maxLen = maxLen || LINE_MAX_TEXT_LEN_;
  text = String(text || '');
  if (text.length <= maxLen) return [text];

  var chunks = [];
  var rest = text;
  while (rest.length > maxLen) {
    var cut = rest.lastIndexOf('\n', maxLen);
    if (cut < maxLen * 0.5) cut = maxLen;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, '');
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/**
 * LINE へ push（長文は分割して最大5件ずつ送信）
 */
function pushLineMessages_(lineUserId, text) {
  var token = getLineChannelAccessToken_();
  if (!token) {
    throw new Error(
      'LINE_CHANNEL_ACCESS_TOKEN が未設定です（Apps Script → スクリプトプロパティ）'
    );
  }

  var chunks = splitTextForLine_(text);
  var allMessages = chunks.map(function (chunk) {
    return { type: 'text', text: chunk };
  });

  for (var i = 0; i < allMessages.length; i += LINE_MAX_MESSAGES_PER_PUSH_) {
    var batch = allMessages.slice(i, i + LINE_MAX_MESSAGES_PER_PUSH_);
    var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ to: lineUserId, messages: batch }),
      muteHttpExceptions: true,
    });

    if (res.getResponseCode() !== 200) {
      throw new Error('LINE push 失敗 (' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 300));
    }
  }
}

/**
 * Google Chat スペースへ投稿（既存サポート連携と同じ Webhook 形式）
 * @return {string|null} thread.name
 */
function postChatOutbound_(text, threadKey) {
  var webhookUrl = getChatWebhookUrl_();
  if (!webhookUrl) return null;

  var url =
    webhookUrl + (webhookUrl.indexOf('?') >= 0 ? '&' : '?') +
    'messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD';
  var payload = {
    text: text,
    thread: { threadKey: String(threadKey) },
  };

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() !== 200) {
    Logger.log('Chat post failed: ' + res.getResponseCode() + ' / ' + res.getContentText());
    return null;
  }

  try {
    var json = JSON.parse(res.getContentText());
    var threadName = json.thread ? json.thread.name : null;
    if (threadName) upsertLineThreadRecord_(threadKey, threadName);
    return threadName;
  } catch (e) {
    return null;
  }
}

/** threads シートがあれば lineUserId ↔ threadName を保存 */
function upsertLineThreadRecord_(lineUserId, threadName) {
  var cfg = getConfig_();
  var ss = getLineLinkSpreadsheet_();
  var sheet = ss.getSheetByName(cfg.LINE_THREADS_SHEET_NAME || 'threads');
  if (!sheet) return;

  var values = sheet.getDataRange().getValues();
  var now = new Date();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === String(lineUserId)) {
      sheet.getRange(i + 1, 2).setValue(threadName);
      sheet.getRange(i + 1, 3).setValue(now);
      return;
    }
  }
  sheet.appendRow([lineUserId, threadName, now]);
}

/**
 * 店舗オーナーへ LINE +（任意）Chat 投稿
 * @return {{lineSent:number, chatPosted:boolean}}
 */
function deliverLineAndChat_(lineUserIds, chatPrefix, body) {
  var result = { lineSent: 0, chatPosted: false };
  var unique = [];
  (lineUserIds || []).forEach(function (id) {
    if (id && unique.indexOf(id) < 0) unique.push(id);
  });

  unique.forEach(function (lineUserId) {
    pushLineMessages_(lineUserId, body);
    result.lineSent += 1;

    if (getChatWebhookUrl_()) {
      var chatText = (chatPrefix || '') + body;
      if (postChatOutbound_(chatText, lineUserId)) {
        result.chatPosted = true;
      }
    }
  });

  return result;
}

function testLinePush(lineUserId, text) {
  pushLineMessages_(lineUserId, text || 'もみかるFC 月次配信テスト');
}
