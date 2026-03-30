# I will BINGO

身内向けに一旦公開できるところまで整えた、リアルタイム同期つきのビンゴゲームです。

## 構成

- `frontend`: Vite + React の静的フロントエンド
- `backend`: Express の API / SSE サーバー
- 状態管理: backend のインメモリ保持

## ローカル起動

1. `backend/.env.example` を `backend/.env` にコピー
2. `frontend/.env.example` を `frontend/.env` にコピー
3. ルートで `npm install`
4. `npm run dev`

frontend は `http://localhost:5173`、backend は `http://localhost:3000` を想定しています。

## 環境変数

### backend

- `PORT`: backend の待受ポート
- `CORS_ORIGIN`: 許可する frontend の URL。複数ある場合はカンマ区切り

```env
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

### frontend

- `VITE_API_BASE_URL`: 接続先 backend の URL

```env
VITE_API_BASE_URL=http://localhost:3000
```

## 公開時の最低限フロー

1. backend を Render / Railway / Fly.io などへ公開する
2. frontend を Vercel / Netlify / Cloudflare Pages などへ公開する
3. frontend に `VITE_API_BASE_URL` として backend の公開 URL を設定する
4. backend に `CORS_ORIGIN` として frontend の公開 URL を設定する
5. `/health` とルーム作成、別端末参加、SSE 同期を確認する

詳細は [`docs/deployment.org`](/home/trt-ryzen7/Dev/I_will_BINGO/docs/deployment.org) を参照してください。

## 便利コマンド

- `npm run dev`: frontend と backend を同時起動
- `npm run build`: frontend の本番ビルド
- `npm run typecheck`: frontend / backend の型チェック
- `npm test`: backend テスト
- `npm run verify`: 型チェックと frontend ビルド

## 現在の制約

- ルーム状態はインメモリ保持なので、サーバー再起動で消えます
- 認証は未導入です
- 複数インスタンス運用は未対応です

身内向けの短期公開には使えますが、継続運用には永続化と認証が必要です。
