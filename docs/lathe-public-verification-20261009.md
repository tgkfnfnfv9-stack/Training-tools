# タレット旋盤更新・公開後確認

- 公開ソースコミット：`1270aa0f43a995aced55faf727ab7e1d6d29d179`
- [GitHub Pagesデプロイ](https://github.com/tgkfnfnfv9-stack/Training-tools/actions/runs/37874277530)：success
- [公開サイト](https://tgkfnfnfv9-stack.github.io/Training-tools/)
- 公開HTML SHA256：`c0375aa2db3d1ec4268055e79cf1c79fae3d5cb48a821e1c36f3017ab1ef0007`
- ビルド済ローカルHTML、独立検証したHTML、公開URLから取得したHTMLのハッシュが一致。

curlではTLS検証を有効にして公開HTMLを取得。Chromiumは環境のプロキシCAエラーを回避する設定で公開HTTPSへ直接アクセスし、同一ハッシュを確認した。ローカルHTMLの置換再生ではない。

`node tests/browser-lathe-public-20261009.cjs`：390 / 1280 pxで公開サイトを操作。主軸振れ・刃物台の第1ページ、穴芯・加工の第2ページ、支持B+0.010 mmと復帰、Z実スライダー+100を確認。例外0。TIR不変、Z面+8→+9→+8を確認。

- [公開390 px・第1ページ](qa-lathe-turret-20261009/public/lathe-390-first.png)
- [公開390 px・第2ページ](qa-lathe-turret-20261009/public/lathe-390-second.png)
- [公開1280 px・第1ページ](qa-lathe-turret-20261009/public/lathe-1280-first.png)
- [公開検証JSON](qa-lathe-turret-20261009/public/result.json)

公開前は別担当による独立幾何21,048比較、ブラウザ114項目、他6機種24画面のピクセル・値一致を確認。追加回帰は intrinsic inspection 1,845、leveling UI 190、axis controls 138、support coordinate geometry 32,505、leveling engine 83、accuracy engine 73、横形独立監査10,868比較、reference geometryおよびideal displayで成功した。

この記録コミットは検証証拠・テストの中間ファイル掃除・記録のみで、公開HTMLを変更しない。元の `/workspace/Training-tools` のmainも最終mainへfast-forwardする。旧横形監査ブランチは今回の旋盤作業と分けて保持する。

実iPhone Safariは未確認。測定モデルの近似・有限面・孔傾き・切削弾性の限界は [実装記録](lathe-turret-inspection-20261009.md) を参照。
