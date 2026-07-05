# X 自動投稿ツール

`docs/sns-posts-x.md` の投稿ストックを、X API（従量課金）経由で自動投稿するためのツールです。
依存パッケージなし（Node.js 標準機能のみ）で動作します。

## 前提: X API のセットアップ（アカウント所有者が行うこと）

> 2026年2月6日以降、X APIの無料枠は廃止され、新規は従量課金（Pay-Per-Use）のみです。
> 新規登録時に $10 分の無料クレジットが付与されます。投稿作成は1件あたり約$0.01。
> 週5本運用（月約22本）なら月額 約$0.25 ＝ 無料クレジットだけで数年分に相当します。

1. [developer.x.com](https://developer.x.com) に **MarkGate代表アカウントで** サインアップ（従量課金プラン）
2. Project と App を作成
3. App の **User authentication settings** を設定:
   - App permissions: **Read and write**
   - Type of App: Web App / Automated App or bot
   - Callback URL / Website URL: コーポレートサイトのURLでよい
4. **Keys and tokens** タブで以下の4つを取得:
   - API Key / API Key Secret（Consumer Keys）
   - Access Token / Access Token Secret（**権限を Read and write に変更した後に再生成すること**）
5. 取得した4つの値を **Claude Code の環境設定 → 環境変数** に登録（チャットに貼らない）:
   - `X_API_KEY`
   - `X_API_SECRET`
   - `X_ACCESS_TOKEN`
   - `X_ACCESS_TOKEN_SECRET`
6. 同じく環境設定の **ネットワークポリシー** で `api.x.com` への接続を許可する

## 使い方

```bash
# 接続テスト（投稿しない）
node tools/x/post.mjs --text "テスト" --dry-run

# 単発投稿
node tools/x/post.mjs --text "投稿本文"

# キューの先頭（status: pending の最初の1件）を投稿
node tools/x/post.mjs --queue tools/x/queue.jsonl
```

## キュー形式（queue.jsonl）

1行1投稿のJSON。`queue.example.jsonl` を `queue.jsonl` にコピーして使う。

```json
{"id":"X-001","status":"pending","text":"投稿本文"}
```

投稿されると `status` が `posted` になり、`posted_at` と `tweet_id` が追記される。

## 運用設計（SNS戦略書 §6・§12 準拠）

- 週1回、`docs/sns-posts-x.md` から翌週分5本を選んでキューに積む（作成者≠承認者の原則: キュー積み＝承認行為）
- 毎日1回の定時ルーティンがキュー先頭の1件を投稿する
- 投稿前チェックリスト（戦略書 §12-2）を通過した本文のみキューに入れること
- リプライ・DMはこのツールでは扱わない（人が承認して手動送信する）

## 費用の注意

- 情報源によっては「リンクを含む投稿は1件$0.20」との記載があります。戦略上、本文にURLを入れない設計
  （リンクはプロフィールと固定ポストに集約）のため通常運用では影響しませんが、リンク付き投稿を
  流す場合はコストが上がる可能性を念頭に置いてください。
