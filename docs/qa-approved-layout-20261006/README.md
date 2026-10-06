# 承認された常時座標図の配置・拡大

対象公開URL：<https://tgkfnfnfv9-stack.github.io/Training-tools/>。

開始時の最新main `80148b0383e30fc1b4f7294484fc2adac1514674` を確認し、このmainのHTMLをgitから保存して比較した。変更前SHA-256は `2e0af6309d5607fb8068e50e95c9ae33d7b0961eba7eea50f9536cce68aa4d72`。比較の変更前は直前mainの実Chromium画面を用いた。

最終アプリHTML SHA-256：`dea483b244de17a551caa442a7558d073a511b56056a8be4c7c14332d0605591`。最終アプリコミットは `bea17b77db4e6fef7ce60972f4c21978671a672e`。公開後再検証は、公開反映後に追記する。修正担当と独立確認担当を分け、修正後の固定HTMLで再検証した。

## 表示の変更と維持した基準

|図|表示上のO・0|表示上の基準辺|比較軸の表示と端の文字|
|---|---|---|---|
|XY|左下|下辺X・右向き|左辺Y・上向き、左上に「Y 左」|
|XZ|左上|上辺X・右向き|左辺Z・下向き、左下に「Z 左」|
|YZ|左上|上辺Y・右向き|左辺Z・下向き、左下に「Z 前」|
|旋盤XZ|左上|上辺主軸Z・右向き|左辺X・下向き、左下に「X 左」|

「左」「前」は今回承認された説明図の配置を識別する記号。機械固有の基準軸・測定方向・NC軸・測定値の符号を変更する指示ではない。常時図の説明用表示投影だけを置き換え、内側の測定座標、元の物理投影、data属性を維持した。旋盤は上辺をXと誤表示せず、既存の主軸Z基準を保っている。

[前回の測定基準資料](../measurement-reference-20261006.md) の機種固有の物理基準表は変更していない。現在位置の局所的な軸の角度差を300 mm換算する計算のまま。実際に300 mm走査した結果とは説明していない。直角図のO・0と、ダイヤルの手前0は別の基準。保存形式・自由な基準変更機能にも変更はない。

図外の繰り返し説明・大きな見出しを隠し、常時欄は図・現在値・小さな「300 mm・µm」・詳細を開く「▽」へ整理した。常時図内の反復300 mm表記は短い共有表記へ移し、詳細図の300 mm換算点と説明は維持した。「時計回り90度」の表示は追加していない。図を広げるためviewBox余白と表示高さを調整し、文字には板の縦横補正を掛けていない。水準器の横縦長短辺の一致は維持した。

## 実図形の変更前後

板pathの `getBBox()` に全祖先の `getScreenCTM()` を適用して、画面上の板幅・高さを測定した。SVG枠だけの寸法ではない。同じviewportで全7機種・19面の幅と高さは一致する。幅・高さの最大差は0.000014px以内。

単位はCSSピクセル。幅・高さの増加率と面積比は全機種・面で共通。模型欄は小型立形のキャンバス高さ。

|画面サイズ|変更前の板|変更後の板|幅 / 高さの増加|面積比|模型高さ|
|---|---|---|---|---|---|
|pc-1280x800|92.33×29.38|111.47×35.47|20.73% / 20.73%|1.4576倍|293.00→307.00|
|mobile-390x844|49.05×15.61|61.60×19.60|25.59% / 25.59%|1.5772倍|319.56→314.56|
|mobile-320x568|49.05×15.61|61.60×19.60|25.59% / 25.59%|1.5772倍|143.00→136.00|
|mobile-320x480|43.28×13.77|55.73×17.73|28.78% / 28.78%|1.6584倍|110.00→94.00|
|landscape-844x390|54.82×17.44|67.47×21.47|23.07% / 23.07%|1.5146倍|168.00→165.00|
|landscape-568x320|54.82×17.44|67.47×21.47|23.07% / 23.07%|1.5146倍|98.00→95.00|

携帯縦では板幅・高さが約26%増え、面積は約1.58倍。320×480では両辺約29%増、面積約1.66倍。PCは両辺約21%増。各図と±値は同じ項目に置き、文字を一律に大きくしていない。

模型の高さは全84表示で−16～＋14pxの変化があり、最小94px。模型・固定水準器・軸操作・支持点選択・下げる／上げるを画面内で使えることを確認した。320×480では小型立形の模型が110→94pxになり、常時図拡大に領域を使っている。この減少は隠さず寸法と比較画面に記録する。固定操作は44pxを保持し、基準詳細の開閉で模型・水準器・操作矩形を消さない。

## 最終ビルドの独立検証

|検証|範囲|結果|
|---|---|---|
|既存自動検証|38本、開始・終了のHTMLハッシュ固定|38/38本成功|
|承認配置Chromium検証|84開閉＋19面×3サイズ×5符号＝285表示|1192項目成功、JSエラー0|
|図寸法・水準器Chromium|7機種×6サイズ×開閉＝84表示|385項目成功、JSエラー0|
|既存常時図・操作Chromium|84表示＋微調整14表示、正負95、全7機種保存読込等|929項目成功、JSエラー0|
|ダイヤルChromium|対応5機種×6サイズ、軸・面外・5軸姿勢等|650項目成功、JSエラー0|
|変更前後の計算完全一致|同一個体・支持高さ・軸位置、全7機種|7/7一致|
|Chromium疑似タッチ|390×844・320×568・844×390・568×320|4/4成功|
|計算・保存・ダイヤルモジュール|6ファイルの開始前後SHA-256|6/6完全一致|

配置検証は独立にOの板の角位置、基準辺の右向き、比較軸の上下、端の全文ラベルを期待し、実際の点・線のCTM座標で確認する。inner atan2から復元した符号付き角度は、従来gain/limitに厳密に一致。画面上の現在線の基準辺への内積と理想終点からの左右差も数値の正負に一致し、＋の左側／−の右側へ動くことを確認する。ゼロ状態のCTMによる1e-6px程度の丸めには0.001px許容を使い、物理角度・生値の期待は変更していない。

文字の実描画矩形と全path・line・circleの境界を確認し、点自身の補正、矢印先端、non-scaling-strokeの実太さも含めてclipと文字重複を検証する。XY/XZ/YZの板幅・高さ、矢印の先端両腕の実長、横vial幅＝縦vial高さ・横vial高さ＝縦vial幅の一致を確認した。

全7機種で支持調整を戻すと図と値が復元する。実ファイルのダウンロード／入力による保存読込、再読込の保存状態、視点・ホイールズーム・設定サイドバー・誇張表示による数値不変を再検証した。ダイヤルは右・奥・左・手前 基準を保ち、角度表記なし、手前0と他3点の差、手前面外時の全数値抑止を維持。横形・旋盤へ追加していない。固定門形15点を含む支持点数も保持した。

旧「局所300 mm換算」本文へのexact期待は、承認された「300 mm・µm」の厳密期待へ更新した。局所角度・実走査ではない意味は既存の詳細説明・ariaで別に確認する。live内の300 mm textへの期待は、data長さ0.3mと共有表示へ移した。詳細SVGの「300 mm」「換算点」は厳密に残ることを強化した。誤った共有単位や数値漏れを挿入するmutation試験は継続している。全38本を最終HTMLで実行し、37本は成功。残る1本の旧300 mm marker・裸の軸名期待を承認表示の厳密期待へ更新し、その1本を再実行して77項目成功を確認した。他37本とアプリHTMLは同じまま。初回の失敗と再検証はJSONへ記録した。

模型の旧比90%という前回の任意条件は、今回の拡大に使う領域交換に合わせ、画面内の使用可能条件・90px最低高さ・44px操作・実寸差の記録へ変更した。clip判定の0.6px許容は緩めず、検出したYZ「Z 前」の下端超過は実装を修正して解消した。

実ブラウザーはChromium。疑似タッチで模型ピンチ倍率1→1.6、単指ドラッグの視点変更、ダブルタップ後のページ倍率1、測定値不変を確認した。**スマートフォン実機で指操作は未実施**。物理端末のSafari・安全領域・アドレスバー伸縮の確認とは区別する。

## 根拠ファイルと画面

- [before-browser-results.json](before-browser-results.json)：開始時mainの84表示・実寸。
- [automated-results.json](automated-results.json)：38本の出力・終了値・固定ハッシュ。
- [local-approved-layout-results.json](local-approved-layout-results.json)：承認配置・角度と画面符号・実寸比。
- [local-uniform-browser-results.json](local-uniform-browser-results.json)：385項目・全機種の板／矢印／水準器一致。
- [local-regression-browser-results.json](local-regression-browser-results.json)：929項目・支持・正負・保存読込・操作。
- [dial-browser-results.json](dial-browser-results.json)：650項目。
- [calculation-invariance.json](calculation-invariance.json)：全7機種の変更前後完全一致。
- [calculation-module-hashes.json](calculation-module-hashes.json)：6モジュールのバイト不変。
- [mobile-gesture-results.json](mobile-gesture-results.json)：実機と区別した疑似タッチ4サイズ。

## 公開後の独立確認

[公開アプリコミット bea17b77](https://github.com/tgkfnfnfv9-stack/Training-tools/commit/bea17b77db4e6fef7ce60972f4c21978671a672e) の [Pages run 37509231708](https://github.com/tgkfnfnfv9-stack/Training-tools/actions/runs/37509231708) を独立にAPIで確認し、`completed / success`、head SHAも同じだった。クエリー無しの公開URLを独立curlで取得し、HTTP 200、既存のシステムTLS検証成功（`ssl_verify_result=0`）、最終HTMLとバイト完全一致を確認した。

公開originで承認配置 **1192項目（84開閉＋285正負表示）**、寸法統一 **385項目（84開閉）**、回帰 **929項目（98表示）** を再実行し、全て成功・JavaScriptエラー0。通常表示と正負の文字・矢印・点・線のclip／文字重複0、実図拡大、全機種・面の実寸一致、水準器、支持戻し、保存読込、視点・ズーム・設定不変を再確認した。

この環境のChromiumは公開サイトへの直接TLS接続で証明書エラーとなるため、既存システムTLS検証付きcurlで取得した公開HTMLを、公開originへのChromiumナビゲーションに `route.fulfill` で渡した。証明書検証の無効化や信頼ストア変更は行っていない。TLS検証済み公開HTMLの実Chromium描画・操作確認であり、Chromium自身の直接TLS取得成功とは区別する。

根拠：[publication.json](publication.json)、[published-approved-layout-results.json](published-approved-layout-results.json)、[published-uniform-browser-results.json](published-uniform-browser-results.json)、[published-regression-browser-results.json](published-regression-browser-results.json)。各JSONは情報を省略せず空白を詰めて保存した。

比較の左は直前main80148b、右は公開後。全体画面・接写とも公開HTMLの新しいブラウザーセッションで撮影し、同じ個体・軸位置・支持高さを使った実Chromiumスクリーンショット。画像内容は加工せず2列のHTMLへ置いてChromiumで撮影した。接写のみ比較欄の同じ幅へ拡大して表示している。全体16画面と代表接写を目視確認し、図が主役の配置と±値の対応、模型・水準器・操作の保持を確認した。

|機種|PC 1280×800|携帯縦 390×844|320px 320×568|携帯横 844×390|
|---|---|---|---|---|
|小型立形|[全体](comparison--compact--pc-1280x800.png)・[接写](comparison-closeup--compact--pc-1280x800.png)|[全体](comparison--compact--mobile-390x844.png)・[接写](comparison-closeup--compact--mobile-390x844.png)|[全体](comparison--compact--mobile-320x568.png)・[接写](comparison-closeup--compact--mobile-320x568.png)|[全体](comparison--compact--landscape-844x390.png)・[接写](comparison-closeup--compact--landscape-844x390.png)|
|横形|[全体](comparison--horizontal--pc-1280x800.png)・[接写](comparison-closeup--horizontal--pc-1280x800.png)|[全体](comparison--horizontal--mobile-390x844.png)・[接写](comparison-closeup--horizontal--mobile-390x844.png)|[全体](comparison--horizontal--mobile-320x568.png)・[接写](comparison-closeup--horizontal--mobile-320x568.png)|[全体](comparison--horizontal--landscape-844x390.png)・[接写](comparison-closeup--horizontal--landscape-844x390.png)|
|固定門形|[全体](comparison--double--pc-1280x800.png)・[接写](comparison-closeup--double--pc-1280x800.png)|[全体](comparison--double--mobile-390x844.png)・[接写](comparison-closeup--double--mobile-390x844.png)|[全体](comparison--double--mobile-320x568.png)・[接写](comparison-closeup--double--mobile-320x568.png)|[全体](comparison--double--landscape-844x390.png)・[接写](comparison-closeup--double--landscape-844x390.png)|
|旋盤|[全体](comparison--lathe--pc-1280x800.png)・[接写](comparison-closeup--lathe--pc-1280x800.png)|[全体](comparison--lathe--mobile-390x844.png)・[接写](comparison-closeup--lathe--mobile-390x844.png)|[全体](comparison--lathe--mobile-320x568.png)・[接写](comparison-closeup--lathe--mobile-320x568.png)|[全体](comparison--lathe--landscape-844x390.png)・[接写](comparison-closeup--lathe--landscape-844x390.png)|

PC・携帯縦横・320px幅の実ブラウザー検証は完了。スマートフォン実機の指操作は未実施で、上記Chromium疑似タッチ4サイズと区別する。
