# 横形・旋盤の姿勢修正: 保存互換性・他5機種の独立回帰確認

確認担当はアプリコードを変更せず、最新main `cbdcf81a4b3b252d4113621b8361b20640955688` の別作業ツリー `/workspace/Training-tools-before` を修正前の基準にした。過去テストの測定期待値は採用しない。この確認でbaselineとの一致を要求するのは、変更対象外の5機種と、保存入力・個体乱数の契約である。横形・旋盤の修正後精度を旧値に固定する確認ではない。

## 保存の調査結果

- `levelRecord()` は支持高さ、寸法、コラム配置、各軸位置、感度、測定位置、評価長、粗微刻み、誇張状態と固定個体を保存する。**測定生値・画面の精度値・接触ゼロ値は保存しない**。読込後にその版の式で再計算する。
- `machineProfile` はseedだけでなく、seedから再生成できる全固有誤差と初期支持高さを含む。読込検証では全体が再生成結果と一致することを要求する。
- `bestState` に保存するのは寸法・コラム配置と支持高さだけ。読込後の探索では保存支持高さを候補の一つとして現在の式で再評価する。古い目的値・精度値を固定して持ち込まない。
- 横形 `horizontal-guide-v2`、旋盤 `lathe-carriage-v2`。支持配置の識別子を持つ機種はJSON version 3、それ以外は個体ありversion 2。今回、同じ支持高さ・軸位置・個体の意味が保たれる範囲の計算修正では、この識別子を変えて旧JSONを拒否する必要はない。
- 整数µmは絶対値を四捨五入して元の符号を戻す。`±0.5 µm` は `±1`、丸め後0は符号なし`0`。生値を整数に書き戻す処理ではない。

## 専用回帰確認

スクリプト: [check-posture-compatibility-20261009.cjs](../../tests/check-posture-compatibility-20261009.cjs)

対象外の5機種は `vertical` (kind `compact`)、`travel`、`gate` (kind `double`)、`gantry`、`five`。

240状態 = 5機種 × 理想/used seed 123456 × 支持4条件 × 軸3条件 × 誇張on/off。

- 支持: 平坦、B +0.010 mm、`h=0.01xz mm`、`h=0.02x−0.03z+0.01 mm`。ここでx/zは支持設定寸法でのm座標。保存可能な0.001 mm刻みに量子化。
- 軸: 全中央、端の複合状態、非対称状態 `(X,Y,Z,A,C)=(37,−62,81,45,−33)`。存在する軸だけが模型へ作用する。
- 比較: 入力、全3Dメッシュ、全頂点の表示変換後座標、部品ラベル位置、姿勢計算、評価値、物理/表示用接触走査、精度UI文字・markup。大きな配列はSHA256で完全一致を検査する。
- 全7機種 × new/used × seed `0 / 123456 / 4294967295` = 42個体の再生成結果を比較。
- 全7機種の旧JSONを新コードへ読込み、支持高さ・寸法・軸・個体・刻み等の入力が完全復元されることを比較。探索候補 `bestState` の改善だけは許容する。
- 各機種の支持up/downでも固定個体が再抽選されないことを確認。

実ブラウザーでのダウンロード/アップロード、他5機種のPC/mobile両測定ページの画素比較は、別のブラウザー確認担当が記録する。

## 実行記録

修正前取得は成功: [before.json](before.json)。240状態、7保存JSON、42個体。

```sh
node tests/check-posture-compatibility-20261009.cjs capture /workspace/Training-tools-before /workspace/Training-tools/docs/qa-posture-compatibility-20261009/before.json
node tests/check-posture-compatibility-20261009.cjs capture /workspace/Training-tools /workspace/Training-tools/docs/qa-posture-compatibility-20261009/after.json /workspace/Training-tools/docs/qa-posture-compatibility-20261009/before.json
node tests/check-posture-compatibility-20261009.cjs compare docs/qa-posture-compatibility-20261009/before.json docs/qa-posture-compatibility-20261009/after.json
```

初回修正後の比較も成功: [after.json](after.json)。対象外5機種の240状態で、全比較項目が修正前と完全一致した。42個体の生成結果・保存schemaも完全一致。旧JSONは7機種すべてが受入れられ、探索候補以外の入力を完全復元した。

この確認時の生成HTML SHA256は `4a50bd3626ff11be85af14dcb5fd203127332c8b0c1d71d91a9878f3b50d2d0f`。各ソースの対応は [source-hashes.json](source-hashes.json) に記録した。

最終ソースで保存・個体を再確認して成功: [final-inputs.json](final-inputs.json)。全7機種の旧JSON入力を完全復元し、42個体も修正前と完全一致した。各機種の支持up/downで固定個体は変わらなかった。最終HTML SHA256は `0cca74408ba5099f77751161d2f1fb0aede39f6e68e4301f1072e9401f692929`（検証時の別ビルド `/tmp/Training-tools-final-build/index.html`）。

初回240状態の取得後に変わった製品ソースは `src/machine-accuracy-ui.js` だけだった。追加は `if (['horizontal','lathe'].includes(current.kind))` 内の支持境界1e−12 mスナップに限定され、他5機種・共通Leveling solverは変わらないことを差分とSHA256で確認した。このため他5機種の240状態は初回の完全一致結果を保持し、影響する保存再計算だけを全7機種で再実行した。

```sh
node tests/check-posture-compatibility-20261009.cjs capture-inputs /workspace/Training-tools /workspace/Training-tools/docs/qa-posture-compatibility-20261009/final-inputs.json /workspace/Training-tools/docs/qa-posture-compatibility-20261009/before.json
node tests/check-posture-compatibility-20261009.cjs compare-inputs docs/qa-posture-compatibility-20261009/before.json docs/qa-posture-compatibility-20261009/final-inputs.json
```

## この確認の限界

他5機種の完全一致は今回の影響範囲が広がっていないことの確認であり、それらの既存物理モデルの正しさの再認定ではない。VMのDOM補助環境は実ブラウザーではない。横形・旋盤の修正式は、別の独立幾何計算と実ブラウザーで判定する。
