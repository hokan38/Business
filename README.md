# MarkGate株式会社 コーポレートサイト

ハイクラス層の求職者向けに、各人材紹介エージェントの「トップキャリアアドバイザー」だけが
登録できる転職プラットフォーム事業「MarkGate（マークゲート）」のコーポレートサイトです。

## コンセプト

> **トップアドバイザーだけが、開ける扉。**

- **トップアドバイザー限定（審査制）** — 各エージェントの実績上位アドバイザーのみが登録
- **ハイクラス・エグゼクティブ特化** — 経営幹部・管理職・高度専門職
- **アドバイザーを“選べる”** — 求職者が実績・専門領域を見て指名できる

## 構成

```
.
├── index.html              # トップページ（1ページ完結 / セクション構成）
├── media/                  # オウンドメディア「THE GATE JOURNAL／門記」
│   ├── index.html          # ジャーナル トップ（記事一覧）
│   ├── advisor-gacha.html          # 記事①（ピラー）担当者の当たり外れ
│   ├── spot-great-advisor.html     # 記事② アドバイザーの見分け方
│   ├── market-value-highclass.html # 記事③ 市場価値
│   ├── salary-negotiation.html     # 記事④ 年収交渉
│   └── resume-management.html      # 記事⑤ 職務経歴書
├── templates/
│   └── article-template.html   # 記事のひな型（noindex・非公開・sitemap除外）
├── assets/
│   ├── css/style.css       # デザインシステム（Deep Navy × Gold / 明朝体見出し）
│   ├── css/article.css     # 記事・メディア用スタイル（style.css のトークンを共有）
│   ├── js/main.js          # トップページ用：ナビ・スクロール演出・カウンター・フォーム
│   ├── js/article.js       # 記事ページ用：ヘッダー状態・モバイルナビのみ（軽量）
│   └── img/media/          # OG画像（1200×630）
├── sitemap.xml             # サイトマップ（手動更新）
├── robots.txt
├── 404.html                # ブランド 404
├── vercel.json             # 静的ホスティング設定（Vercel / cleanUrls）
└── README.md
```

### 掲載セクション
1. ヒーロー（キャッチコピー / 2種CTA）
2. コンセプト
3. なぜMarkGateか（従来の人材紹介との比較）
4. 3つの強み
5. 求職者の方へ
6. アドバイザーの方へ
7. ご利用の流れ（4ステップ）
8. 数値で見るMarkGate（コンセプト値）
9. 会社概要
10. お問い合わせフォーム

## デザイン

- **配色**：ディープネイビー `#0A0E1A` × ゴールド `#C6A15B`（ハイクラス／高級感）
- **書体**：見出し＝Shippori Mincho（明朝）、本文＝Noto Sans JP、装飾＝Cormorant Garamond
- レスポンシブ対応、スクロールに応じたフェードイン、アクセシビリティ（reduced-motion）配慮

> デザインは初期案です。配色・トーン・レイアウトは調整可能です。

## オウンドメディア「THE GATE JOURNAL／門記」

求職者（ハイクラス層）の自然検索からの集客を目的とした SEO オウンドメディアです。
タグライン **「開ける前に、知っておくべきこと。」**。`/media` に配置。

- **記事ページは `main.js` を読み込まず、軽量な `article.js` のみ**（ヘッダー状態＋モバイルナビ）。本文は JS 無効でも可視。
- **記事の chrome（ヘッダー・フッター・ロゴ）のリンクはすべて root-absolute**（`/`, `/#…`, `/media`）。トップの `#anchor` を流用すると `/media/*` 上で死にリンクになるため。
- 各記事に `<title>` / description / canonical / OGP / Twitter / JSON-LD（Article＋BreadcrumbList）を付与。著者は **「MarkGate編集部」**、公開日は実日付。会社が準備中のため各記事末尾に **情報提供目的の注記** を表示。
- 本文リンクはゴールド文字にせず ink＋ゴールド下線（コントラスト AA 確保）。

### 本番ドメインについて（要置換）

canonical / OGP / sitemap / robots は暫定で `https://markgate.co.jp` を使用しています。
公開前に実ドメインへ一括置換してください。

```bash
grep -rl "markgate.co.jp" . --include=*.html --include=*.xml --include=*.txt
```

### 記事を1本追加する手順（5ステップ）

1. `templates/article-template.html` を `media/<slug>.html` にコピーし、先頭の `noindex` 行を削除
2. `{{…}}` プレースホルダを置換し、本文（INSIGHT セクション）を執筆
3. `media/index.html` の一覧に `.article-card` を1枚追加
4. `sitemap.xml` に `<url>` を1行追加
5. OG画像 `assets/img/media/og-<slug>.png` を生成（1200×630）

> 整合ガード：**slug ＝ ファイル名 ＝ canonical ＝ sitemap の loc ＝ カードの href**。
> URL には `.html` や末尾スラッシュを付けないこと（cleanUrls によりリダイレクトが発生し評価が分散します）。

## ローカルでの確認

ビルド不要の静的サイトです。任意のHTTPサーバで開けます。

```bash
# 例：Python
python3 -m http.server 8000
# → http://localhost:8000

# 例：Node
npx serve .
```

## デプロイ

`vercel.json` を同梱しているため、Vercel にそのまま静的サイトとしてデプロイできます。
（GitHub Pages / Netlify / S3 など任意の静的ホスティングでも動作します）

## 今後の差し込み項目（要確定）

- 会社概要の「設立 / 代表者 / 所在地 / 資本金 / 許可番号」
- お問い合わせフォームの送信先（現状はフロントのデモ実装）
- 実績数値、ロゴ・キービジュアルの差し替え
