# 固有測定・保存の独立監査

対象は全7機種の回転TIR根元／300 mm先、フライス系6機種の上面9点（左中央0）とrange、個体seed、保存schemaと旧JSON読込。担当は計算修正担当から独立した監査・UI担当。

## 何を独立に確認したか

`tests/audit-intrinsic-save-20261011.cjs` は保存済seedの決定的乱数仕様から偏心・傾き・9点生高さを復元する。これは固有入力の契約であり、`IntrinsicInspection` の測定結果は期待値に使わない。

- TIR期待値は半径25,000 µmの円と固定径方向の直線の交点を、回転偏心の相反する位相で求め、その表面位置差を取る。製品の `2*hypot` を期待値へ転用しない。
- 上面期待値は `[1,x,y]` の設計行列から一般の3×3正規方程式を消去法で解き、最小二乗平面を差し引いて左中央を0にする。製品の対称格子用係数 `/9`・`/6` を期待値へ転用しない。
- 生値は `1e-8 µm` 以内、実DOMの9点整数・TIR整数・最大差整数と比較する。
- 全50支持を実ボタンで粗+0.010→−0.010 mm、微+0.001→−0.001 mm、計200操作。支持入力が実際に届いたことを確認し、各生値・実DOM文字列・独立期待値をJSON/CSVへ保存する。
- 全7機種で軸端・寸法変更・カメラ・誇張・5軸A/C非0後も固有値とseedの不変を確認する。
- 修正前JSONを実ファイル入力から読込み、入力・個体・固有値・schemaを照合し、実ブラウザーのダウンロードを取得する。小型の従来version 2（supportLayoutなし）も確認する。

これは固有値の正当な不変性の確認。未定義の「取り付けたままのダイヤル総指示」の独立計算ではない。器具を追加せず、未定義をそのまま報告する。

## 取付保持指示と固有値が違う理由

たとえば偏心中心 `(3,4) µm` の円を一周すればTIRは10 µm。同じ円全体が計器に対して径方向へ8 µm移動しても、一周中にその移動が一定なら最大と最小が同じだけ動き、TIRは10 µmのまま。一方、回転位相を固定したまま最初のゼロを保持すれば指示は8 µm変わる。したがってTIRの不変から支持操作後の静止した針の不変を推論できない。

9点も同様。全点へ `91+13x-7y µm` の平面を加えた場合、固定測定器の生高さは点ごとに変わるが、最小二乗平面除去後の残差とrangeは不変。左中央でゼロを取り直すだけでは傾きは消えず、傾斜除去が別工程として必要。この数学的処理を物理的な計器取付けと同一視しない。

## 修正前の記録

- ソース: `main baede5bfafed034f5f7d21ec9957e344dc7c8c98`、HTML SHA256 `831edb95f7dbf1095563c1c8c289f52219bcf764937618c6079d4c4d32f7fa65`。
- Linuxの実Chromium、390×844 / 1280×1000。実iPhone/Safariではない。
- 全7機種・472チェック合格。証拠: [JSON](intrinsic-save-audit/before/results.json)、[CSV](intrinsic-save-audit/before/values.csv)。
- 各機種seed=123456・中古・支持平坦・XYZAC=0の同じ入力。TIR/上面生成は機種に依存しないため、この入力では全7機種の同じ固有成分が一致する。異機種の同じseed一致を機械の精度仕様とは扱わない。

|固有測定|操作前生値 µm|全支持操作後生値 µm|実整数表示|独立期待値 µm|
|---|---:|---:|---|---:|
|TIR根元|11.98505076393485|同値|12|11.98505076393485|
|TIR300 mm|14.39028429697391|同値|14|14.39028429697646|
|上面・奥左|3.096640039235353|同値|+3|3.0966400392353535|
|上面・奥中|-1.8686829255893826|同値|-2|-1.8686829255893822|
|上面・奥右|-4.947506673634052|同値|-5|-4.947506673634052|
|上面・左中央|0|同値|0|0|
|上面・中央|2.0175658287480474|同値|+2|2.017565828748048|
|上面・右中央|10.983125671744347|同値|+11|10.983125671744347|
|上面・前左|3.435778740793466|同値|+3|3.4357787407934666|
|上面・前中|-7.652128082700074|同値|-8|-7.652128082700074|
|上面・前右|0.49679978191852525|同値|0|0.49679978191852614|
|上面range|18.63525375444442|同値|19|18.63525375444442|

表の独立値の精密値はJSONの `independent.raw` が正本。CSVには支持番号・操作量・符号・前後生値/整数/期待値を全件記録。最初の通常sandbox内Chromium起動は `setsockopt: Operation not permitted` で失敗し、許可レビューを通した同コマンドで完走した（製品不具合ではない）。

画像は同じ中古seed=123456、支持平坦、XYZAC=0の測定欄。旋盤は1ページ目のTIR、それ以外は2ページ目のTIR/上面。見た目だけの比較ではなく、直前に取得した `machines[].baseline` の生値・実DOM整数・入力に対応する。

|機種|390 px 修正前→後|1280 px 修正前→後|
|---|---|---|
|小型立形|[前](intrinsic-save-audit/before/vertical-intrinsic-390.png) → [後](intrinsic-save-audit/after/vertical-intrinsic-390.png)|[前](intrinsic-save-audit/before/vertical-intrinsic-1280.png) → [後](intrinsic-save-audit/after/vertical-intrinsic-1280.png)|
|横形|[前](intrinsic-save-audit/before/horizontal-intrinsic-390.png) → [後](intrinsic-save-audit/after/horizontal-intrinsic-390.png)|[前](intrinsic-save-audit/before/horizontal-intrinsic-1280.png) → [後](intrinsic-save-audit/after/horizontal-intrinsic-1280.png)|
|移動コラム|[前](intrinsic-save-audit/before/travel-intrinsic-390.png) → [後](intrinsic-save-audit/after/travel-intrinsic-390.png)|[前](intrinsic-save-audit/before/travel-intrinsic-1280.png) → [後](intrinsic-save-audit/after/travel-intrinsic-1280.png)|
|固定門形|[前](intrinsic-save-audit/before/gate-intrinsic-390.png) → [後](intrinsic-save-audit/after/gate-intrinsic-390.png)|[前](intrinsic-save-audit/before/gate-intrinsic-1280.png) → [後](intrinsic-save-audit/after/gate-intrinsic-1280.png)|
|移動門形|[前](intrinsic-save-audit/before/gantry-intrinsic-390.png) → [後](intrinsic-save-audit/after/gantry-intrinsic-390.png)|[前](intrinsic-save-audit/before/gantry-intrinsic-1280.png) → [後](intrinsic-save-audit/after/gantry-intrinsic-1280.png)|
|5軸|[前](intrinsic-save-audit/before/five-intrinsic-390.png) → [後](intrinsic-save-audit/after/five-intrinsic-390.png)|[前](intrinsic-save-audit/before/five-intrinsic-1280.png) → [後](intrinsic-save-audit/after/five-intrinsic-1280.png)|
|旋盤|[前](intrinsic-save-audit/before/lathe-intrinsic-390.png) → [後](intrinsic-save-audit/after/lathe-intrinsic-390.png)|[前](intrinsic-save-audit/before/lathe-intrinsic-1280.png) → [後](intrinsic-save-audit/after/lathe-intrinsic-1280.png)|

## 保存への影響

保存は支持・部材の計算モデル名、schema version、機種・モード・寸法・支持入力・軸位置・個体profile・参考最良支持を含む。器具配置・初期ゼロ・測定値は含まない。固有値は `machineProfile.version=1 / seed / condition` から再現する。今回の固有計算は変更しないので全数値とseed関係を維持する。

小型の追加姿勢撤去や旋盤面の有限接触確認は測定の再計算を変えるが、支持補間・個体生成・補助評価の入力を変えない。保存 `calculationModel` とschemaは維持し、旧JSONは受け入れた上で新しい測定仕様で算出する。旧ファイルが過去の針指示やゼロを復元するとは説明しない。

既存の独立テスト `node tests/check-intrinsic-inspection.cjs` も1,845チェック合格。円接触の符号側・偏心と傾きの相殺、Gram-Schmidt残差、既存個体profileハッシュを確認した。

## 修正後の再確認

HTML SHA256 `a70468b143711048184e8983e0e5dc823da7db4fa3fa2babdd44a96ac081ba6c` に対し、同じ全7機種・全50支持・200実操作・472チェックを再実行し全合格。実DOM整数を直接収録したCSVは前後それぞれ2,160行。証拠は [after/results.json](intrinsic-save-audit/after/results.json)、[after/values.csv](intrinsic-save-audit/after/values.csv)、[前後比較](intrinsic-save-audit/comparison.json)。

全7機種で初期生値・実DOM整数、200支持操作後の全固有生値・整数・独立期待値が修正前と一致。保存JSONの全基準record、旧JSONから復元したprofileも一致した。上表の数字は修正後も同じであり、支持応答を見せるために固有値を動かす処理は加えていない。

修正は固有値の定義の説明だけ。TIRを固有成分、上面を傾き除去後として示し、取付けと最初のゼロを保持した瞬間の総指示とは区別した。小型・門形・5軸・旋盤の390 px実画像を目視し、数字・左中央ゼロ・range・注記が画面幅内に収まることを確認。画像の字は従来の測定欄サイズを維持しており、実機の器具取付けや実iPhoneでの判読を検証したものではない。
