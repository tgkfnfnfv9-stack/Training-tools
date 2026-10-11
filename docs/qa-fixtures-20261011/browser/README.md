# 横形・旋盤の取付再監査: 実ブラウザー証拠

この記録は製品を Chromium で操作した観測値であり、独立期待値ではない。独立担当は `results.json` の `states[].record` に保存された入力から別計算し、生値・整数 DOM・有効性・理由と照合する。

- 修正前: `c3768bc1a73832e73ae256fe598ba02a3fffd574` を `/workspace/Training-tools-fixtures-before` に detached worktree として凍結。
- スクリプト: [`tests/audit-browser-fixtures-20261011.cjs`](../../../tests/audit-browser-fixtures-20261011.cjs)
- 環境: Linux `/usr/bin/chromium`、PC 1280 × 1000、タッチ操作を有効にした携帯幅 390 × 844。実機 iPhone / Safari の試験ではない。

## 記録形式

`before` / `after` は通常・支持操作・軸位置・保存入出力のマトリクス、`*-focus` は寸法端と同一入力の PC / 携帯画像、`*-details` は各測定手順カードの全文を表示欄の 80% ずつスクロールした画像を含む。説明文の改訂で長さが変わるため、詳細画像の枚数差は欠落と同一視しない。画像名と同じ `*.input.json` は撮影時に製品が保存する完全な入力である。

`*-stations` は旋盤の穴測定位置（標準寸法で実 X = −57.14285714285715、Z = −100）における全支持操作、到達長 350 mm 境界の両側、PC / 携帯の穴表示を記録する。修正前は改訂後の測定位置と同じ軸位置を診断入力し、修正後は測定位置ボタンを実操作する。

各 `results.json` は HTML SHA256、基準コミット、実ブラウザー例外、検証一覧、および `states[]` を持つ。

| フィールド | 内容 |
| --- | --- |
| `name` | 前後結合する同一入力ケース ID |
| `operation` | 実ボタン、スライダー、診断用入力の区別 |
| `record` | 保存形式の機種、寸法、支持高さ、軸位置、個体 seed / profile |
| `measurements` | 測定ごとの `raw` µm、`dom` 整数文字列、`valid`、`reason` |
| `fixtureObservations` | 製品が返す取付・接触・走査端の生出力。期待値として流用しない |
| `ui` | 画面寸法、横はみ出し、表示ページ、保存状態 |

`measurements.csv` は全観測値、`support-responses.csv` は支持操作前後の生値・差分・整数変化分類を記録する。後者の独立期待値欄は意図して空欄にし、別の独立検証記録を参照する。画面の通常読値は再取付け・開始点再ゼロの手順であり、旧ゼロ保持を自動で意味しない。旧ゼロ保持の別計算は独立担当の記録で比較する。

## ケース

横形 8 点・旋盤 6 点の各支持について、実 UI の ±0.001 / ±0.010 mm と逆操作を、ideal 診断・new・used の各条件で実施する。new / used は seed 123456。全実装直進軸の端、同じ剛体傾斜・ねじれの診断、支持セル境界の両側、表示操作、JSON 書出し・読込みも記録する。

寸法入力は画面では非表示のため、寸法端のケースは「hidden dimension input event diagnostic」と明記する。表示されていない操作をユーザーが通常操作したものとして扱わない。軸デモの移動中は時刻で採取位置が変わるため、同一位置の前後差には使用せず、記録した位置の個別検証と中央復帰検証に使う。

最終件数と前後差分は実行完了後の `summary.json` / `comparison.json` を参照する。

下記の最終集計は初回の修正前取得に、改訂版の実測定位置と同じ軸位置、および独立に指定した有限境界の修正前取得を追加した値である。

## 修正途中に実画面で発見した問題

`after-smoke`（HTML SHA256 `cedb2f53afdb6f52dbd1f984f8a6c63ef4307c3c77c01eb440d8c826e5b7ae2e`）は数値・保持操作の 128 状態 / 8,217 チェックに失敗しなかったが、画像で治具図が短い支持操作欄から上下にはみ出して切れることを確認した。旋盤の共通治具図 API もこの時点では未実装だった。この途中版を図の完成根拠として扱わない。

専用ダイアログと旋盤の図 API を追加した `after-smoke-dialog`（HTML SHA256 `a4d6bf4934c615322faf78fb08322b136fd9f3b8626ec20a6a299e1f3dad110c`）では、横形 4 種・旋盤 5 種の全選択を PC / 携帯で確認した。144 状態 / 9,453 チェック、失敗・例外 0。選択した有限形状と接触点が存在すること、キャンバス全体がクリップされず表示されること、図の工程・方向の変更が保存入力と保持状態を変えないことを追加で検証した。

- [切れていた初版の実画面](after-smoke/horizontal-used-fixture-YZ-width1280-geometry-S-0-oblique.png)
- [専用ダイアログで全体を表示した横形](after-smoke-dialog/horizontal-used-fixture-YZ-width1280-geometry-S-0-oblique.png)
- [携帯幅で全体を表示した旋盤](after-smoke-dialog/lathe-used-fixture-bore-width390-geometry-S-0-oblique.png)

保持比較を含む最終記録では `state.comparison.captureRecord` に実際の保持操作時点の保存入力を明記する。支持変更後の再保持も、初期支持を推測せずに検算できる。`fixture-comparisons.csv` は操作前 / 旧ゼロ保持 / 再取付け・再ゼロの各生値と整数表示を持つ。改訂後 TIR は鼻端から 50 / 350 mm なので、観測キーを `TIR.at50` / `TIR.at350` とし、旧 `TIR.root` / `TIR.tip300` の 0 / 300 mm と同一位置の差分にはしない。

## 確定版と最終集計

修正後は commit `c33e9f02e30559cee9ab3c4727785a30f59f5baa` を `/workspace/Training-tools-fixtures-after` に凍結して実行した。全最終 after 群の HTML SHA256 は `812d4d706652b11ce88801f93b2e88370e28b9d4f002417db1d9ecf94302456e`。途中 smoke の HTML と区別する。

| 群 | before 状態 / チェック / 画像 | after 状態 / チェック / 画像 |
| --- | ---: | ---: |
| 通常・全支持・軸端・表示・保存 | 408 / 5,809 / 14 | 410 / 16,762 / 14 |
| focus: 寸法端、同条件 PC / 携帯 | 82 / 883 / 82 | 82 / 3,207 / 82 |
| details: 手順全文スクロール | 85 / 1,351 / 85 | 62 / 2,566 / 62 |
| stations: 穴位置・全支持・到達境界 | 174 / 2,164 / 18 | 174 / 10,774 / 18 |
| fixture-stations: 全測定位置・全支持・保持 | 489 / 6,553 / 0 | 489 / 31,156 / 0 |
| boundaries: 独立指定の境界両側 | 24 / 121 / 24 | 24 / 913 / 24 |
| interaction: 全種類の治具図・保持・保存解除 | 旧 UI に機能なし | 424 / 28,671 / 402 |
| **合計** | **1,262 / 16,881 / 223** | **1,665 / 94,049 / 602** |

全群の終了コード 0、失敗・ブラウザー例外 0。after 通常群の追加 2 状態は、before の実ダウンロード JSON を読み込んだ確認であり、機械入力と profile を維持した。interaction 群では保持中の実書出し → 実読込みにより、入力を維持して一時的な器具・ゼロだけが解除されることを確認した。軸位置変更による解除、表示方向・工程・走査表示・全体 / 接触拡大の切替で入力と保持を変えないことも確認した。

`station-manifest.json` は実測定位置ボタンの到達入力を記録する。横形 4 選択は同じ軸位置、旋盤 5 選択は 2 種類の軸位置なので、全支持マトリクスでは同じ入力を重複させず、すべての選択操作・図は interaction 群で確認した。before ではこの実測定位置と同一入力を診断設定した。画像を撮らない状態の `fixtureObservations` は重複する形状を省略し、独立計算に必要な完全な保存入力・captureRecord・生値・DOM・有効性・理由を保存した。

[前後比較](comparison.json) は 1,267 チェック、失敗 0。同一入力で対応する値だけを比較する。時刻で位置が変わる軸デモ途中の 2 状態と、測定位置が変わった TIR 0 / 300 → 50 / 350 mm は同一位置の数値差から除いた。詳細画像は説明文の長さが変わるため、同じ機械入力と画面幅で対応づける。[変化した読値 CSV](before-after-changed-measurements.csv) と各群の全読値 CSV を併用する。

製品とは別担当による最終 7 群の入力からの再計算も、[横形 715 状態 / 38,171 比較](../independent-horizontal-browser-summary.json)、[旋盤 950 状態 / 30,980 比較](../lathe-independent-summary.json) とも失敗 0。生値、実 DOM 整数、有効性、初回 / 旧ゼロ保持 / 再取付けを照合し、最大差は横形 1.825 × 10⁻⁹ µm、旋盤 5.933 × 10⁻¹⁰ µm。

最初に起動した after 群に残っていた旧 `semantics` と穴手順ラベルを、現在の「主欄は再測定、比較欄は初回 / 旧ゼロ保持 / 再取付け」に統一した。入力・数値・DOM・チェック・形状は変更していない。[文字列だけの正規化記録](metadata-normalization.json) に `states` 以降の原文バイト列が不変である SHA256 を記録した。

## 同一入力での生値・整数・独立期待値

単位 µm。値は表示用に小数 9 桁へ丸め、全精度は JSON / CSV に保存した。横形は new / seed 123456、幅 2.72 m・奥行 3.68 m、X = 0、Y = −100、Z = −88.88888888888887。旋盤は used / seed 123456、幅 4 m・奥行 1.68 m、X = −57.14285714285715、Z = −100。いずれも支持 B +0.010 mm、他支持 0。表は再取付け・再ゼロ後の主欄である。

| 測定 | before 生値 / 整数 | after 生値 / 整数 | 独立期待値 |
| --- | ---: | ---: | ---: |
| 横形 XZ | 5.556392285 / +6 | 6.320658590 / +6 | 6.320658590 |
| 横形 XY | 16.147999992 / +16 | 16.147999992 / +16 | 16.147999992 |
| 旋盤 穴の対向指示差 X | 87.050384715 / +87 | 80.266784785 / +80 | 80.266784785 |
| 旋盤 穴の対向指示差 高さ | −2.581415658 / −3 | −2.527844227 / −3 | −2.527844227 |

横形 XZ と穴の高さは生値が変わっても整数表示が同じになる。横形 XY はこの再取付条件では変わらない。すべての値を変える処理は期待していない。独立期待は製品の形状・サンプル・結果を転用せず保存入力から再構成した値であり、[横形の独立検証](../independent-design.md) および [旋盤の独立検証](../lathe-independent.md) を参照する。

同じ確定版で used / seed 123456、各測定位置で支持 0 の取付け・ゼロを保持し、B +0.010 mm とした場合は次のようになる。

| 測定 | 操作前 生値 / 整数 | 旧ゼロ保持 生値 / 整数 | 再取付け・再ゼロ 生値 / 整数 |
| --- | ---: | ---: | ---: |
| 横形 XY | 16.959000 / +17 | 13.409849 / +13 | 16.959000 / +17 |
| 横形 XZ | 8.129000 / +8 | 6.605385 / +7 | 9.486654 / +9 |
| 旋盤 穴 a | 0 / 0 | −2.825006 / −3 | 0 / 0 |
| 旋盤 バー上面 | −0.005752 / 0 | −0.189491 / 0 | −0.006324 / 0 |

## 実画面の前後リンク

- **横形・標準寸法、used / seed 123456、B +0.010 mm、同一測定位置**: [before](before-paired-station-images/horizontal-used-station-B+0.010-width1280-first.png) → [after](after-paired-station-images/horizontal-used-station-B+0.010-width1280-first.png)。X = 0、Y = −100、Z = −88.88888888888887 を含む保存入力が一致することを [専用比較 JSON](paired-station-images-comparison.json) で確認した。この追加撮影は各 1 状態 / 画像 1 枚、before 19 チェック・after 59 チェック、失敗・例外 0。上の全量集計・独立 7 群集計とは別に記載する。各画像と同名の input JSON、および各群の results JSON に全精度の生値を保存した。
- 横形・同じ軸中央入力: [before](before/horizontal-used-B+0.010-width1280-first.png) → [after](after/horizontal-used-B+0.010-width1280-first.png)。以前の過大な腕に依存した数値を、現在は測定位置外として扱う。[測定位置へ移動した図](after-interaction/horizontal-used-fixture-YZ-width1280-geometry-S-0-oblique.png) で有限の箱台・短い腕・接触を確認できる。
- 旋盤・同じ穴測定位置、B +0.010 mm: [before 穴の読値](before-stations/lathe-used-station-bore-B+0.010-width1280-second.png) → [after 穴の読値](after-stations/lathe-used-station-bore-B+0.010-width1280-second.png)。[携帯の穴接触拡大](after-interaction/lathe-used-fixture-bore-width390-geometry-S-0-oblique.png) と [旧ゼロ保持を含む比較](after-interaction/lathe-used-fixture-bore-width1280-comparison-4.png) も保存した。

## 再現

上記 2 コミットを各 frozen path へ展開し、Playwright と `/usr/bin/chromium` が利用できる環境でリポジトリ root から実行する。最終 after の例:

```bash
AUDIT_TAG=after AUDIT_ROOT=/workspace/Training-tools-fixtures-after AUDIT_COMMIT=c33e9f02e30559cee9ab3c4727785a30f59f5baa node tests/audit-browser-fixtures-20261011.cjs
```

`AUDIT_SCOPE=focus|details|fixture-stations|boundaries|interaction` と `AUDIT_TAG=after-<scope>` で対応する群を実行する。穴 station 群は `AUDIT_SCOPE=stations AUDIT_TAG=after-stations AUDIT_LATHE_BORE_BUTTON='#fixturePosition'`。`fixture-stations` と `boundaries` は after を先に実行して manifest を作成し、続けて `AUDIT_TAG=before-<scope> AUDIT_ROOT=/workspace/Training-tools-fixtures-before AUDIT_COMMIT=c3768bc1a73832e73ae256fe598ba02a3fffd574` で before を取得する。`AUDIT_SCOPE=compare AUDIT_TAG=after` で前後入力の対応と差分を再生成できる。

追加の標準横形画像は `AUDIT_SCOPE=paired-station-images AUDIT_TAG=before-paired-station-images` / `after-paired-station-images` と、それぞれの frozen root / commit を指定して再現できる。
