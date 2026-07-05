#!/usr/bin/env node
// X (Twitter) API v2 投稿スクリプト（依存パッケージなし・OAuth 1.0a User Context）
//
// 使い方:
//   node tools/x/post.mjs --text "投稿本文"            # 単発投稿
//   node tools/x/post.mjs --queue tools/x/queue.jsonl  # キュー先頭の pending を1件投稿
//   いずれも --dry-run を付けると署名検証のみ行い、実際には投稿しない
//
// 必要な環境変数（Claude Code 環境設定に登録すること。チャットやリポジトリに書かない）:
//   X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET
//   （X Developer Portal のアプリ設定で App permissions を Read and write にした上で発行したもの）

import crypto from 'node:crypto';
import fs from 'node:fs';

const ENDPOINT = 'https://api.x.com/2/tweets';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`環境変数 ${name} が未設定です。Claude Code の環境設定に登録してください。`);
    process.exit(1);
  }
  return v;
}

// RFC 3986 percent-encode
const enc = (s) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

function oauthHeader(method, url, creds) {
  const p = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };
  // JSONボディは署名ベース文字列に含めない（OAuth 1.0a 仕様）
  const paramString = Object.keys(p)
    .sort()
    .map((k) => `${enc(k)}=${enc(p[k])}`)
    .join('&');
  const base = [method.toUpperCase(), enc(url), enc(paramString)].join('&');
  const signingKey = `${enc(creds.apiSecret)}&${enc(creds.accessSecret)}`;
  p.oauth_signature = crypto.createHmac('sha1', signingKey).update(base).digest('base64');
  const header =
    'OAuth ' +
    Object.keys(p)
      .sort()
      .map((k) => `${enc(k)}="${enc(p[k])}"`)
      .join(', ');
  return header;
}

async function postTweet(text, { dryRun }) {
  if (!text || !text.trim()) throw new Error('本文が空です');
  const creds = {
    apiKey: requireEnv('X_API_KEY'),
    apiSecret: requireEnv('X_API_SECRET'),
    accessToken: requireEnv('X_ACCESS_TOKEN'),
    accessSecret: requireEnv('X_ACCESS_TOKEN_SECRET'),
  };
  const auth = oauthHeader('POST', ENDPOINT, creds);
  if (dryRun) {
    console.log('[dry-run] 署名生成OK。以下の本文を投稿します（実行時）:\n---\n' + text + '\n---');
    return null;
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`投稿失敗 HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  return body; // { data: { id, text } }
}

function fromQueue(queuePath, { dryRun }) {
  const lines = fs.readFileSync(queuePath, 'utf8').split('\n').filter((l) => l.trim());
  const entries = lines.map((l) => JSON.parse(l));
  const next = entries.find((e) => e.status === 'pending');
  if (!next) {
    console.log('キューに pending の投稿がありません。');
    return;
  }
  return postTweet(next.text, { dryRun }).then((result) => {
    if (dryRun) return;
    next.status = 'posted';
    next.posted_at = new Date().toISOString();
    next.tweet_id = result?.data?.id ?? null;
    fs.writeFileSync(queuePath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
    console.log(`投稿完了: ${next.id ?? '(no id)'} → tweet_id=${next.tweet_id}`);
  });
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const textIdx = args.indexOf('--text');
const queueIdx = args.indexOf('--queue');

try {
  if (textIdx !== -1) {
    const result = await postTweet(args[textIdx + 1], { dryRun });
    if (result) console.log(`投稿完了: tweet_id=${result.data.id}`);
  } else if (queueIdx !== -1) {
    await fromQueue(args[queueIdx + 1], { dryRun });
  } else {
    console.log('使い方: post.mjs --text "本文" | --queue <file.jsonl> [--dry-run]');
    process.exit(1);
  }
} catch (e) {
  console.error(String(e.message ?? e));
  process.exit(1);
}
