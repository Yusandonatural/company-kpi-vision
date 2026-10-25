-- 会社版: ミッション → ビジョン → 90日のターム → プロジェクト＋改善
-- ミッション（会社の存在意義）。会社（users.id = 'company'）の設定に持つ
ALTER TABLE user_settings ADD COLUMN mission TEXT NOT NULL DEFAULT '';

-- 改善: プロジェクト（タームの目標）ごとの「課題 → 打ち手 → 結果」。期限はタームの中に収める
-- status: idea（候補）| doing（実行中）| done（完了）| dropped（見送り）
CREATE TABLE improvements (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
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
CREATE INDEX idx_improvements_goal ON improvements(goal_id, sort_order);

-- タイムラインに「改善を完了」を流せるよう、投稿の種類を足す（CHECK を変えるため作り直す）
PRAGMA defer_foreign_keys = true;
CREATE TABLE posts_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'post' CHECK (kind IN ('post', 'task_done', 'milestone', 'kpi', 'review', 'improvement')),
  body TEXT NOT NULL DEFAULT '',
  goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
  ref_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (kind, ref_id)
);
INSERT INTO posts_new SELECT id, user_id, kind, body, goal_id, ref_id, created_at FROM posts;
DROP TABLE posts;
ALTER TABLE posts_new RENAME TO posts;
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_user ON posts(user_id, created_at DESC);
