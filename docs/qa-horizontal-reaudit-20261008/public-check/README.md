# 公開後取得内容の確認

製品コミット `0b8e3f4bf409fca2b6f97d424cb1dac59900144a` の [Pagesデプロイ](https://github.com/tgkfnfnfv9-stack/Training-tools/actions/runs/37735475693) 成功後に確認した。

直接のChromium HTTPS接続は環境証明書の `ERR_CERT_AUTHORITY_INVALID` で停止。TLS検証を無効化していない。TLS検証付きcurlで公開HTMLを取得し、ビルド済みHTMLのSHA256 `da86f2a79085d098fe7fb075f275550830a71d2d31aab04876c532d311353c29` と一致することを確認した。その取得応答をChromiumに渡して390/1280 pxでXYZ操作と支持B往復を実行した。直接オンラインのブラウザー接続成功を意味しない。

[結果](result.json)、[390 px](public-390.png)、[1280 px](public-1280.png)。実iPhone Safariは未確認。

再実行時はこのディレクトリへ公開HTMLを取得してから `node check-public.cjs` を実行する（playwright、Chromiumが必要）。

```sh
curl --fail --silent --show-error --location --output index.html https://tgkfnfnfv9-stack.github.io/Training-tools/
node check-public.cjs
```

HTMLは既に製品本体で管理されているため、この確認用ディレクトリには重複してコミットしていない。セッション中の取得ファイルとスクリプト実行場所は `/workspace/Training-tools-public-check-horizontal-20261008/`。
