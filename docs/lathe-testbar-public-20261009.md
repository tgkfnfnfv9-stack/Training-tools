# 奥側タレット・テストバー版の公開後確認

- 実装コミット：`bd581d4405e9c56a067e5ec268a8493d8f308f51`
- [Pages公開処理](https://github.com/tgkfnfnfv9-stack/Training-tools/actions/runs/37876524538)：success
- [公開サイト](https://tgkfnfnfv9-stack.github.io/Training-tools/?v=bd581d4)
- 公開HTML SHA256：`42a265f8fce434a7b589cb745184b7d918c43e26dacb299b9d1bc27d610b818b`
- 独立確認したローカルHTMLと、公開URLから取得したHTMLが完全一致。

`node tests/browser-lathe-testbar-public-20261009.cjs bd581d4405e9c56a067e5ec268a8493d8f308f51` で確認。TLS検証を有効にしたcurlで公開レスポンスを取得し、その同じバイト列をChromiumで操作した。ブラウザーの証明書検証回避は使わない。サーバーへブラウザーが直接アクセスした検証とは区別する。

390 / 1280 pxで、第2ページの「テストバー測定」、側面／上面、奥側タレット、固定バー、心押台・加工項目の除去、支持B上げ下げ、X実スライダー＋100を確認。ブラウザー例外0。used / seed 123456で、側面／上面は `−17 / 0 → −16 / +1 → −17 / 0 µm`、主軸TIRは不変。

- [公開版390 pxの画面](qa-lathe-testbar-20261009/public/lathe-390-bar.png)
- [公開版1280 pxの画面](qa-lathe-testbar-20261009/public/lathe-1280-bar.png)
- [公開検証JSON](qa-lathe-testbar-20261009/public/result.json)

公開前の独立確認は幾何390,591比較、実ブラウザー273項目。他6機種24画面の状態・数値・全ピクセル不変を確認。旧仕様の保存JSONも新版へ実読込して、支持・軸位置・seedの互換と新しいバー指示の再計算を確認した。

この記録コミットは証拠の追加だけで、公開HTMLを変更しない。元workspaceのmainも最終mainへfast-forwardする。実iPhone Safariは未確認。基準器・ブラケット・たわみ等のモデル限界は [訂正記録](lathe-testbar-correction-20261009.md) を参照。
