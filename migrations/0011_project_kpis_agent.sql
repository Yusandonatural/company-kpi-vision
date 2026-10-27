-- プロジェクトごとの毎月の KPI（KGI は最終ゴール、KPI は毎月の先行指標）と、担当エージェント
CREATE TABLE project_kpis (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'kpi' CHECK (kind IN ('kpi', 'kgi')),
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '',
  target REAL,
  direction TEXT NOT NULL DEFAULT 'up' CHECK (direction IN ('up', 'down')),
  auto_source TEXT,           -- 'freee:sales' など。エージェントが毎月入れる
  auto_note TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_project_kpis_goal ON project_kpis(goal_id, sort_order);

CREATE TABLE project_kpi_values (
  kpi_id TEXT NOT NULL REFERENCES project_kpis(id) ON DELETE CASCADE,
  month TEXT NOT NULL,        -- 'YYYY-MM'
  value REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'agent')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (kpi_id, month)
);

ALTER TABLE goals ADD COLUMN agent_instructions TEXT NOT NULL DEFAULT '';

-- エージェントへの相談と、毎月1日のレビュー。status: pending（回答待ち）→ answered
CREATE TABLE agent_requests (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'ask' CHECK (kind IN ('ask', 'review')),
  question TEXT NOT NULL DEFAULT '',
  answer TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered')),
  asked_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  answered_at TEXT
);
CREATE INDEX idx_agent_requests_goal ON agent_requests(goal_id, created_at);
CREATE INDEX idx_agent_requests_pending ON agent_requests(status);
