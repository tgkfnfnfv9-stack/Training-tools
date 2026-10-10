# 横形・旋盤：独立した実ブラウザー確認

修正担当と別の担当が、Linux Chromium の実画面・実入力を採取した。支持単点操作は支持 map → 粗／微 → 上げる／下げるの実ボタン、軸は実スライダー。既知の平面・ねじれ・厳密境界・個体 seed の一括設定だけ `evaluate` を使い、各 state の `method` に区別を記録した。画像はブラウザーの screenshot で、生成画像ではない。

## 候補と再確認

- `before/`: 最新 main `cbdcf81` の修正前状態。生成 HTML と SHA-256 は [build.json](before/build.json)、固定 HTML は [candidate-index.html.gz](before/candidate-index.html.gz)。492 状態、最終 4,920 checks、未解決失敗 0。
- `after/`: 最初の修正候補 `4a50bd3626ff11be85af14dcb5fd203127332c8b0c1d71d91a9878f3b50d2d0f`。全支持・全項目・軸端・表示操作・保存読込を修正前と同じ入力で再実施。484 状態・4,882 checks、未解決失敗 0。対象2機種464状態の独立計算との差は最大 `1.59e-9 µm`。
- `final/`: 支持補間境界の再修正を含む最終候補 `0cca74408ba5099f77751161d2f1fb0aede39f6e68e4301f1072e9401f692929`。境界前／厳密点／後、代表支持±操作、既知ねじれ、旧 JSON 読込、携帯幅の実 touch swipe／double tap を追試。56 状態・520 checks、未解決失敗 0。独立計算との差は最大 `1.59e-9 µm`。

収集中にアプリの build が切り替わらないよう、再開後のスクリプトは初回 HTTP 応答をメモリに固定している。候補 HTML の gzip と各 `build.json` により取得対象を区別できる。

## 数字と独立期待値

[代表値の表](support-response-comparison.md) と [全件 CSV](support-response-comparison.csv) に、操作前後の生値・利用者が見る整数 DOM・独立した支持／剛体／接触計算の期待値を同じ行にまとめた。旧値は旧配置の観測で、新配置の期待値へ合わせるために旧テスト定数を使用していない。

各版の `results.json` は入力、支持高さ、軸位置、個体、整数 DOM、主要座標、接触の始終点を含む軽量データ。全ての途中接触を含む完全記録は `results-full.json.gz`。`measurements.csv` は画面全項目の生値と整数 DOM、`independent-oracle.json` は同じ state 名をキーとした独立期待値・誤差・不変／丸め／支持応答の分類である。計算器の値と DOM を別々に採取し、整数は「絶対値を四捨五入し、元の符号を戻す（0は0）」という画面の規則と一致することも確認した。負のちょうど0.5 µmは−1 µmとなる。

- [修正前の入力・結果](before/results.json) / [完全 trace](before/results-full.json.gz) / [独立計算](before/independent-oracle.json)
- [修正後の入力・結果](after/results.json) / [完全 trace](after/results-full.json.gz) / [独立計算](after/independent-oracle.json)
- [最終境界の入力・結果](final/results.json) / [完全 trace](final/results-full.json.gz) / [独立計算](final/independent-oracle.json)

理想 `h=.01xz mm`・軸中央の横形 XY は旧 `0.138` → 新 `6.552003 µm`、画面は `0` → `+7`。XZ は旧 `-1.830` → 新 `-3.960001 µm`、画面は `-2` → `-4`。一方、B `+0.010 mm` だけでは新 XZ は `+0.468152 µm` で画面は `0`。同じ整数に見えても生値は更新されている。全ての項目を動かすための補正を期待値には入れていない。

## 主な実ブラウザー画像

|条件|修正前|修正後／最終|
|---|---|---|
|横形 理想・平坦・中央|[before](before/horizontal-ideal-flat.png)|[after](after/horizontal-ideal-flat.png)|
|横形 理想・ねじれ `.01xz`|[before](before/horizontal-ideal-posture-.01.png)|[after](after/horizontal-ideal-posture-.01.png)|
|横形 共通傾斜＋ねじれ、斜め|[before](before/extra-horizontal-plane-twist-oblique.png)|[after](after/extra-horizontal-plane-twist-oblique.png)|
|横形 支持幅×2、正面|[before](before/extra-horizontal-dimension-double-front.png)|[after](after/extra-horizontal-dimension-double-front.png)|
|旋盤 支持奥行×2、側面|[before](before/extra-lathe-dimension-double-side.png)|[after](after/extra-lathe-dimension-double-side.png)|
|旋盤 平面 `.08x+.06z`・心押し模型|[before](before/extra-lathe-tailstock-plane-oblique.png)|[after](after/extra-lathe-tailstock-plane-oblique.png)|
|旋盤 used、B+粗、穴芯／バー画面|[before](before/extra-lathe-used-B-1-testbar.png)|[after](after/extra-lathe-used-B-1-testbar.png)|
|旋盤 used、B−粗、穴芯／バー画面|[before](before/extra-lathe-used-B--1-testbar.png)|[after](after/extra-lathe-used-B--1-testbar.png)|
|横形 携帯390px|[before](before/horizontal-width390-first.png)|[after](after/horizontal-width390-first.png)|
|旋盤 携帯390px・第2画面|[before](before/lathe-width390-second.png)|[after](after/lathe-width390-second.png)|
|最終・横形 非標準寸法で支持境界中央|—|[final](final/horizontal-ideal-boundary-central.png)|
|最終・実touchで旋盤第2画面へ|—|[final](final/lathe-mobile-swipe.png)|

正面／側面／斜め、表示誇張なし、理想輪郭なし、zoom、軸端、非対称位置、320／390／1280px の画像と同時の数値を各版へ保存した。表示設定の変更で生値が変わらないことを確認した。旋盤の奥側タレット・模型だけの固定心押し台を保持し、テスト加工や心押し精度項目がないことも画面で確認した。

## 操作・保存・他機種

横形 8 支持、旋盤 6 支持について理想／used seed 123456 の各々で ±0.001／±0.010 mm と逆操作を行った。対象の支持だけが指定量変化し、逆操作で生値と整数 DOM が戻る。平面±、`h=±.01xz`、`h=±.05xz`、各実軸スライダー±100と非対称位置を含む。

保存は実 export によるダウンロード → 別状態へ移動 → 実 file input から import。旧版で取得した JSON も修正後と最終版へ実 import し、支持高さ・軸位置・seed が保たれることを確認した。新しい式の値は保存値を流用せず、読込後に再計算される。

他 5 機種は同じ used seed・支持配置の PC／携帯・第1／第2画面について、修正前後の画素・DOM数値・ラベル位置を比較した。対応する `other-*` 画像と checks を参照。最終 source の他機種幾何・保存形式確認は [独立互換性記録](../qa-posture-compatibility-20261009/) と分担した。

[performance.json](performance.json) は実支持ボタンの capture イベント開始から、通常の onclick が DOM を更新して終了した後の bubble listener と次の描画 frame までを `performance.now()` で測った記録。Playwright の操作待ち時間は含まない。24クリック全てで、計測終了時に支持が指定量更新済みであることも確認した。同期DOM更新時間の中央値は横形が旧47.8ms／最終76.0ms、旋盤が旧45.8ms／最終67.8ms。最終の最大は横形130.1ms／旋盤87.4ms。共有コンテナー上の少数試行であり、端末の性能保証ではない。

## デモ試験で起きたハーネス競合と再試験

最初の wall-clock 方式では、3.5秒の1往復デモが stop click 前に自然終了したため、次の click が新しいデモ開始となり drawer が閉じた。待っていた「閉じる」ボタンが非表示になった timeout と、自然終了位置0を「動いていない」としたハーネス判定が出た。支持・測定値の問題とは区別した。

専用 [browser-posture-demo-20261009.cjs](../../tests/browser-posture-demo-20261009.cjs) に分離し、実 play／stop ボタンと実 requestAnimationFrame を Playwright の時計で650ms進め、停止と実スライダーでの再現を比較した。before／after／final の各5軸・71 checks が全て合格。各 `demo-recheck.json` と `demo-clock-*.png` が証拠である。旧判定には `priorObservation` と `resolvedBy` を残しており、未解決として隠してはいない。メイン検査はチェックポイントから未完了ケースだけを再開した。[初期demo timeout](after/harness-demo-initial-timeout.txt) を履歴として残した。別途、完全traceを軽量化する補助scriptでsamplesを二重に縮約した初期エラーも[履歴](before/harness-finalization-initial-error.txt)に残し、helper修正後に保存済み完全データから再集計した。これらはアプリのbrowser exceptionではなく、各版の `errors` は空。

## 再実行と限界

- 主検査: `node tests/browser-posture-response-20261009.cjs before|after`。HTTP既定は8771／8772。`AUDIT_URL` で指定できる。
- 追加画像: `node tests/browser-posture-extra-20261009.cjs before|after`。
- 最終境界と touch: `node tests/browser-posture-final-boundary-20261009.cjs`（8773の固定最終HTML）。
- デモ: `node tests/browser-posture-demo-20261009.cjs before after final`。
- 独立値: `node tests/compare-posture-browser-oracle-20261009.cjs before|after|final`。
- 対応表: `node tests/join-posture-browser-comparison-20261009.cjs`。

保存した `candidate-index.html.gz` を一時ディレクトリーの `index.html` に解凍し、そのディレクトリーを `python3 -m http.server` で提供すれば当時の候補を再現できる。ブラウザーは `/usr/bin/chromium`、依存は Playwright／pngjs。

実 iPhone Safari と実機・実測器は未確認。携帯検証は Chromium touch emulation。有限個の支持境界前後と内部接触の検査は、連続経路の全衝突や治具の実装可能性を証明するものではない。
