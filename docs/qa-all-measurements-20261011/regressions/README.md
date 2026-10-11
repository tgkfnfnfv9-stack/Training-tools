# 既存回帰テストの前後比較

既存39本を、修正前mainの別worktreeと修正後ソースで実行した。各プロセス150秒、最大4並列。これはリポジトリ内の全歴史スクリプトを実行したという意味ではない。

|実行|成功|assertion等の失敗|時間上限|
|---|---:|---:|---:|
|修正前main|26|11|2|
|修正後・最初の一括実行|26|12|1|
|修正後・原因を特定した再実行を反映|28|11|0|

- [修正前の全ログ](before.json)／[修正後の一括ログ](after.json)
- [失敗ごとの具体的な式・配置・文言・状態遷移の分析](analysis.md)
- [structural-invariants単独再実行：212検査成功](structural-invariants-rerun.txt)。一括実行の150秒上限はassertion失敗ではない。
- [spindle-sweep再実行：323検査成功](spindle-sweep-rerun.txt)。旧テストの期待値側だけに残った4δ回転を、今回の独立幾何の根拠に従って撤去。実模型頂点と主軸端点から接触を別計算する検証は維持した。

11本は開始mainから失敗している。うち小型の修正で旧モデル識別・数値不一致を通過し、後続の旧文言照合で止まるようになったものもある。すべてを「古いテスト」と一括で正当化せず、停止箇所と現配置との相違を分析に残した。**全既存テスト成功とは報告しない。**

今回変更した関連テストは、`check-coupled-yz-sweep-independent`、`check-lathe-independent-20261009`、`check-spindle-sweep`。小型は未増幅の支持入力・実部材から、旋盤は12角面の幅とフラットの長さから期待を導出する。製品出力の新しい数字への単純置換ではない。追加統合回帰 `audit-measurement-fixes-20261011` は56検査成功。支持入力からの全機種独立幾何と実ブラウザー確認は[監査本体](../README.md)に別記する。

既存スクリプトが履歴docsへ自動出力した3 JSONは `generated/` に退避し、過去の記録を上書きしないよう元へ戻した。

再現例：

```sh
python3 tests/audit-legacy-regressions-20261011.py /workspace/Training-tools-before before
python3 tests/audit-legacy-regressions-20261011.py /workspace/Training-tools after
node tests/check-structural-invariants.cjs
node tests/check-spindle-sweep.cjs
```
