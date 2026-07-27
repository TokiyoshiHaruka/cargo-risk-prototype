# Cargo Risk // Route Trial

短時間で「貨物を運ぶ判断が、利益と損失の理由まで伝わるか」を検証するブラウザ向けゲームプレイ・プロトタイプです。

FF14 の物資運搬、Star Citizen の航路リスク、Minecraft の資源ループから着想を得ています。完成品ではなく、面接で説明できる小さな仮説検証の単位として設計しています。

## 検証する問い

3-5 分の 1 ランで、プレイヤーは次の関係を理解して選択できるか。

- 契約の初期投資と貨物量
- 航路リスク、燃料費、期待利益のトレードオフ
- 護衛費とイベント損失のトレードオフ
- イベント中の「保持」または「回避」判断と、最終 receipt による説明

## 遊び方

1. 契約を 1 つ選ぶ
2. 航路を選び、必要なら護衛を付ける
3. 各イベントで保持または回避を選ぶ
4. 結果と利益、貨物、評判を Run receipt で確認する

同じ seed なら同じ roll になります。初期 seed は `42` です。

## 起動

```bash
npm install
npm run dev
```

ブラウザで `http://127.0.0.1:4173` を開いてください。

## 技術と境界

- TypeScript + Phaser 3 + Vite
- `src/simulation.ts` は Phaser と DOM に依存しない純粋な状態遷移層
- `src/game.ts` はルート、船、貨物、イベント状態の視覚化を担当
- `src/hud.ts` は DOM HUD、入力、receipt 表示を担当
- 外部アセット、ネットワーク通信、ログイン、永続データは使用しない

設計の詳細は [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) を参照してください。

## 検証コマンド

```bash
npm test
npm run build
npm run check
npm run test:browser
```

Playwright を初めて使う環境では、リポジトリ外の F ドライブ上キャッシュなど、書き込み可能な場所を `PLAYWRIGHT_BROWSERS_PATH` に指定して `npx playwright install chromium` を一度実行してください。検証結果は [`docs/VERIFICATION.md`](docs/VERIFICATION.md) に記録しています。

AI の利用範囲は [`AI_USAGE.md`](AI_USAGE.md) を参照してください。

## 今回の範囲外

マルチプレイヤー、サーバー同期、経済の長期運用、正式なアート制作、課金はこのプロトタイプの検証対象ではありません。次の判断は、実プレイヤーの観察結果をもとにイベントの種類とリスク表示を調整することです。
