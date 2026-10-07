# ページ再抽選・小型立形YZの検証記録

総合報告は [ページ再抽選・YZ追加点検](../page-redraw-yz-20261007.md)。

- [ページ遷移の独立ブラウザー確認](navigation-review.md)
- [YZブラウザー確認・前後倒れ3画像](compact-yz-browser.md)
- [YZの最終独立レビュー・説明差し戻し](final-independent-review.md)
- [独立幾何式・数値・感度](../compact-yz-mechanical-review-20261007.md)
- [最終ソースSHA](source-lock.json)

`regression.json` は初回候補2559e5…の16スイート成功、`final-regression.json` は説明をコラム配置へ限定したbe6f6c…の4スイート成功を記録する。その後、寸法条件も『初期の寸法・コラム配置』に限定した。最終版は7d697c…で、最終独立レビューとブラウザー記録のSHAを参照。

今回のYZ修正は説明のみ。支持計算・有限走査・接触式・XY/XZの測定式は変更していない。症状自体は再現し、共通傾斜不変性と標準設定での小さいYZ感度を区別した。実機の応答を証明する記録ではない。

最終7d697c…では `check-full-code-review.cjs` の158項目成功。ページ操作の[最終スモーク](navigation-smoke-final.json)と[YZ再確認](final-independent-review.md)も成功した。
