# 工作機械の構造パターンと代表例

メーカー公式資料の確認日：2026年10月2日。今回はUIで構造を選ぶための整理です。市場シェア順・販売台数順ではありません。

## UIに含めた9パターン

|構造パターン|代表例・公式資料|UIで見せる違い|
|---|---|---|
|小型立形切削加工機|[FANUC ROBODRILL](https://www.fanuc.co.jp/ja/product/robodrill/alphadibplus.html)|コンパクトな縦向き主軸とテーブル|
|標準立形・片側コラム|[Haas VF-2](https://www.haascnc.com/machines/vertical-mills/vf-series/models/small/vf-2.html)|後方コラムから主軸が張り出す構造|
|門形構造の立形|[オークマ GENOS M](https://www.okuma.co.jp/product/genos_m/)|立形にも門形構造があること|
|横形マシニングセンタ|[牧野フライス a51nx](https://www.makino.co.jp/ja-jp/machine-technology/machines/horizontal-4-axis/a51nx)|横向き主軸、パレット、B軸|
|移動コラム形・立形|[マザック VTC-530/20](https://www.mazak.com/jp-ja/products/vtc/)|固定テーブルと主軸側の移動|
|固定門形・テーブル移動|[芝浦機械 門形機ラインナップ](https://www.shibaura-machine.co.jp/jp/product/machinetool/lineup/m_new/Line_up.html)|門を固定し長いテーブルを動かす方式|
|移動門形・ガントリー|[芝浦機械 MG系](https://www.shibaura-machine.co.jp/jp/product/machinetool/lineup/s_new/spec.html)|固定テーブルと門全体の移動|
|5軸・テーブル旋回形|[DMG MORI DMU 75 monoBLOCK](https://us.dmgmori.com/products/machines/milling/5-axis-milling/monoblock/dmu-75-monoblock-2nd)|直線軸に加えてテーブル側が旋回|
|NC旋盤|[Haas ST/DS 据付資料](https://www.haascnc.com/service/troubleshooting-and-how-to/how-to/st-lathe-installation---ngc.html)|長いベッド、主軸台、刃物台、心押台|

「ロボドリル」は商品名、「横形」は主軸方向、「門形」は構造、「5軸」は軸構成です。同じ分類軸ではないため、一覧は排他的な分類ではなく代表的な構造パターンです。

GENOS Mの公式資料には門形構造の採用が明記されています。芝浦機械はテーブル移動、クロスレール移動などの方式を分けて紹介しています。「門形」という名前だけで可動部分を決めつけないことが重要です。

DMUの代表例には3点支持が明記されています。実機の支持点数は構造・サイズ・仕様によって異なるため、UI上の支持点を実機のボルト位置として使用することはできません。

## 後の追加候補

|候補|構造の違い・参考資料|
|---|---|
|縦型NCフライス|膝形、ベッド形などの構造、工具交換方式の違いを整理して追加|
|ヘッド旋回式5軸|[マザック VTC-800G-30S](https://virtual.mazakusa.com/machine/vtc-800g-30s/)：主軸頭側が旋回する方式|
|平面研削盤|[岡本 PSG-DX コラムタイプ](https://www.okamoto.co.jp/products/psg-dx/)：テーブル左右移動とコラム前後移動|
|門形研削盤|[岡本 PSG-CHNC/CHVNC](https://www.okamoto.co.jp/products/psg-chnc/)：門形構造。梁のたわみには機械固有の調整がある|
|テーブル形横中ぐり盤|[芝浦機械 横形機ラインナップ](https://www.shibaura-machine.co.jp/jp/product/machinetool/lineup/b_mc_new/Line_up.html)：大物部品向けのテーブル形|
|床上形横中ぐり盤|[芝浦機械 用語解説](https://www.shibaura-machine.co.jp/jp/product/machinetool/glossary/ichiran/051.html)：床上定盤にワークを置きコラムが移動|
|複合加工機・円筒研削盤|主軸配置、加工軸、支持方式を追加調査してからモデル化|

## 訓練計算を追加する際の考え方

UIの次の段階では、まず全体の傾きとねじれの違いを扱います。機械全体が剛体として傾くことと、ベースが変形して案内や軸の相対関係が変わることは異なります。「水平になれば全精度が改善する」という表現は避けます。

[Haas VMCレベル出し資料](https://www.haascnc.com/service/troubleshooting-and-how-to/how-to/leveling---vmc.html)は軸移動でねじれを確認し、支持点調整後に直角度なども確認する流れを示しています。

機種別の計算・合格判定を作るには、対象機種、メーカー指定の支持点・測定面・測定方向・手順・許容値を別途確認する必要があります。今回はこの計算を実装していません。
