# 横形・旋盤修正版の公開確認

2026-10-10。修正版と残る課題を案内した後の「公開して」という指示を受け、PR #32をmainへ統合してGitHub Pagesへ公開した。

- [公開サイト](https://tgkfnfnfv9-stack.github.io/Training-tools/?v=baede5b)
- [統合したPR #32](https://github.com/tgkfnfnfv9-stack/Training-tools/pull/32)
- [公開処理：pages build and deployment](https://github.com/tgkfnfnfv9-stack/Training-tools/actions/runs/38023127351)
- 公開前main：`cbdcf81a4b3b252d4113621b8361b20640955688`
- PR head：`a26192b54f6c2d550fb9b04346f16be3c6a60d75`
- 公開したmainの統合コミット：`baede5bfafed034f5f7d21ec9957e344dc7c8c98`
- 公開HTML SHA256：`831edb95f7dbf1095563c1c8c289f52219bcf764937618c6079d4c4d32f7fa65`

公開前に最新mainをfetchし、競合なし・作業ツリーの製品変更なし・PR head一致を確認。PRをreadyへ変更し、head SHAを指定して統合した。Pagesの公開元はmainのルートで、設定は変更していない。公開処理はcompleted / success、公開URLから取得したHTMLはローカルの検証済み最終製品およびmainのindex.htmlとSHA256が一致した。

統括担当とは別の確認担当が、公開サイトを実Chromiumで操作して検証した記録は[ブラウザー確認](browser.md)を参照。公開前の独立幾何・前後画像・互換確認は[XY表示修正の記録](../qa-xy-clarity-20261010/README.md)に保存している。今回の公開作業では製品コード・数式を追加変更していない。

## 解決済み扱いにしない範囲

公開は、測定器具の3D未描画・長い腕を仮定する取付寸法・YZ方式選択の課題を解消したことを意味しない。[残課題の記録](../qa-fresh-audit-20261010/README.md)を維持する。過去の記録中の「未公開」「ドラフト」は、その記録を作成した時点の状態。この公開記録がその後の反映状況を示す。

公開後検証は配信物の一致と実操作の確認であり、既存全テストの再実行・全機種の物理モデル再認定・実iPhone Safariでの検証ではない。
