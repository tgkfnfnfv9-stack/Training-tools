# 全7機種の常時座標図・水準器の寸法統一

対象：<https://tgkfnfnfv9-stack.github.io/Training-tools/>。

作業開始時のmainは `ee23b8b`（前回アプリ公開コミット `ffd1544`）。開始時の公開HTMLとローカルHTMLのSHA-256を確認し、変更前の同一HTMLを保存して比較した。変更前SHA-256は `79d493538b295bf4453d63ffdd8d97edc20494a0445a81b260c99654a333c3ce`。

今回の目的は、同じ画面サイズで全7機種の常時座標図の板の幅・高さを揃え、横・縦の水準器本体の長辺・短辺を入れ替えた同じ寸法にすること。SVG枠の一致や長辺だけの一致では判定しない。修正担当と独立確認担当を分け、最終固定ビルドで検証した。

最終アプリHTML SHA-256：`2e0af6309d5607fb8068e50e95c9ae33d7b0961eba7eea50f9536cce68aa4d72`。アプリコミットは `49641892dc5d8a5ae2654e9f0c8d42f2140124d4`。GitHub Pages成功と公開HTMLの完全一致を確認し、公開後の独立再検証も完了した。

## 変更した表示

- 常時板の固定投影の外側へ表示専用の補正を置き、板pathの外接幅88・高さ28（SVG内の単位）を全機種・面で共通化した。文字にはこの縦横補正を掛けていない。
- SVGのviewBox・描画高さを機種間で揃え、横形・旋盤などダイヤルのない機種の高さ分岐による実図の差も解消した。画面サイズに応じた共通縮小は残している。
- 白・オレンジ・黒の点は補正後も真円にし、矢印の先端は共通寸法で描く。線は `non-scaling-stroke` にして図間の太さの違いを抑えた。
- 横・縦のvialは共通の長さと幅を使い、縦だけ90度入れ替えた寸法にした。短い画面は両方同じ寸法へ縮小し、模型・固定操作の領域を保持する。

計算エンジン・保存形式・基準位置・基準軸・測定方向・符号に変更はない。表示専用補正の値を測定計算へ戻していない。直角値は現在位置の局所的な軸の角度差を300 mm換算する既存仕様のまま。実際に300 mm走査した測定とは説明していない。図のO・基準0とダイヤルの手前0も別の基準のまま。

## 実図・水準器の測定寸法

板pathに対して `getBBox()` と全祖先の `getScreenCTM()` を使い、画面上の外接幅・高さを測定した。SVG枠の寸法ではない。全7機種の19面（旋盤はXZのみ）を、同一ビューポートごとに比較した。板幅と板高さの最大差は約 `0.000012 px` で、0.1px以内の一致条件を満たした。

下表の変更前は小型立形のXY／XZ／YZ。変更後は全7機種・19面に共通の値。vialは横の幅×高さ／縦の幅×高さ。単位はCSSピクセル。

|ビューポート|変更前の板（小型立形）|変更後の板（全機種・面共通）|vial 横／縦|模型キャンバス高さ（小型立形）|
|---|---|---|---|---|
| pc-1280x800 | XY 98.98×15.63 / XZ 47.79×23.89 / YZ 33.04×36.93 | 92.33×29.38 | 74×24 / 24×74 | 293.00 → 293.00 |
| mobile-390x844 | XY 52.58×8.30 / XZ 25.39×12.69 / YZ 17.55×19.62 | 49.05×15.61 | 74×24 / 24×74 | 319.56 → 319.56 |
| mobile-320x568 | XY 52.58×8.30 / XZ 25.39×12.69 / YZ 17.55×19.62 | 49.05×15.61 | 52×16 / 16×52 | 143.00 → 143.00 |
| mobile-320x480 | XY 46.40×7.33 / XZ 22.40×11.20 / YZ 15.49×17.31 | 43.28×13.77 | 30×14 / 14×30 | 110.00 → 110.00 |
| landscape-844x390 | XY 58.77×9.28 / XZ 28.37×14.19 / YZ 19.62×21.93 | 54.82×17.44 | 30×14 / 14×30 | 168.00 → 168.00 |
| landscape-568x320 | XY 55.90×8.83 / XZ 28.37×14.19 / YZ 19.62×21.93 | 54.82×17.44 | 30×14 / 14×30 | 98.00 → 98.00 |

変更前は機種間にも差があり、例えばPCの横形XZ・旋盤XZは108.26×17.09px、横形YZは15.48×44.63pxだった。変更後はこれらも92.33×29.38pxに一致する。すべての測定値は [before-browser-results.json](before-browser-results.json) と [local-uniform-browser-results.json](local-uniform-browser-results.json) に記録している。

長辺を一律に拡大するのではなく、既存の大きい図に近い幅を残しながら、細い図・縦だけ大きかった図を同じ幅・高さへ整えた。文字は一律に大きくしていない。常時表示の図外見出しは引き続き削除したまま。

## 最終ビルドで今回実施した検証

|検証|範囲|結果|
|---|---|---|
|既存自動検証|最終HTMLハッシュを開始・終了で固定確認|38/38本成功|
|新しい寸法統一Chromium検証|7機種×6サイズ×開閉＝84表示、幅・高さ・矢印・vial・固定領域|385項目成功、JavaScriptエラー0|
|常時図・操作のChromium再検証|84表示＋短い縦横の微調整14表示、正負95ケース、全7機種のファイル保存読込等|929項目成功、JavaScriptエラー0|
|ダイヤルのChromium再検証|対応5機種、6サイズ、軸操作・面外・5軸A/C・保存読込|650項目成功、JavaScriptエラー0|
|変更前後の計算完全一致|同じ個体・支持高さ・軸位置、全7機種|7/7同一|
|Chromium疑似タッチ|390×844・320×568・844×390・568×320|4/4成功|

板の幅と高さの両方、および基準・測定方向の矢印両腕の実長を全19面で比較した。横vialの幅＝縦vialの高さ、横vialの高さ＝縦vialの幅を、開閉84表示で0.02px以内の一致条件で確認した。

SVGは文字の実描画矩形と、全path・line・circleの境界を確認した。外側の表示補正と円点自身の補正も含め、線の `non-scaling-stroke` は実画面の太さとして扱った。最終検証で文字重複・切れは0件。既存の測定基準204項目も、単独の内側投影だけではなく全祖先変換と点自身の変換を合成して、描画境界を確認するよう強化した。基準・方向・符号・局所角度の期待値は維持している。

模型・固定水準器・軸操作・支持選択の内部スクロール・下げる／上げるは画面内で使用可能。基準図の開閉で模型・水準器・固定操作の矩形と測定値が一致した。最小の模型キャンバス高さは98px。小型立形の模型高さは6サイズすべて変更前と同じだった。全機種・開閉84表示での変更前との差は−2～＋36pxで、横形・旋盤の携帯横だけ2px減、その他は同じか増加した。

全7機種で支持調整を戻すと図と値が復元し、実ファイルのダウンロード／ファイル入力による読込と、ページ再読込後の保存状態も再現した。視点・ホイールズーム・設定・表示誇張で測定値が変化しなかった。旧HTMLと同じ状態の `levelRecord()`、計算pairs、ダイヤルcardinalと両DOM実値は全7機種で完全一致した。

ダイヤルの右・奥・左・手前 基準、手前0と他3点との差、手前面外時の全数値抑止、対応5機種、固定門形15点を含む全7機種の支持点数を保持している。

疑似タッチではピンチで模型倍率1→1.6、単指ドラッグで視点変更、ダブルタップ後のページ倍率1と測定値の不変性を確認した。ただし **スマートフォン実機での指操作は未実施**。これらは実際のChromiumにCDPでタッチを送った試験で、物理端末・Safari・安全領域・ブラウザーアドレスバー伸縮の確認とは別である。

## 根拠ファイル

- [automated-results.json](automated-results.json)：38本の出力・終了値・開始終了HTMLハッシュ。
- [before-browser-results.json](before-browser-results.json)：旧mainの84表示と実寸。
- [local-uniform-browser-results.json](local-uniform-browser-results.json)：385項目、全19面の板・矢印・vial・全描画要素の寸法。
- [local-regression-browser-results.json](local-regression-browser-results.json)：929項目、支持・正負・操作・保存読込の再検証。
- [dial-browser-results.json](dial-browser-results.json)：650項目。
- [calculation-invariance.json](calculation-invariance.json)：変更前後の計算完全一致。
- [mobile-gesture-results.json](mobile-gesture-results.json)：疑似タッチ4サイズと物理端末未確認の明記。

専用検証は `UNIFORM_BASE_URL` と `UNIFORM_OUTPUT` を指定して `node tests/browser-uniform-instruments.cjs`。`UNIFORM_BASELINE=1` は変更前寸法を取得する。公開HTMLを既存のシステムTLS検証付きcurlで取得しChromiumで描画する場合は `UNIFORM_DOCUMENT_FILE` を指定し、JSONの `documentTransport` に取得方法を記録する。回帰検証は `tests/browser-live-diagrams.cjs` の `LIVE_BASE_URL`、`LIVE_DOCUMENT_FILE`、`LIVE_OUTPUT` を使う。

## 公開後の独立再検証と画面

[アプリ公開コミット 49641892](https://github.com/tgkfnfnfv9-stack/Training-tools/commit/49641892dc5d8a5ae2654e9f0c8d42f2140124d4) の [Pages run 37462208732](https://github.com/tgkfnfnfv9-stack/Training-tools/actions/runs/37462208732) は `completed / success`。公開URLからcurlでHTTP 200・TLS検証成功（`ssl_verify_result=0`）のHTMLを取得し、上記最終HTMLとバイト完全一致を確認した。親担当によるクエリー無しURLの取得も同じHTMLだった。

公開HTMLで寸法統一 **385項目／84表示** と回帰 **929項目／98表示** を独立再実行し、すべて成功、JavaScriptエラー0。公開検証でも板幅・高さ・矢印・水準器の全機種一致、切れ・文字重複なし、支持調整・保存読込・視点／ズーム／設定不変を確認した。

環境のChromiumは公開サイトへの直接TLS接続で証明書エラーになるため、既存のシステムTLS検証付きcurlで取得したHTMLを、公開originへのChromiumナビゲーションに `route.fulfill` で渡して描画した。証明書検証の無効化や信頼ストア変更は行っていない。これはTLS検証済み公開HTMLの実Chromium描画・操作確認であり、Chromium自身の直接TLS取得成功とは区別している。

根拠は [publication.json](publication.json)、[published-uniform-browser-results.json](published-uniform-browser-results.json)、[published-regression-browser-results.json](published-regression-browser-results.json)。

比較画面は旧mainと公開後を同一の個体・支持高さ・軸位置で撮影した実Chromiumスクリーンショット。左が変更前、右が今回公開後。表示内容を加工せず2列のHTMLに置き、再びChromiumで撮影した。4機種×4サイズの16枚をすべて目視確認した。全7機種×6サイズは上記JSONで検証している。添付画像は受領できていないため、比較の変更前は旧mainの実画面である。

|機種|PC 1280×800|携帯縦 390×844|320px 320×568|携帯横 844×390|
|---|---|---|---|---|
|小型立形|[比較](comparison--compact--pc-1280x800.png)|[比較](comparison--compact--mobile-390x844.png)|[比較](comparison--compact--mobile-320x568.png)|[比較](comparison--compact--landscape-844x390.png)|
|横形|[比較](comparison--horizontal--pc-1280x800.png)|[比較](comparison--horizontal--mobile-390x844.png)|[比較](comparison--horizontal--mobile-320x568.png)|[比較](comparison--horizontal--landscape-844x390.png)|
|固定門形|[比較](comparison--double--pc-1280x800.png)|[比較](comparison--double--mobile-390x844.png)|[比較](comparison--double--mobile-320x568.png)|[比較](comparison--double--landscape-844x390.png)|
|旋盤|[比較](comparison--lathe--pc-1280x800.png)|[比較](comparison--lathe--mobile-390x844.png)|[比較](comparison--lathe--mobile-320x568.png)|[比較](comparison--lathe--landscape-844x390.png)|

PC／携帯縦横／320px幅の実ブラウザー検証は完了。スマートフォン実機の指操作は未実施で、Chromiumの疑似タッチ検証と区別する。
