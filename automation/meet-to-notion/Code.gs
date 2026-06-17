/**
 * Google Meet → Notion (DB_Meeting) 自動連携
 * ---------------------------------------------------------------------------
 * 起点: Google Meet 完了後、Drive の「Meet Recordings」フォルダに
 *       Gemini 要約Doc（と録画mp4）が自動保存される ＝ これを検知点にする。
 *
 * 動作: 時間主導トリガー（既定10分毎）でフォルダを走査し、未処理の会議ごとに
 *       Notion の DB_Meeting に1行を作成して以下を埋める。
 *         - 会議名 / 開催日時 / 参加者 / プロジェクト(リレーション)
 *         - ファイル&メディア: 要約Docを.docxで実体アップロード ＋ 録画はDriveリンク
 *         - 本文: 概要・ネクストアクション・関連ファイル等の要約
 *
 * 必要な設定は «プロジェクトの設定 → スクリプト プロパティ»（README参照）。
 * ---------------------------------------------------------------------------
 */

// ===== 設定（スクリプト プロパティから読み込む） ============================
function CFG() {
  var p = PropertiesService.getScriptProperties();
  return {
    NOTION_TOKEN:    p.getProperty('NOTION_TOKEN'),                  // 必須: Notion内部インテグレーションのトークン
    NOTION_VERSION:  p.getProperty('NOTION_VERSION') || '2022-06-28',
    MEETING_DB_ID:   p.getProperty('MEETING_DB_ID')   || '1c955e9d58d68392aa61810b26f2e130', // DB_Meeting
    PROJECT_DB_ID:   p.getProperty('PROJECT_DB_ID')   || '37d55e9d58d680fb8beef32e8d4e22c4', // DB_Project
    FOLDER_ID:       p.getProperty('FOLDER_ID')       || '1GRWj_BqR6KrwDvAHxTHR36kaCBHBxI29', // Meet Recordings
    LOOKBACK_DAYS:   Number(p.getProperty('LOOKBACK_DAYS') || '7'),  // 初回/未処理判定の遡及日数
    PROJECT_KEYWORDS: safeJson_(p.getProperty('PROJECT_KEYWORDS'), {}) // 任意: {"プロジェクト名":["キーワード",...]}
  };
}

// DB_Meeting のプロパティ名（Notion側の列名と一致させる）
var PROP = {
  title:    '会議名',
  date:     '開催日時',
  people:   '参加者',
  project:  'プロジェクト',
  files:    'ファイル&メディア'
};

// ===== セットアップ用ユーティリティ ========================================

/** 初期セットアップ: 設定検証＋プロジェクト/ユーザー一覧の表示＋トリガー設置 */
function setup() {
  var c = CFG();
  if (!c.NOTION_TOKEN) throw new Error('NOTION_TOKEN が未設定です。スクリプト プロパティに設定してください。');
  Logger.log('--- Notion ユーザー（参加者マッピングに使用）---');
  var users = getNotionUsersByEmail_();
  Object.keys(users).forEach(function (email) { Logger.log(email + ' => ' + users[email]); });
  Logger.log('--- DB_Project の既存プロジェクト（プロジェクト紐付けに使用）---');
  getNotionProjects_().forEach(function (pr) { Logger.log(pr.name + ' => ' + pr.id); });
  installTrigger_();
  Logger.log('セットアップ完了。10分毎トリガーを設置しました。');
}

/** 10分毎の時間主導トリガーを（重複なく）設置 */
function installTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processNewMeetings') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processNewMeetings').timeBased().everyMinutes(10).create();
}

/** 手動実行用（トリガーと同じ処理を即時実行） */
function runOnce() { processNewMeetings(); }

/** 処理済みフラグをリセットしたい場合に使用（再取り込み用） */
function resetState() {
  PropertiesService.getScriptProperties().deleteProperty('PROCESSED_DOC_IDS');
  Logger.log('PROCESSED_DOC_IDS をクリアしました。');
}

// ===== メイン処理 ===========================================================

function processNewMeetings() {
  var c = CFG();
  if (!c.NOTION_TOKEN) { Logger.log('NOTION_TOKEN 未設定のため中断'); return; }

  var processed = safeJson_(PropertiesService.getScriptProperties().getProperty('PROCESSED_DOC_IDS'), []);
  var since = new Date(Date.now() - c.LOOKBACK_DAYS * 24 * 3600 * 1000);

  var memos = findNewMemoDocs_(c.FOLDER_ID, since, processed);
  if (!memos.length) { Logger.log('新規の会議メモはありません。'); return; }
  Logger.log('処理対象の会議メモ: ' + memos.length + ' 件');

  var users = getNotionUsersByEmail_();
  var projects = getNotionProjects_();

  memos.forEach(function (memo) {
    try {
      handleMeeting_(memo, users, projects);
      processed.push(memo.id);
    } catch (e) {
      Logger.log('[ERROR] ' + memo.name + ' の処理に失敗: ' + e);
    }
  });

  // 処理済みリストは直近300件だけ保持
  if (processed.length > 300) processed = processed.slice(processed.length - 300);
  PropertiesService.getScriptProperties().setProperty('PROCESSED_DOC_IDS', JSON.stringify(processed));
}

/** 1会議分の取り込み */
function handleMeeting_(memo, users, projects) {
  Logger.log('▶ 処理: ' + memo.name + ' (' + memo.stamp + ')');

  // 1) メモDocを解析（概要・ネクストアクション・参加者メール）
  var parsed = parseMemoDoc_(memo.id);

  // 2) 同フォルダ内の録画mp4を、同じタイムスタンプ文字列で突き合わせ
  var recording = findRecordingForMeeting_(memo.folderId, memo.approxStart, memo.created);

  // 3) Calendar から正確な開催日時・参加者メールを取得（無ければメモの値で代替）
  var cal = getCalendarInfo_(memo.name, memo.approxStart);
  var start = cal ? cal.start : memo.approxStart;
  var end   = cal ? cal.end   : new Date(memo.approxStart.getTime() + 3600 * 1000);
  var emails = (cal && cal.emails.length) ? cal.emails : parsed.attendeeEmails;

  // 4) 重複ガード（同名＋同日が既にあればスキップ）
  if (existsMeeting_(memo.name, start)) { Logger.log('  既にNotionに存在するためスキップ'); return; }

  // 5) 参加者を Notion ユーザーへマッピング（未登録は本文へ）
  var peopleIds = [], unmatched = [];
  emails.forEach(function (em) {
    var id = users[em.toLowerCase()];
    if (id) { if (peopleIds.indexOf(id) < 0) peopleIds.push(id); }
    else { unmatched.push(em); }
  });

  // 6) プロジェクト紐付け（キーワード一致でスコアリング）
  var haystack = memo.name + '\n' + parsed.summary.join('\n');
  var projectId = matchProject_(haystack, projects, CFG().PROJECT_KEYWORDS);

  // 7) ファイル: 要約Docは.docxで実体アップロード、録画はDriveリンク
  var fileItems = [];
  try {
    var blob = exportDocAsDocx_(memo.id, memo.name);
    var uploadId = uploadFileToNotion_(blob, sanitize_(memo.name) + '.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    fileItems.push({ type: 'file_upload', name: sanitize_(memo.name) + '.docx', file_upload: { id: uploadId } });
  } catch (e) {
    Logger.log('  要約のアップロードに失敗（Docリンクで代替）: ' + e);
    fileItems.push({ type: 'external', name: 'Gemini によるメモ', external: { url: memo.url } });
  }
  if (recording) {
    fileItems.push({ type: 'external', name: '録画', external: { url: recording.url } });
  }

  // 8) Notion ページ作成
  var props = {};
  props[PROP.title]  = { title: [ txt_(memo.name) ] };
  props[PROP.date]   = { date: { start: rfc3339_(start), end: rfc3339_(end) } };
  if (peopleIds.length) props[PROP.people]  = { people: peopleIds.map(function (id) { return { id: id }; }) };
  if (projectId)        props[PROP.project] = { relation: [ { id: projectId } ] };
  if (fileItems.length) props[PROP.files]   = { files: fileItems };

  var children = buildChildren_(parsed, memo, recording, unmatched, start);

  var page = notionFetch_('post', '/v1/pages', {
    parent: { database_id: CFG().MEETING_DB_ID },
    icon: { type: 'emoji', emoji: '📝' },
    properties: props,
    children: children
  });
  Logger.log('  ✔ 作成: ' + (page.url || page.id));
}

// ===== Drive / Docs / Calendar =============================================

/** Meet Recordings フォルダから未処理の Gemini 要約Doc を新しい順に取得 */
function findNewMemoDocs_(folderId, since, processed) {
  var folder = DriveApp.getFolderById(folderId);
  var it = folder.getFiles();
  var out = [];
  while (it.hasNext()) {
    var f = it.next();
    if (f.getMimeType() !== 'application/vnd.google-apps.document') continue;
    var name = f.getName();
    if (name.indexOf('Gemini によるメモ') < 0) continue;          // 要約Docのみ
    if (f.getDateCreated() < since) continue;                      // 遡及範囲外
    if (processed.indexOf(f.getId()) >= 0) continue;               // 処理済み
    var meta = parseTitle_(name);
    if (!meta) continue;
    out.push({
      id: f.getId(), url: f.getUrl(), folderId: folderId,
      name: meta.name, stamp: meta.stamp, approxStart: meta.start,
      created: f.getDateCreated()
    });
  }
  out.sort(function (a, b) { return a.created - b.created; });     // 古い→新しい
  return out;
}

/**
 * 要約Docのタイトルを解析。次の2形式に対応する。
 *   A) "{会議名} - YYYY/MM/DD HH:MM JST - Gemini によるメモ"（カレンダー予定あり）
 *   B) "YYYY/MM/DD HH:MM JST に開始した会議 - Gemini によるメモ"（予定なしの即席会議）
 */
function parseTitle_(title) {
  var label = title.replace(/\s*-\s*Gemini によるメモ\s*$/, '').trim();
  var dm = label.match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})\s*JST/);
  if (!dm) return null;
  var start = new Date(Date.UTC(+dm[1], +dm[2] - 1, +dm[3], +dm[4] - 9, +dm[5], 0));
  var stamp = dm[1] + '/' + dm[2] + '/' + dm[3] + ' ' + dm[4] + ':' + dm[5] + ' JST';
  // "{name} - {date} JST" 形式なら name 部分、そうでなければ label 全体を会議名にする
  var nm = label.match(/^(.+?)\s-\s\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}\s*JST\s*$/);
  var name = nm ? nm[1].trim() : label.trim();
  return { name: name, stamp: stamp, start: start };
}

/**
 * 会議の録画mp4を探す。タイトル内の日時（"YYYY/MM/DD HH:MM" / "YYYY-MM-DD HH:MM"）が
 * 会議開始時刻に最も近いものを採用（読めない場合はメモ作成時刻との近さで判定）。
 * いずれも前後3時間以内のものだけを採用する。
 */
function findRecordingForMeeting_(folderId, approxStart, memoCreated) {
  var it = DriveApp.getFolderById(folderId).getFiles();
  var best = null, bestDiff = Infinity;
  while (it.hasNext()) {
    var f = it.next();
    if (f.getMimeType() !== 'video/mp4') continue;
    var dt = parseFlexibleDateTime_(f.getName());
    var diff = dt ? Math.abs(dt.getTime() - approxStart.getTime())
                  : Math.abs(f.getDateCreated().getTime() - memoCreated.getTime());
    if (diff < bestDiff) { bestDiff = diff; best = f; }
  }
  if (best && bestDiff <= 3 * 3600 * 1000) return { id: best.getId(), url: best.getUrl(), name: best.getName() };
  return null;
}

/** "YYYY/MM/DD HH:MM" または "YYYY-MM-DD HH:MM"（JST=GMT+9前提）を Date に変換 */
function parseFlexibleDateTime_(s) {
  var m = String(s).match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})\s+(\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 9, +m[5], 0));
}

/** 要約Docを.docxバイナリとしてエクスポート */
function exportDocAsDocx_(docId, name) {
  var url = 'https://www.googleapis.com/drive/v3/files/' + docId +
    '/export?mimeType=' + encodeURIComponent('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  var resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() >= 300) throw new Error('Doc export failed: ' + resp.getResponseCode());
  return resp.getBlob().setName(sanitize_(name) + '.docx');
}

/** メモDocを解析して 概要・ネクストアクション・参加者メールを抽出 */
function parseMemoDoc_(docId) {
  var body = DocumentApp.openById(docId).getBody();
  var paras = body.getParagraphs();
  var section = '', data = { summary: [], nextSteps: [], attendeeEmails: [] };
  var emailRe = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;

  for (var i = 0; i < paras.length; i++) {
    var p = paras[i], text = p.getText().trim();
    if (!text) continue;
    var heading = p.getHeading();
    var isHeading = (heading === DocumentApp.ParagraphHeading.HEADING1 ||
                     heading === DocumentApp.ParagraphHeading.HEADING2 ||
                     heading === DocumentApp.ParagraphHeading.HEADING3);
    if (isHeading) {
      if (text === '概要') { section = 'summary'; continue; }
      if (text === '次のステップ') { section = 'nextSteps'; continue; }
      if (text === '詳細') { section = 'details'; continue; }
      if (text.indexOf('文字起こし') >= 0) { section = 'transcript'; continue; }
      section = '';                          // それ以外の見出しでセクション終了
      continue;
    }
    if (i < 10 && text.indexOf('招待済み') >= 0) {
      var mm = text.match(emailRe);
      if (mm) mm.forEach(function (e) { if (data.attendeeEmails.indexOf(e) < 0) data.attendeeEmails.push(e); });
    }
    if (section === 'summary') data.summary.push(text);
    else if (section === 'nextSteps') data.nextSteps.push(text);
  }
  return data;
}

/** Calendar から開催日時・参加者を取得（タイトル一致 → 時刻近接の順で照合） */
function getCalendarInfo_(name, approxStart) {
  var from = new Date(approxStart.getTime() - 12 * 3600 * 1000);
  var to   = new Date(approxStart.getTime() + 12 * 3600 * 1000);
  var events = CalendarApp.getDefaultCalendar().getEvents(from, to);
  var ev = null;
  for (var i = 0; i < events.length; i++) {
    if (events[i].getTitle().trim() === name.trim()) { ev = events[i]; break; }
  }
  if (!ev) {
    var best = null, bestDiff = Infinity;
    for (var j = 0; j < events.length; j++) {
      var d = Math.abs(events[j].getStartTime().getTime() - approxStart.getTime());
      if (d < bestDiff) { bestDiff = d; best = events[j]; }
    }
    if (best && bestDiff <= 5 * 60 * 1000) ev = best;  // 即席会議で無関係な予定を誤検出しないよう±5分に限定
  }
  if (!ev) return null;
  var emails = [];
  ev.getGuestList().forEach(function (g) { if (emails.indexOf(g.getEmail()) < 0) emails.push(g.getEmail()); });
  try { var me = Session.getEffectiveUser().getEmail(); if (me && emails.indexOf(me) < 0) emails.push(me); } catch (e) {}
  return { start: ev.getStartTime(), end: ev.getEndTime(), emails: emails };
}

// ===== Notion ===============================================================

/** email(小文字) → ユーザーID のマップ（person型のみ） */
function getNotionUsersByEmail_() {
  var map = {}, cursor = null;
  do {
    var q = cursor ? '?start_cursor=' + encodeURIComponent(cursor) + '&page_size=100' : '?page_size=100';
    var res = notionFetch_('get', '/v1/users' + q, null);
    (res.results || []).forEach(function (u) {
      if (u.type === 'person' && u.person && u.person.email) map[u.person.email.toLowerCase()] = u.id;
    });
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return map;
}

/** DB_Project の {id, name} 一覧 */
function getNotionProjects_() {
  var out = [], cursor = null;
  do {
    var body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    var res = notionFetch_('post', '/v1/databases/' + CFG().PROJECT_DB_ID + '/query', body);
    (res.results || []).forEach(function (pg) {
      var name = titleOf_(pg);
      if (name) out.push({ id: pg.id, name: name });
    });
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor);
  return out;
}

/** ページのタイトルプロパティをプレーンテキストで取り出す */
function titleOf_(page) {
  var props = page.properties || {};
  for (var k in props) {
    if (props[k] && props[k].type === 'title') {
      return (props[k].title || []).map(function (t) { return t.plain_text; }).join('').trim();
    }
  }
  return '';
}

/** 同名＋同日(JST)の会議が既に存在するか */
function existsMeeting_(name, start) {
  var res = notionFetch_('post', '/v1/databases/' + CFG().MEETING_DB_ID + '/query', {
    page_size: 25,
    filter: { property: PROP.title, title: { equals: name } }
  });
  var day = Utilities.formatDate(start, 'Asia/Tokyo', 'yyyy-MM-dd');
  return (res.results || []).some(function (pg) {
    var dp = pg.properties[PROP.date];
    if (dp && dp.date && dp.date.start) {
      return Utilities.formatDate(new Date(dp.date.start), 'Asia/Tokyo', 'yyyy-MM-dd') === day;
    }
    return false;
  });
}

/** キーワード一致スコアで最適なプロジェクトを選ぶ（無ければ null） */
function matchProject_(haystack, projects, keywordMap) {
  var best = null, bestScore = 0;
  projects.forEach(function (pr) {
    var kws = (keywordMap && keywordMap[pr.name] && keywordMap[pr.name].length) ? keywordMap[pr.name] : [pr.name];
    var score = 0;
    kws.forEach(function (kw) { if (kw && haystack.indexOf(kw) >= 0) score++; });
    if (score > bestScore) { bestScore = score; best = pr; }
  });
  if (best) Logger.log('  プロジェクト紐付け: ' + best.name + ' (score=' + bestScore + ')');
  return best ? best.id : null;
}

/** Notion へファイルをアップロードし file_upload id を返す */
function uploadFileToNotion_(blob, filename, contentType) {
  var c = CFG();
  var create = UrlFetchApp.fetch('https://api.notion.com/v1/file_uploads', {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + c.NOTION_TOKEN, 'Notion-Version': c.NOTION_VERSION },
    payload: JSON.stringify({ filename: filename, content_type: contentType }),
    muteHttpExceptions: true
  });
  if (create.getResponseCode() >= 300) throw new Error('file_upload create: ' + create.getContentText());
  var cj = JSON.parse(create.getContentText());

  var send = UrlFetchApp.fetch(cj.upload_url, {
    method: 'post',
    headers: { Authorization: 'Bearer ' + c.NOTION_TOKEN, 'Notion-Version': c.NOTION_VERSION },
    payload: { file: blob.setName(filename) },   // multipart/form-data は UrlFetchApp が自動構築
    muteHttpExceptions: true
  });
  if (send.getResponseCode() >= 300) throw new Error('file_upload send: ' + send.getContentText());
  return cj.id;
}

/** Notion REST 共通呼び出し */
function notionFetch_(method, path, body) {
  var c = CFG();
  var opt = {
    method: method, muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + c.NOTION_TOKEN, 'Notion-Version': c.NOTION_VERSION }
  };
  if (body) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(body); }
  var resp = UrlFetchApp.fetch('https://api.notion.com' + path, opt);
  var code = resp.getResponseCode();
  var json = JSON.parse(resp.getContentText() || '{}');
  if (code >= 300) throw new Error('Notion ' + method + ' ' + path + ' -> ' + code + ': ' + resp.getContentText());
  return json;
}

// ===== ページ本文（ブロック）の組み立て =====================================

function buildChildren_(parsed, memo, recording, unmatched, start) {
  var blocks = [];
  var dateStr = Utilities.formatDate(start, 'Asia/Tokyo', 'yyyy/MM/dd');

  // 出典コールアウト
  blocks.push(callout_([
    txt_('出典: Google Meet の文字起こし／'),
    link_('Gemini によるメモ', memo.url),
    txt_('（' + dateStr + ' 開催）')
  ], '📄'));

  // 概要
  if (parsed.summary.length) {
    blocks.push(h2_('概要'));
    parsed.summary.slice(0, 20).forEach(function (line) {
      chunk_(line, 1900).forEach(function (ck) { blocks.push(para_([txt_(ck)])); });
    });
  }

  // ネクストアクション（to-do）
  if (parsed.nextSteps.length) {
    blocks.push(h2_('ネクストアクション'));
    parsed.nextSteps.slice(0, 40).forEach(function (line) {
      blocks.push(todo_(line.substring(0, 1900)));
    });
  }

  // 関連ファイル
  blocks.push(h2_('関連ファイル'));
  blocks.push(bullet_([link_('Gemini によるメモ（要約＋文字起こし）', memo.url)]));
  if (recording) blocks.push(bullet_([link_('録画（Google Drive）', recording.url)]));
  else blocks.push(bullet_([txt_('録画: この回は録画なし（文字起こしのみ）')]));

  // Notion未登録の参加者
  if (unmatched && unmatched.length) {
    blocks.push(h2_('参加者（Notion未登録）'));
    blocks.push(para_([txt_('次の参加者は Notion ワークスペース未参加のため『参加者』列に登録できませんでした: ' + unmatched.join('、'))]));
  }

  return blocks.slice(0, 95); // children は最大100
}

// ===== 小物ヘルパー =========================================================

function txt_(s)        { return { type: 'text', text: { content: String(s) } }; }
function link_(s, url)  { return { type: 'text', text: { content: String(s), link: { url: url } } }; }
function para_(rt)      { return { object: 'block', type: 'paragraph', paragraph: { rich_text: rt } }; }
function h2_(s)         { return { object: 'block', type: 'heading_2', heading_2: { rich_text: [ txt_(s) ] } }; }
function todo_(s)       { return { object: 'block', type: 'to_do', to_do: { rich_text: [ txt_(s) ], checked: false } }; }
function bullet_(rt)    { return { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt } }; }
function callout_(rt, e){ return { object: 'block', type: 'callout', callout: { rich_text: rt, icon: { type: 'emoji', emoji: e } } }; }

function rfc3339_(date) { return Utilities.formatDate(date, 'Asia/Tokyo', "yyyy-MM-dd'T'HH:mm:ssXXX"); }
function sanitize_(s)   { return String(s).replace(/[\\/:*?"<>|]/g, '_').trim(); }
function safeJson_(s, d){ try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }
function chunk_(s, n)   { var out = [], t = String(s); for (var i = 0; i < t.length; i += n) out.push(t.substr(i, n)); return out.length ? out : ['']; }
