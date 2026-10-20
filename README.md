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
| `kpis` | 指標（`kind`: `kgi` / `kpi`、`projectId`、`target`、`direction`、`due`、`values`: `{"YYYY-MM": 数値}`） |
