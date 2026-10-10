# 横形YZ配置訂正の独立互換性確認

アプリを変更しない互換性担当が、`87a4adf4644eda872a046dcc3281563542e8fc56` を `git archive` で `/tmp/training-fixture-baseline-87a4adf` に固定して修正前データを取得した。編集中の共有srcを修正前とはしていない。

このcommitの `index.html` と、指定された `before/index.html.gz` の展開結果は、SHA256 `37bfa01052c53a55eddd770d015338f719d2d6495b8042525389a734583ecb8f` で一致した。

## 比較する契約

- 他5機種 `vertical`（kind compact）、`travel`、`gate`（kind double）、`gantry`、`five` と旋盤: 数値、全3D頂点/部品ラベル、精度UIを完全維持。
- 横形: XY/XZ/a/bの生値・整数表示、3D模型、固定個体を維持。YZは変更対象なので旧値へ合わせず別記録する。
- 全7機種: 保存schema、同seedの個体と固有検査値を維持。旧JSON入力を復元し、横形YZは新配置で再計算、それ以外の測定値は同じ。
- 製品変更を許容するソースは `reference-measurement-ui.js`、`spindle-sweep-ui.js`、必要時の `horizontal-parallelism-ui.js`。統括担当の追加指定で `src/index.html` 内の横形bar詳細も含める。他のsrcはハッシュも比較する。

旧値との一致を要求するのは今回変更しない契約だけである。新しいYZ配置の物理的な正しさは別の幾何確認担当が判定し、この互換性テストで旧式を正解とはしない。

## 検査の構成

[スクリプト](../../tests/check-horizontal-fixture-compatibility-20261010.cjs)。336状態 = 7機種 × 理想/used seed 123456 × 支持4条件 × 軸3条件 × 誇張on/off。

支持条件は平坦、B +0.010 mm、`h=0.01xz mm`、`h=0.02x−0.03z+0.01 mm`（x/zは支持寸法によるm座標、0.001 mm刻みに量子化）。軸条件は全中央、複合端、非対称 `(X,Y,Z,A,C)=(37,−62,81,45,−33)`。各機種に存在する軸が作用する。

大きな3D/接触配列とUI markupはSHA256で完全比較し、保護する測定値は小数のままJSONに保持する。横形の器具説明・小図は変更対象なので、横形UIのmarkup全体一致は要求せず、XY/XZ/a/bの生値と整数表示を比較する。

全7機種 × new/used × seed `0 / 123456 / 4294967295` = 42個体について、生成profileと派生する固有検査値を比較する。支持上下操作が実際に入力を変えることと、同じ個体を保持したまま入力を戻せることも確認する。

保存JSONは支持高さ・寸法・軸位置・固定個体等の入力を保存し、測定生値や接触ゼロは保存しない。読込後は現在の式で再計算する。`bestState` は支持高さ候補であり、測定結果ではないため、読込再探索による候補改善だけは入力完全一致の比較から除く。

## 実行

```sh
node tests/check-horizontal-fixture-compatibility-20261010.cjs capture /tmp/training-fixture-baseline-87a4adf /workspace/Training-tools/docs/qa-horizontal-fixture-20261010/compatibility-before.json
node tests/check-horizontal-fixture-compatibility-20261010.cjs capture /workspace/Training-tools /workspace/Training-tools/docs/qa-horizontal-fixture-20261010/compatibility-after.json /workspace/Training-tools/docs/qa-horizontal-fixture-20261010/compatibility-before.json
node tests/check-horizontal-fixture-compatibility-20261010.cjs compare docs/qa-horizontal-fixture-20261010/compatibility-before.json docs/qa-horizontal-fixture-20261010/compatibility-after.json
```

各captureは開始/終了時刻、全srcのSHA256、実行中ソース不変の検査を含む。afterは統括担当のソース凍結通知後に取得する。

修正前VM取得は成功: [compatibility-before.json](compatibility-before.json)、336状態・7保存JSON・42個体。

追加の[実ブラウザースクリプト](../../tests/browser-horizontal-fixture-compatibility-20261010.cjs)で、対象外6機種（他5＋旋盤）のPC 1280/mobile 390幅、両測定ページの24画像を取得。全7機種の保存ボタンによる実ダウンロードも成功し、[修正前ブラウザー記録](compatibility-browser-before/results.json)へ保存した。

## 修正後の結果

凍結HTML SHA256 `5231b54fb384a9a4d3e531114687566ff97d3c4c14ac007bab35141630b1ce18` と、その対応srcで確認した。

- [VM修正後](compatibility-after.json) / [比較結果](compatibility-comparison.json): 336状態すべて合格。対象外5機種240状態と旋盤48状態で数値・3D・UIが完全一致。横形48状態でもXY/XZ/a/bの生値と整数表示、3Dが完全一致。
- 42個体のprofileと固有検査値、全7機種の保存schemaが完全一致。旧JSONの全7入力を復元し、横形YZ以外の測定値も完全一致。
- [実ブラウザー修正後](compatibility-browser-after/results.json): **77 checks、失敗0、ブラウザー例外0**。対象外6機種の24画像すべてで差分0 pixel。全7旧JSONの実アップロード・再ダウンロード・入力復元も成功。
- `src` の変更は `index.html`、`reference-measurement-ui.js`、`spindle-sweep-ui.js` の3ファイルだけ。その他のソースは修正前とSHA256一致。VM取得中のソース不変検査も合格（2026-10-10 01:32:53.684～01:34:15.639 UTC）。

画像例: [旋盤PC修正前](compatibility-browser-before/lathe-1280-first.png) / [修正後](compatibility-browser-after/lathe-1280-first.png)、[小型立形mobile修正前](compatibility-browser-before/vertical-390-second.png) / [修正後](compatibility-browser-after/vertical-390-second.png)。24組全部の一覧と差分結果はブラウザーJSONにある。

旧横形JSONの具体例は、used seed 123456、標準寸法、B +0.013 mm/C −0.017 mm、X=37/Y=−62/Z=81。入力と個体を完全復元したうえで、次の結果となった。新YZを旧値に固定する保存やキャッシュではなく、新しい配置で再計算したことが分かる。新YZの幾何期待値そのものの判定は独立幾何担当の記録を参照する。

|測定|旧版生値 µm → 新版読込後生値 µm|整数表示|
|---|---|---|
|XY|16.958999991467312 → 同値|+17 → +17|
|XZ|8.777749878121147 → 同値|+9 → +9|
|a|9.804016154316141 → 同値|+10 → +10|
|b|3.991137801261785 → 同値|+4 → +4|
|YZ|11.665183324958624 → −17.413251965896908|+12 → −17|

旋盤の保存検査では、合成入力に含まれる未実装Y/A/Cが読込時に0へ戻ることを、精度の変化と誤認しないよう診断用開始/終了stateを保存対象のX/Zに正規化して比較した。実際の旋盤測定生値と全接触座標は正規化前から完全一致していた。アプリや保存仕様をこのテスト都合で変更していない。

ブラウザーの再実行コマンド:

```sh
node tests/browser-horizontal-fixture-compatibility-20261010.cjs before docs/qa-horizontal-fixture-20261010/before/index.html.gz docs/qa-horizontal-fixture-20261010/compatibility-browser-before
node tests/browser-horizontal-fixture-compatibility-20261010.cjs after index.html docs/qa-horizontal-fixture-20261010/compatibility-browser-after docs/qa-horizontal-fixture-20261010/compatibility-browser-before
```

## レイアウト修正との対応

この段階のHTML SHA256は `81af91d648ef304d5a7d411dd1d479e75f83fd851efcadc3676dcd7689e867a2`。初回全件検証の `5231…` から、横形bar小図のa文字yを3→14、計器テーブル文字yを30→29、横形bar詳細図のviewBox高さを142→146とした3点だけが変わった。

現在の2ソースにこの3変更を逆適用すると、初回全件検証時に保存したSHA256へ厳密一致することを独立確認した。他19ソースも同じで、新YZ計算の `reference-measurement-ui.js` は `0b2ebbd5be23f4f03129dc6a24aa0aa140971761d7e0058caae8b992713db07f` のまま。[対応検証JSON](compatibility-final-scope.json)には全最終ソースのSHA256と逆適用一致結果を保存した。全件検証済みの測定・3D・保存コードが変わっていないため、336状態の総当りは重複実行しない。

最終HTMLを新しいChromiumで開き、小型立形/旋盤mobile両ページ4画面、そして小型立形/旋盤/横形の旧JSONアップロード→再ダウンロードを追加確認した。[最終限定ブラウザー記録](compatibility-browser-final-smoke/results.json)は **21 checks、失敗0、例外0**。4画面すべてが修正前と0 pixel差で、3機種の保存入力・保護測定値も同じだった。古いHTMLのキャッシュを使った確認ではない。

```sh
FIXTURE_COMPAT_SMOKE=1 node tests/browser-horizontal-fixture-compatibility-20261010.cjs after index.html docs/qa-horizontal-fixture-20261010/compatibility-browser-final-smoke docs/qa-horizontal-fixture-20261010/compatibility-browser-before
```

## 厚み中央線合わせの説明追記と最終版

最終HTML SHA256は **`a33e7a9efc3094f41d51bbf48ca541176d8e9984aa3774a5d5ff3ec54edfbf7c`**。独立3D確認で、R走査の両端等指示だけではyawが一意に決まらず、既存式は両端の測定子が厚み中央線を通る横位置合わせも仮定していると判明したため、その手順を追加した。

`81af…` から変更されたsrcは `reference-measurement-ui.js` だけだった。横形第2intro、横形scanNote、YZカードのR合わせ手順の3文字列を逆置換すると、追記前に固定した**ファイル全文へ完全一致**し、SHA256も `0b2ebbd5…` へ戻る。他20ソースは完全に同じだった。最終referenceのSHA256は `a92c8e9e7666d4bec5c585e64d01fcd9dfac8ac07cad749bf67a93dcf93f4e1d`。

[最終説明変更の対応JSON](compatibility-yaw-copy-scope.json)に、追加前後の正確な文字列、逆適用全文一致、全最終srcのSHA256と確認時刻を保存した。支持入力、測定計算、3D、小図を描く処理、保存、乱数のコードはこの追記で変わっていないため、336状態の再総当りは行っていない。説明切替26状態と最終画像はそれぞれの独立担当が最終HTMLで再確認する。本担当のVM比較は、未実装軸の診断値に関する過剰検査を是正した後、336状態・全7旧保存・42個体すべて合格した記録を保持している。

VMのDOM補助環境と実Chromiumの記録は区別する。実ブラウザー確認も実機の精度認定ではない。新YZの独立期待値と横形の実ブラウザー操作は別担当の記録を参照する。
