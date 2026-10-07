# 独立確認: 横形パレット材料点変換の抽出

修正担当から独立した確認担当が、旧コミット `127b3ece7da64cab5d1fb9bbb998313d739fd905` を `git archive` で `/tmp/training-tools-old127` に展開し、旧アプリと修正アプリを別VMで実行した。アプリソースの編集はしていない。

今回の比較目的は、`horizontalPalletPoint` の共有化が既存模型の外観・運動を変えていないことの検証。新ヘルパーやその符号から期待値を生成せず、旧コミットの完全な `displayedModelPoint` 経路を比較対象にした。これは機械構造の妥当性を旧版で保証する試験ではない。物理妥当性の独立点検は前回の `../qa-coordinate-audit-20261007/kinematics-audit.md` に分離されている。

結果:

- 横形 `pose=work` 全192頂点を比較。生の頂点形状・可動軸グループも新旧一致。
- 支持5条件: 理想、共通平面傾き、ねじれ、中間支持の局所偏差、不規則偏差。
- 固有誤差3条件: なし、新品seed=1、中古seed=123。
- 表示誇張off/on（物理factor=1と表示誇張）。
- 支持寸法3条件: 標準、0.5×20 m、20×0.5 m。
- 軸位置5条件: 中央、全軸+100、全軸−100、非対称中間2組。
- コラム配置はX=35、Z=−21で固定。
- 計450条件・86,400頂点比較。最大位置差 **3.58036839697957×10⁻¹⁵ m**。
- 許容差1×10⁻¹⁰ mを超える比較は **0**。丸め誤差内で旧版と同じ模型変換。
- `src/spindle-sweep.js` と `src/spindle-sweep-ui.js` は旧コミットとSHA-256が完全一致。4点エンジンとUIは変更されていない。

再現:

```sh
mkdir -p /tmp/training-tools-old127
git archive 127b3ece7da64cab5d1fb9bbb998313d739fd905 | tar -x -C /tmp/training-tools-old127
node docs/qa-coordinate-fix-20261007/independent-horizontal-transform.cjs
```

機械判定データ: `independent-horizontal-transform.json`。実行スクリプト: `independent-horizontal-transform.cjs`。

範囲外: この比較だけでは新しい有限測定の固定具仕様・測定値の正しさを保証しない。実ブラウザーでの画面比較と新しい有限走査の独立幾何検証は別担当で行う。
