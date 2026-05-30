# 🌀 MAZE RUNNER 3D

スマホ縦画面に最適化した、一人称視点の3D迷路ゲーム。
**バックエンド不要・完全静的** なので、GitHub Pages / Cloudflare Pages / Netlify などにそのまま置けます。

![mode](https://img.shields.io/badge/3D-Three.js-00ffaa) ![static](https://img.shields.io/badge/hosting-static-blue) ![mobile](https://img.shields.io/badge/mobile-first-orange)

## 🎮 ゲームモード

| モード | 内容 |
|--------|------|
| 🧭 **ソロ タイムアタック** | 迷路を最速でクリア。最短経路マス数も表示 |
| 🤖 **AI対戦** | A\*探索で動くAIと同時スタートで競争。難易度 EASY / NORMAL / HARD / INSANE |
| 👥 **友達対戦（交互プレイ）** | 1台の端末を回して、同じ迷路を順番に挑戦しタイム勝負 |

迷路サイズは S / M / L / XL の4段階。

## 📱 操作方法

**スマホ**
- 左下の **バーチャルスティック** … 倒した方向に前進＋旋回
- 画面右側を **スワイプ** … 視点をその場で回す

**PC**
- `W A S D` または 矢印キー … 移動・旋回
- マウスドラッグ … 視点旋回

## ✨ 技術的な特徴

- **Three.js** によるリアルタイム3D（壁は `InstancedMesh` で一括描画して軽量化）
- 壁・床・天井のテクスチャは **Canvasで手続き生成**（画像アセット0 = 配信が軽い）
- 迷路は **Recursive Backtracker** で生成＋ループ追加で複数経路化
- ゴールは BFS で **スタートから最も遠いセル** に自動配置
- AIは **A\*経路探索**（難易度で速度・思考頻度・寄り道率を調整）
- **フォグ付きミニマップ**（探索した場所だけ表示）
- トーチライトのゆらぎ、ヘッドボブ、ゴールの発光など演出多数
- セーフエリア対応・タッチ最適化のスマホファーストUI

## 🚀 ローカル実行

ES Modules を使うため、`file://` ではなく簡易サーバー経由で開いてください。

```bash
# Python
python3 -m http.server 8000
# → http://localhost:8000

# もしくは Node
npx serve .
```

## 📦 デプロイ（静的ホスティング）

ビルド不要。リポジトリの中身をそのまま公開するだけです。

- **GitHub Pages**: Settings → Pages → ルートを公開
- **Cloudflare Pages**: Build command 空欄 / Output directory `.`（ルート）
- **Netlify**: ドラッグ&ドロップ、または publish directory をルートに

## 🗂 ファイル構成

```
.
├── index.html          # 画面構造（メニュー / ゲーム / 結果 / 中間画面）
├── css/style.css       # スマホファーストのスタイル
├── vendor/
│   └── three.module.js # Three.js 本体（CDN非依存でvendor）
└── js/
    ├── main.js         # エントリ：画面遷移・メニュー・結果表示
    ├── game.js         # ゲーム本体：状態管理・メインループ
    ├── maze.js         # 迷路生成・A\*・BFS（依存なし / テスト済み）
    ├── renderer.js     # Three.js 3D描画
    ├── player.js       # 一人称プレイヤー：移動・衝突・ヘッドボブ
    ├── ai.js           # AI対戦相手：A\*でゴールへ
    ├── minimap.js      # フォグ付き2Dミニマップ
    └── controls.js     # タッチ（スティック+スワイプ）/ キーボード入力
```

## 📝 ライセンス

ゲームコードは自由に利用可。Three.js は MIT License。
