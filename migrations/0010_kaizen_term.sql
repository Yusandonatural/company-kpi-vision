-- 改善をプロジェクトから切り離す: タームに直接ぶら下げ、プロジェクトは任意でつなぐ
PRAGMA defer_foreign_keys = true;
CREATE TABLE improvements_new (
  id TEXT PRIMARY KEY,
  term_id TEXT NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
  issue TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'doing', 'done', 'dropped')),
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  due_date TEXT,
  result TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  done_at TEXT
);
INSERT INTO improvements_new (id, term_id, goal_id, issue, action, status, owner_user_id, due_date, result, sort_order, created_by, created_at, done_at)
  SELECT i.id, g.term_id, i.goal_id, i.issue, i.action, i.status, i.owner_user_id, i.due_date, i.result, i.sort_order, i.created_by, i.created_at, i.done_at
  FROM improvements i JOIN goals g ON g.id = i.goal_id;
DROP TABLE improvements;
ALTER TABLE improvements_new RENAME TO improvements;
CREATE INDEX idx_improvements_term ON improvements(term_id, sort_order);
