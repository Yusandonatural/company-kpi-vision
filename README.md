# 会社KPI・ビジョンボード

ビジョン → プロジェクト → KGI／KPI の3階層で会社の目標を管理するページ。

- 公開中のアプリ：https://claude.ai/artifact/PxZAVnGJfVuzhEhBRw1Ch4
- `index.html` はそのページのソース。データの保存は claude.ai のアーティファクト用データベースを使うため、claude.ai の外で開くと表示のみ（保存はできません）。

## データの形

| コレクション | 中身 |
| --- | --- |
| `board/creed` | 会社名・ビジョン・ミッション |
| `vision` | ありたい姿（`horizon`: 1 / 3 / 10 年後、`status`） |
| `projects` | プロジェクト（`visionId` でビジョンにつながる、責任者・期限・状況） |
| `kpis` | 指標（`kind`: `kgi` / `kpi`、`projectId`、`target`、`direction`、`due`、`values`: `{"YYYY-MM": 数値}`、`autoSource`: エージェントが自動入力する元） |
| `agentTasks` | 画面からエージェントへの依頼（`status`: pending → working → done / error、`result`） |

## AIエージェントとの連動

- **AIに相談**（画面）：プロジェクトの数字を読んで、その場で現状・原因の仮説・打ち手を返す。
- **依頼**（画面 → エージェント）：プロジェクトの「依頼する」で `agentTasks` に積み、毎朝 8:50（日本時間）の定期エージェントが回答を書き戻す。
- **月次更新**（毎月1日）：`autoSource` を設定した指標を freee・Shopify から前月分で自動入力し、各プロジェクトに月次レビューを書く。

エージェントの手順書は [`agent/AGENT.md`](agent/AGENT.md)。Claude の定期タスク「KPIエージェント」にこの内容が設定されている。
