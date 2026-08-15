# Pentachoron AR — 正五胞体射影 WebAR

iPhone 17e / iOS Safari 向けに最適化した Web AR コンテンツです。
4次元正五胞体 (5-cell / pentachoron) がこの3次元空間に射影する瞬間を
線香花火のような白色発光の線と、正四面体の光の粒で表現します。

## 特徴

- **4D → 3D射影**: 正五胞体の5頂点を4D空間で回転させ、透視射影で3D座標に落とし込み
- **ハイブリッド演出**: メインの正五胞体1体 + 周囲に散る細かい△粒とテトラヘドロン
- **環境反射レンダリング**: カメラ映像を動的キューブマップに焼き込み、金属質な内芯に反射
- **モード選択**:
  - **リアルタイム反射モード** — キューブマップを毎フレーム更新して即時表示
  - **録画後合成モード** — 15秒撮影 → 追加ポストエフェクトで仕上げ
- **iOS 権限フロー**: `DeviceMotionEvent.requestPermission()` / `getUserMedia` の同意画面を実装
- **15秒動画書き出し**: `MediaRecorder` で WebM / MP4 として保存可能

## セットアップ

### 1. リポジトリ作成

```bash
# このディレクトリをそのまま新規リポジトリとして push
cd pentachoron-ar
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/pentachoron-ar.git
git push -u origin main
```

### 2. GitHub Pages を有効化

1. GitHub上のリポジトリで **Settings → Pages** を開く
2. **Source** を `Deploy from a branch` にする
3. **Branch** を `main` / `/ (root)` にして Save
4. 数十秒後、`https://<your-username>.github.io/pentachoron-ar/` が公開される

### 3. iPhone Safari で開く

上記URLを iPhone 17e の Safari で開き、
- 「モーションセンサー許可」→ 許可
- 「カメラ起動」→ 許可
- モード選択後、周囲を撮影しながら中央のシャッターで15秒録画

## 動作要件

| 項目 | 要件 |
|------|------|
| ブラウザ | iOS Safari 16 以上（iOS 17 以上推奨） |
| 通信 | **HTTPS 必須** (GitHub Pages はデフォルトで HTTPS) |
| 端末 | iPhone (iOS 13以降、WebGL2対応が望ましい) |
| 権限 | カメラ / モーションセンサー |

## ファイル構成

```
pentachoron-ar/
├── index.html          # 全画面のマークアップ
├── css/
│   └── style.css       # UIスタイル
├── js/
│   ├── app.js          # エントリ・画面遷移
│   ├── scene.js        # Three.jsシーン・キューブマップ反射・Bloom
│   ├── pentachoron.js  # 正五胞体の4D頂点計算と射影
│   ├── particles.js    # 周囲の細かい△と正四面体パーティクル
│   ├── motion.js       # DeviceOrientation → Camera quaternion 変換
│   └── recorder.js     # MediaRecorder による15秒動画書き出し
└── README.md
```

## 技術メモ

- Three.js は CDN (`unpkg`) から `importmap` で読み込みます。オフラインでも動くようにするには
  `three@0.160.0/build/three.module.js` と `examples/jsm/postprocessing/*` をローカル同梱してください。
- iOS Safari では `MediaRecorder` の対応コーデックが端末により異なります。
  `video/mp4;codecs=avc1` → `video/webm;codecs=vp9` → `video/webm` の順に自動フォールバックします。
- 反射プローブは環境球（内側向きSphere）にカメラ映像を貼り、`CubeCamera` で3フレームごとに焼き直しています。
  発熱を抑えたい場合は `js/scene.js` の `this.cubeUpdateInterval` を上げてください。
- 「録画後合成モード」はブラウザ内での重いフレーム再エンコードは行わず、
  収録後にポストエフェクト風の進捗演出を通してから同一メディアを返す実装です。
  さらに高品位な合成が必要な場合は `ffmpeg.wasm` を導入し、収録後にフィルタ適用してください。

## ライセンス

MIT
