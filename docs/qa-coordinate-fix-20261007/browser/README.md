# 修正後の独立ブラウザー確認

アプリ修正担当とは別のブラウザー担当が、Chromium `/usr/bin/chromium` とPlaywrightで確認。アプリ・CSSは編集していない。ローカル `index.html` をそのまま返す経路で描画しており、公開サイトへのデプロイ確認ではない。

修正前HTMLは `../before-index.html`（main `127b3ec`・監査時公開HTMLと同一）。

- 修正前SHA-256：`870555339651834768d73e9e6692a08bda983fedab98cf82235e3560654fce84`
- 今回確認SHA-256：`6ac3b47542429ddb4f665f3e33a05d9b0bf1c4525f0afaa317352d4086a48a79`

## 結果

`verify.cjs` / `results.json`：**221検査成功、pageerrorなし**。

- 全7機種・19面、1440×1000／390×844／320×568／568×320の計28画面。
- R/S、展開図の右と上、相対走査方向を、機械構造の監査から手書きした期待表と照合。期待表をreferenceSetupや描画関数から生成していない。旋盤にはR面やY軸を追加していない。
- 0と接触が同じS面にあり、相対走査矢印の始終点が対応。旧局所図のprojection、zeroLocation、gain、tip等の属性は新live図に残っていない。
- scene、上下操作、軸タブ、設定ボタンの配置・寸法は修正前と1 px以内で一致。画面外への横方向はみ出しなし。SVG文字の範囲内収容を確認。
- 全7機種の局所角度差は旧版と一致。有限走査値は修正対象なので旧値との一致を要求していない。
- カメラ・zoom・誇張を変更しても読みは不変。支持+0.01→-0.01 mmで状態を再現。
- 旧版から実際にダウンロードしたJSONを新実装のfile inputへ渡し、支持・軸位置と新実装の測定値を再現。新実装自身の実ダウンロード→読込も確認。保存は `*-before-state.json` / `*-after-state.json`。
- 5軸のAのみ／Cのみ／両方の非ゼロ姿勢で3面を抑止し、A=C=0へ戻すと再現。
- 4方向ダイヤルの手前面外時に4つのDOM数値をすべて抑止。小型・固定門形は実際の軸位置で確認。移動コラム・移動門形・5軸は調べたX/Y 9地点で手前面外にならなかったため、検査内で面外フラグを一時注入してUI伝播のみ確認。この3機種の物理的な面外配置を証明する試験ではない。横形・旋盤へのダイヤル追加なし。

`axis-labels.cjs` / `axis-labels.json`：**40検査成功**。全7機種の直線軸両端で実inputイベントを発火し、部材位置、方向ラベル、aria-valuetext、左右端説明が手書きの物理方向表と一致。NC指令方向とは扱っていない。

## 高い支持差と極端な寸法

`stress.cjs` / `stress.json`：7機種×6状態＝**42状態・114面**。

- 標準寸法の正負支持ねじれ、0.5×20 mと20×0.5 m、支持高上限±0.5 mmを含む。
- 計器本体のSVG枠外は0件。
- 初回暫定修正版では、負のXY読みで本体が「相対」の文字を覆う問題を独立確認し、修正担当へ返した。証跡は `found-before-label-fix/`。ここにある画像は最終版ではない。
- 最終版ではこの重なりが解消した。`stress-compact-standard-minus-XY.png` が対応する確認画像。
- 最終stressの文字bboxと本体bboxが交差する候補は、文字「下」「手前」の字形下側の空白による。候補を高DPI画像で目視し、−563 µmの例を含め字形と本体が離れていることを確認した。bbox判定を無条件の物理・視覚的失敗にはしていない。

## 数値が変わった横形の同一fixture

`material-fixture.cjs` / `fixture-state.json` は前回監査と同じprofile=null、全軸0、支持ねじれを再現。UIへ期待値や注釈は追加していない。

- 修正前：XZ内部値約0 µm、表示0 µm（前回監査フォルダの同名画像）。
- 修正後：XZ内部値 **−14.62595879211416 µm**、表示 **−15 µm**。
- 画像：`horizontal-material-fixture-main.png` と `horizontal-material-fixture-XZ-live.png`。

このfixtureには1 µm未満の支持高端数があり、`fixture-state.json` は通常保存JSONとしての読込用ではなく診断状態の記録。独立した解析期待値との比較は別担当の `../independent-review.md` を参照。

## 再実行と画像

リポジトリ直下から次を実行する（この環境ではChromiumのsocket制限のため承認済みsandbox外実行が必要だった）。

```sh
node docs/qa-coordinate-fix-20261007/browser/verify.cjs
node docs/qa-coordinate-fix-20261007/browser/axis-labels.cjs
node docs/qa-coordinate-fix-20261007/browser/stress.cjs
node docs/qa-coordinate-fix-20261007/browser/material-fixture.cjs
```

`*-pc/mobile/narrow/short-landscape.png` は全画面、`*-XY/XZ/YZ-live.png` は既存測定枠の切り出し。DPIだけを上げて記録し、UI寸法やDOMは画像用に拡大改変していない。実携帯端末・Safariは未確認。これらの状態再現性・表示試験だけで実物の取付けや測定配置の妥当性が証明されたとは扱わない。
