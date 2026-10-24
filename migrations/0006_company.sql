-- 会社版（悠三堂 KPIボード）
-- 共有するもの（ターム・目標・マイルストーン・行動指標・ビジョン）は「会社」(users.id = 'company') の持ち物にする。
-- 個人のもの（今日のタスク・日報・週と月の予定とレビュー・行動指標の記録）は今までどおり users.id ごと。

-- 会社そのものを表す利用者（Google ログインはできない）
INSERT OR IGNORE INTO users (id, email, name) VALUES ('company', 'company@internal.invalid', '会社');
INSERT OR IGNORE INTO user_settings (user_id) VALUES ('company');

-- 部署と、人ごとの所属・役割
CREATE TABLE departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lead_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- role: owner（代表）| lead（部署長）| member（担当）
CREATE TABLE members (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'lead', 'member')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 年間の10倍KPI（タームをまたぐ。1年に1〜3つ）
CREATE TABLE annual_kpis (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  title TEXT NOT NULL,
  metric_unit TEXT,
  metric_start REAL,
  metric_current REAL,
  metric_target REAL,
  link_source TEXT, -- 'freee:sales' | 'shopify:sales' | NULL（手入力）
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_annual_kpis_year ON annual_kpis(year, sort_order);

-- 四半期の目標（goals）に「誰のものか」と「どの上の段につながるか」
ALTER TABLE goals ADD COLUMN owner_type TEXT NOT NULL DEFAULT 'company'; -- company | department | personal
ALTER TABLE goals ADD COLUMN department_id TEXT REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE goals ADD COLUMN owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE goals ADD COLUMN parent_goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL;
ALTER TABLE goals ADD COLUMN annual_kpi_id TEXT REFERENCES annual_kpis(id) ON DELETE SET NULL;
CREATE INDEX idx_goals_department ON goals(department_id);

-- KPI の推移（手入力と自動取り込み）。target_type: goal | annual
CREATE TABLE kpi_values (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('goal', 'annual')),
  target_id TEXT NOT NULL,
  date TEXT NOT NULL,
  value REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual', -- manual | freee:sales | shopify:sales …
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (target_type, target_id, date, source)
);
CREATE INDEX idx_kpi_values_target ON kpi_values(target_type, target_id, date);

-- 行動指標（ロックインのルール）の適用範囲
ALTER TABLE lockin_rules ADD COLUMN scope TEXT NOT NULL DEFAULT 'company'; -- company | department | personal
ALTER TABLE lockin_rules ADD COLUMN department_id TEXT REFERENCES departments(id) ON DELETE CASCADE;
ALTER TABLE lockin_rules ADD COLUMN owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- 行動指標の記録を人ごとに（主キーに user_id を入れるため作り直す）
CREATE TABLE lockin_logs_new (
  rule_id TEXT NOT NULL REFERENCES lockin_rules(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (rule_id, user_id, date)
);
INSERT INTO lockin_logs_new (rule_id, user_id, date, value, done)
  SELECT l.rule_id, t.user_id, l.date, l.value, l.done FROM lockin_logs l JOIN lockin_rules r ON r.id = l.rule_id JOIN terms t ON t.id = r.term_id;
DROP TABLE lockin_logs;
ALTER TABLE lockin_logs_new RENAME TO lockin_logs;
CREATE INDEX idx_lockin_logs_user ON lockin_logs(user_id, date);

-- 部署の週・月の予定とレビュー（個人の period_notes と同じ形）
CREATE TABLE department_period_notes (
  department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('week', 'month')),
  start_date TEXT NOT NULL,
  theme TEXT NOT NULL DEFAULT '',
  targets_json TEXT NOT NULL DEFAULT '[]',
  plan_memo TEXT NOT NULL DEFAULT '',
  review_good TEXT NOT NULL DEFAULT '',
  review_bad TEXT NOT NULL DEFAULT '',
  review_learn TEXT NOT NULL DEFAULT '',
  review_next TEXT NOT NULL DEFAULT '',
  review_score INTEGER,
  reviewed INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (department_id, kind, start_date)
);
