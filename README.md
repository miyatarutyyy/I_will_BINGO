# I will BINGO

リアルタイム同期に対応したオンラインビンゴゲームです。  
フロントエンドは Vercel に公開しており、現在は `https://i-will-bingo.vercel.app` から利用できます。

身内向けに短期運用できることを優先しており、ルーム作成、参加、進行同期、ゲーム結果表示までを一通り実装しています。

## 主な機能

- ルーム作成とルーム ID による参加
- 複数人でのリアルタイム同期プレイ
- ホストによるゲーム開始とラウンド進行
- 各プレイヤーのビンゴカード自動生成
- SSE を使ったルーム状態の即時反映
- セッション復元
- 結果画面での勝者表示

## 公開状況

- frontend: `https://i-will-bingo.vercel.app`
- frontend hosting: Vercel
- backend: 別途 Node.js 常駐環境で動かす構成

このリポジトリは、`frontend` を静的配信し、`backend` を API / SSE サーバーとして別プロセスで動かす前提です。

## リポジトリ構成

- `frontend`: Vite + React + TypeScript で構成したクライアント
- `backend`: Express + TypeScript で構成した API / SSE サーバー
- `docs`: 仕様書、公開メモ、補足ドキュメント

## 技術スタック

- frontend: React, Vite, TypeScript, ESLint
- backend: Express, TypeScript, CORS
- test: Vitest, Supertest
- realtime sync: Server-Sent Events (SSE)

## ローカル開発

### 1. 環境変数を用意

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 2. 依存関係をインストール

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

### 3. 開発サーバーを起動

```bash
npm run dev
```

デフォルトでは次の URL を利用します。

- frontend: `http://localhost:5173`
- backend: `http://localhost:3000`

## 環境変数

### backend

- `PORT`: バックエンドの待受ポート
- `CORS_ORIGIN`: 許可するフロントエンド URL。複数指定する場合はカンマ区切り

```env
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

### frontend

- `VITE_API_BASE_URL`: 接続先 backend のベース URL

```env
VITE_API_BASE_URL=http://localhost:3000
```

## 利用できる npm scripts

### ルート

- `npm run dev`: frontend / backend を同時起動
- `npm run dev:frontend`: frontend のみ起動
- `npm run dev:backend`: backend のみ起動
- `npm run build`: frontend の本番ビルド
- `npm run typecheck`: frontend / backend の型チェック
- `npm run lint`: frontend の lint
- `npm test`: backend テスト
- `npm run verify`: 型チェックと frontend build をまとめて実行

### backend

- `npm --prefix backend run dev`: 開発起動
- `npm --prefix backend run start`: 通常起動
- `npm --prefix backend run typecheck`: 型チェック
- `npm --prefix backend test`: テスト

### frontend

- `npm --prefix frontend run dev`: 開発起動
- `npm --prefix frontend run build`: 本番ビルド
- `npm --prefix frontend run preview`: ビルド結果確認
- `npm --prefix frontend run typecheck`: 型チェック

## デプロイ前提

このプロジェクトは次の分離構成を前提にしています。

- frontend: Vercel / Netlify / Cloudflare Pages などの静的ホスティング
- backend: Render / Railway / Fly.io などの Node.js 常駐ホスティング

公開時の基本フローは次の通りです。

1. backend を先に公開する
2. backend の公開 URL を frontend の `VITE_API_BASE_URL` に設定する
3. frontend の公開 URL を backend の `CORS_ORIGIN` に設定する
4. `/health`、ルーム作成、別端末参加、SSE 同期を確認する

## 現在の制約

- ルーム状態は backend のインメモリ保持なので、再起動で消えます
- 認証は未実装です
- `playerId` を知っていればそのプレイヤーとして API を呼べます
- 複数インスタンスへの水平分散には未対応です
- 長期運用向けの永続化や監視は未整備です

短期公開には使えますが、継続運用するなら永続化、認証、運用監視の追加が必要です。

## 動作確認

- backend のヘルスチェック: `GET /health`
- ルーム作成
- 複数ブラウザまたは別端末からの参加
- ゲーム進行中の SSE 同期

## 関連ドキュメント

- [総合仕様書](/home/trt-ryzen7/Dev/I_will_BINGO/docs/specification.org)
- [frontend 仕様書](/home/trt-ryzen7/Dev/I_will_BINGO/docs/frontend-specification.org)
- [backend 仕様書](/home/trt-ryzen7/Dev/I_will_BINGO/docs/backend-specification.org)
- [公開手順メモ](/home/trt-ryzen7/Dev/I_will_BINGO/docs/deployment.org)
