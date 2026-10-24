-- 会社版: SNS風のタイムライン
-- kind: post（手で書いた投稿）| task_done（今日のタスクができた）| milestone（マイルストーン達成）| kpi（KPIの数値を更新）| review（週・月のレビューを書いた）
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'post' CHECK (kind IN ('post', 'task_done', 'milestone', 'kpi', 'review')),
  body TEXT NOT NULL DEFAULT '',
  goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
  -- 自動の投稿のもと（タスク・マイルストーン・KPI の値など）。同じもとから2回投稿しない
  ref_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (kind, ref_id)
);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_user ON posts(user_id, created_at DESC);

CREATE TABLE post_likes (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE post_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_post_comments_post ON post_comments(post_id, created_at);

-- 「できた」を自動でタイムラインに流すか（人ごと。既定は流す）
ALTER TABLE user_settings ADD COLUMN share_done INTEGER NOT NULL DEFAULT 1;
