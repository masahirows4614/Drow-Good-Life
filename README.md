# AuroLIFE

自分の北極星へ、今日の一手。

Masa の仕事・学業・就活・生活をひとつにまとめる個人用Webアプリです。スマホ・PCのホーム画面に AuroLIFE のアイコンで置けます（PWA）。

| 画面 | 役割 |
|---|---|
| Now（いま） | 今日の三手、スペース切り替え、Day Arc、今日の予定、リズム |
| Moves（一手） | 次の行動を「今日／2週間以内／その先」に並べる |
| Polaris（北極星） | 悩みから自分の軸まで、AIと一緒にたどる |
| Spark（着火） | 過去の火種から、5〜15分の行動とタイマーを出す |
| Trace（足跡） | 日記と週の振り返り |
| Base（基地） | スペース・軸・火種・外観・アカウント・データの引っ越し |

## 仕組み

```
スマホ / PC（PWA）
   │  画面：Vite + 素のJavaScript（src/）
   ├─ Supabase ……… ログイン（Google）とデータ保存（docs テーブル）
   ├─ Google Calendar API ……… 今日の予定の表示・時間枠の登録（ブラウザから直接）
   └─ Vercel Functions（api/）
        ├─ /api/ai ……… Anthropic API（Polaris・Spark・週の振り返り）
        └─ /api/google-refresh ……… カレンダーの許可の更新
```

- データは Supabase の `docs` テーブル1つに、種類（collection）ごとに入ります。行レベルセキュリティで、本人の行しか読み書きできません。
- APIキーやGoogleの秘密情報はサーバー側（Vercel の環境変数）にだけ置きます。ブラウザには出ません。
- `ALLOWED_EMAIL` に登録したGoogleアカウント以外は、AIとカレンダー更新を使えません。

## はじめての設定（約40分）

順番どおりに進めてください。途中で出てくる値は、メモ帳などに控えておきます。

### 1. Supabase（データとログイン）

1. [supabase.com](https://supabase.com) で **New project**。リージョンは **Northeast Asia (Tokyo)**。
2. 左メニュー **SQL Editor** → `supabase/schema.sql` の中身を貼り付けて **Run**。
3. **Project Settings → API** で次の2つを控える。
   - Project URL（例：`https://abcd1234.supabase.co`）→ 以下「SUPABASE_URL」
   - anon public key → 以下「SUPABASE_ANON_KEY」

### 2. Google Cloud（ログインとカレンダーの許可）

1. [console.cloud.google.com](https://console.cloud.google.com) で新しいプロジェクト「AuroLIFE」を作る。
2. **APIとサービス → ライブラリ** で「Google Calendar API」を検索して **有効にする**。
3. **OAuth 同意画面**：User Type は **外部**、アプリ名「AuroLIFE」、サポートメールに自分のアドレス。
   - スコープに `.../auth/calendar.events` を追加。
   - **テストユーザー** に自分のGmail（masahiro.ws4614@gmail.com）を追加。
4. **認証情報 → 認証情報を作成 → OAuth クライアント ID**：種類は **ウェブ アプリケーション**。
   - 承認済みのリダイレクト URI：`SUPABASE_URL/auth/v1/callback`（例：`https://abcd1234.supabase.co/auth/v1/callback`）
5. 表示された **クライアント ID** と **クライアント シークレット** を控える。

> テスト中のアプリは、Googleの仕様で約7日ごとにカレンダーの許可が切れます。予定が出なくなったら、Base の「Googleに再ログイン」を押してください。

### 3. Supabase に Google ログインをつなぐ

1. Supabase **Authentication → Sign In / Providers → Google** を有効にし、2-5 のクライアント ID とシークレットを貼る。
2. **Authentication → URL Configuration**（Vercel の公開後にもう一度来ます）
   - Site URL：Vercel のURL（例：`https://drow-good-life.vercel.app`）
   - Redirect URLs：同じURLと `http://localhost:5173`

### 4. Anthropic（AI機能）

1. [console.anthropic.com](https://console.anthropic.com) → **API Keys → Create Key**。キー（`sk-ant-...`）を控える。
2. **Billing** でクレジットを購入し、**Limits** で月の上限額を設定しておく（使いすぎ防止）。
   - 既定のモデル：Polaris・振り返りは `claude-sonnet-5-5`、Spark は `claude-haiku-4-5-20251001`。環境変数 `AI_MODEL` / `AI_MODEL_QUICK` で変えられます。

### 5. Vercel（公開）

1. [vercel.com](https://vercel.com) → **Add New → Project** → GitHub の `drow-good-life` を **Import**。
2. Framework は **Vite**（自動で選ばれます）。
3. **Environment Variables** に次を入れて **Deploy**。

| 名前 | 値 |
|---|---|
| `VITE_SUPABASE_URL` | SUPABASE_URL |
| `VITE_SUPABASE_ANON_KEY` | SUPABASE_ANON_KEY |
| `VITE_ALLOWED_EMAIL` | masahiro.ws4614@gmail.com |
| `SUPABASE_URL` | SUPABASE_URL |
| `SUPABASE_ANON_KEY` | SUPABASE_ANON_KEY |
| `ALLOWED_EMAIL` | masahiro.ws4614@gmail.com |
| `ANTHROPIC_API_KEY` | 4-1 のキー |
| `GOOGLE_CLIENT_ID` | 2-5 のクライアント ID |
| `GOOGLE_CLIENT_SECRET` | 2-5 のシークレット |

4. 公開URLが決まったら、3-2 の Site URL と Redirect URLs を設定する。

### 6. ホーム画面に置く

- **iPhone**：Safari で公開URLを開く → 共有ボタン → **ホーム画面に追加**
- **Android**：Chrome で開く → メニュー → **アプリをインストール**
- **PC（Chrome / Edge）**：アドレスバー右の **インストール** アイコン

### 7. Claude版からデータを引っ越す

Base → **Claude版から引っ越す** で、書き出した JSON ファイル（`aurolife-export.json`）を選んで **取り込む**。

## 手元で動かす

```bash
cp .env.example .env   # 値を入れる
npm install
npm run dev            # http://localhost:5173
```

`/api` の関数まで手元で動かすときは `npx vercel dev` を使います。

## ファイル

| パス | 中身 |
|---|---|
| `index.html` | 画面の骨組み、PWAの設定 |
| `src/style.css` | AuroLIFE デザインシステムのトークンと全スタイル（ライト・ダーク） |
| `src/app.js` | 画面のふるまい（Now・Moves・Polaris・Spark・Trace・Base） |
| `src/backend.js` | Supabase・Googleカレンダー・AI へのつなぎ込み |
| `src/boot.js` | ログイン、起動、引っ越し |
| `api/ai.js` | AI の窓口（Anthropic API） |
| `api/google-refresh.js` | カレンダー許可の更新 |
| `supabase/schema.sql` | データベースの定義 |
| `public/` | アイコン、manifest、service worker |
