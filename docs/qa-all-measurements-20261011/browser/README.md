# 全7機種・実ブラウザー観測

`tests/audit-browser-all-measurements-20261011.cjs` がローカルの単一HTMLをメモリーに固定し、Chromiumで実際のボタン・スライダー・保存/読込を操作した記録。製品の計算値は観測対象であり、独立期待値として扱わない。

- `before/`: main `baede5bfafed034f5f7d21ec9957e344dc7c8c98`、HTML SHA256 `831edb95f7dbf1095563c1c8c289f52219bcf764937618c6079d4c4d32f7fa65`。
- `after/`: 修正後のビルド。正確なHTML SHA256は `summary.json` を参照。commit欄が作業開始コミットの場合も、HTML SHAが比較対象を特定する。
- Linux `/usr/bin/chromium`。PC 1280×1000、携帯タッチエミュレーション390×844。実iPhone/Safari検証ではない。

各条件は全支持高さ0、実装軸中央から開始する。`ideal` は `profile=null` の診断状態で、通常保存できる新品/中古個体と区別する。`new/used` は共通seed 123456。同一個体を保って各支持点に±0.001 mm/±0.010 mmを実ボタンで入力し、それぞれ逆操作で戻す。戻り値・保存された入力・seedの一致も記録する。

`results.json` の各stateには再現用 `record`、支持点位置、操作、測定keyごとの `raw`（丸め前µm）、`dom`（実DOM整数文字列）、成立/不成立を記録する。`measurements.csv` は同じ数値の一覧。`support-responses.csv` は支持操作前後と差・丸め分類を一行へ集約する。独立期待値は独立監査資料と照合するための別欄であり、この収集器が製品関数を使って正解を作らない。

主測定key:

|機種|key|
|---|---|
|小型・移動コラム・固定門形・移動門形・5軸|square.XY/XZ/YZ、sweep.right/back/left/front、TIR.root/tip300、surface.p0〜p8/range|
|横形|square.XY/XZ/YZ、parallel.a/b、TIR.root/tip300、surface.p0〜p8/range|
|旋盤|TIR.root/tip300、face.X/Z、bore.a/b/c/d/X/height、bar.side/top|

idealのフライス系では製品が固有測定ページを表示しないため、TIR/上面を勝手に0と補完せず `profile-null: intrinsic page hidden` と記録する。

`*-first.png` / `*-second.png` / `*-reference.png` / `*-sweep-detail.png` は同じ中古区分・seed・支持B+0.010 mm・全軸中央の通常scope画像。それぞれの `.input.json` と同名stateの数値を対応させる。詳細欄の全文は `.details.txt` / `.txt` に残す。

軸端点、A/C非0、表示専用の正面/側面/斜め・誇張・理想輪郭・ズーム、軸動作デモ、支持姿勢デモ、JSONの実download→入力変更→実file importを追加確認する。支持寸法は現在UIでhiddenなので診断用inputイベントと明記する。厳密な一様/傾斜/ねじれ入力と支持補間境界の直前/直後は小数位置が通常UI刻みに合わないため、直接診断入力として実ボタン表から区別する。

この記録のUI値は、毎回器具の配置/開始ゼロを取り直す測定または個体固有成分であり、「最初の器具とゼロを保持した瞬間指示」を測ったとは主張しない。保持条件の測定幾何・接触・独立期待値は別担当の独立計算で扱う。

実行例（ブラウザー起動を許す実行環境が必要）:

```sh
AUDIT_TAG=before AUDIT_ROOT=/workspace/Training-tools-before node tests/audit-browser-all-measurements-20261011.cjs
AUDIT_TAG=after AUDIT_ROOT=/workspace/Training-tools AUDIT_COMMIT=<作業開始コミット> node tests/audit-browser-all-measurements-20261011.cjs
```

## 完了した記録（2026-10-11）

|scope|before状態 / after状態|before検証 / after検証|画像（各版）|
|---|---:|---:|---:|
|通常の支持・軸・表示・保存・両測定ページ|1464 / 1471|23730 / 23868|54|
|焦点条件 `*-focus`|40 / 40|461 / 453|40|
|詳細カード実スクロール `*-details`|114 / 114|2089 / 2089|114|
|設定DOMと設定画面 `*-settings`|28 / 28|497 / 516|21|

各scopeの検証失敗・ブラウザー例外は0。通常afterに追加した7状態は、beforeで実際にdownloadしたJSONの読込。**全7機種で保存のcalculationModelを維持し、旧JSONを読込成功した。** 個体・支持・軸を復元し、読み込んだ入力に修正後の式を適用した結果が、同一入力を修正後に保存・読込した結果と一致した。

通常after、after-details、after-settingsは製品commit `fc51b761c2677fcfe43bdbae1a279ecb25541d06` を記録する。**after-focusだけは起動引数のcommit欄が当時の基点 `baede5bfafed034f5f7d21ec9957e344dc7c8c98` のまま**だが、採取したのは修正済み作業ツリーHTMLの固定バッファで、SHA256は `a70468b143711048184e8983e0e5dc823da7db4fa3fa2babdd44a96ac081ba6c`。後にcommitした `fc51b761…` の製品HTMLと完全一致する。after-focusのJSONには `commitMeaning`、`capturedFromWorkingTree:true`、`verifiedProductCommit`、`verifiedProductHTMLSHA256` を補記した。旧main `baede5b…` の製品そのものをafterとして採取したものではない。

`comparison.json` と `before-after-changed-measurements.csv` は全scopeの同一入力の前後比較。1650チェックが通過し、画像ファイル名・画像に対応する入力はすべて前後で一致した。軸デモ途中の7スナップショットは壁時計時間による位置が前後で少し異なるため、同一位置の前後比較から明示的に除いた。これらは個体・支持・寸法の保持、実際に動いたこと、最後に中央へ戻ることを別途検証し、実取得位置をJSONに残す。

通常matrixの同一入力1457状態、25986測定比較では、小型の249読値で生値が変化し、36読値で整数表示も変化した。他6機種のこの条件群は不変。これは同じ測定を複数条件で読み取った件数であり、独立な検査項目の数ではない。追加focusでは旋盤の有限面から脱落する2寸法条件が、旧「0」から「—」へ変わる8観測（2寸法×2表示幅×主画面/詳細）を確認した。

代表画像と数値:

- 小型new・seed 123456・A+0.010 mm：`before-focus/vertical-new-A+0.010-width390-first.png` → `after-focus/vertical-new-A+0.010-width390-first.png`。YZは12.432298599145131 µm / +12 → 12.528086201175903 µm / +13。
- 旋盤ideal・支持0・軸中央・width 3.2 / depth 1.68：`*-focus/lathe-ideal-width3.2-depth1.68-viewport390-first.png`。面Zは0 → —。width 4 / depth 0.8では面Xが0 → —。
- 5軸ideal・Aスライダー正規化位置−100 / C=0：`*-focus/five-ideal-A-100-width390-first.png`。右72458.25984248675、奥144916.5196849735、左72458.25984248675、手前0 µmの大きな投影値が前後で保持される。腕長・ストローク未定義の投影模型という限界を、実機のダイヤル成立と取り違えない。

設定scopeでは全7機種used・seed 123456・B+0.010 mm・全軸中央・実微調整切替を使用。`*.settings.json` に現在/初期のfinite値、微調整行のdata属性、局所角度図のdata属性、全端/中央の補助サンプル、軸入力範囲、参考最良と総合補助評価、実DOM本文を記録。修正後フライス6機種の18個別改善行は上段と同じfinite値で比較し、旋盤は「局所角度」の補助評価と明記されることを確認した。数値の軸範囲/参考最良テーブルは製品でhiddenのまま残っているため、DOM確認と可視画面を区別し、撮影のために強制表示しなかった。

再比較:

```sh
AUDIT_SCOPE=compare node tests/audit-browser-all-measurements-20261011.cjs
```
