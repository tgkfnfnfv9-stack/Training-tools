# 修正コミットの外部プレビュー確認

対象は[GitHackの不変コミットURL](https://raw.githack.com/tgkfnfnfv9-stack/Training-tools/fc51b761c2677fcfe43bdbae1a279ecb25541d06/index.html)。`fc51b761c2677fcfe43bdbae1a279ecb25541d06` の確認用プレビューであり、GitHub Pagesの公開確認ではない。

Linuxの実Chromium `154.0.8037.57`、1280×1000で確認した。外部コンテンツ案内の通常の「Open the page」を押して閲覧し、配信HTMLのSHA256は `a70468b143711048184e8983e0e5dc823da7db4fa3fa2babdd44a96ac081ba6c` と一致。TLS検証は有効のまま、環境のHTTPプロキシを利用した。証明書エラー無視やTLS検証回避は使用していない。

|条件・操作|生値µm（前→後）|実DOM|結果|
|---|---|---|---|
|小型・new seed123456・支持0/軸中央を設定後、実支持Aボタン選択→粗調整→上げる1回|YZ 12.551999996339 → 12.528086201176|+13 → +13|支持 `[0.010,0,0,0]`、seed維持、独立監査の既知期待値と一致|
|旋盤・ideal・平坦/軸中央・幅3.2/奥行1.68 m|面Z null|X 0、Z —|タレット面Zの範囲外|
|旋盤・ideal・平坦/軸中央・幅4/奥行0.8 m|面X null|X —、Z 0|タレット面Xの範囲外|

初期個体・平坦支持・理想個体は再現用の診断設定であり、その後の小型支持操作は実UIボタン。寸法欄は現UIでhiddenのため、旋盤寸法はinputイベントによる診断操作と区別した。旧ゼロ保持ではなく、製品の再取付け・再ゼロ後の表示を確認した。

[全入力・生値・DOM・SHA・結果JSON](results.json)、[小型の保存入力](compact.input.json)、[小型の実ブラウザー画像](compact-new-seed123456-A-plus0010.png)、[再現スクリプト](../../../tests/audit-preview-measurements-20261011.cjs)。ページ内エラー0、4確認項目すべて合格。

最初の通常sandbox内でのChromium起動は終了したため、承認レビューを通した同一コマンドで再実行した。[起動失敗記録](sandbox-launch-failure.json)は製品の失敗ではない。その後のHTTPS閲覧で証明書エラーは発生しなかった。
