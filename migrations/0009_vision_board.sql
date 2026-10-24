-- 会社版: ビジョンボード（1年後・3年後・10年後のありたい姿）
-- 今までの「10年の目標」（life_goals）をボードのカードにする。horizon: 1 | 3 | 10（年後）
ALTER TABLE life_goals ADD COLUMN horizon INTEGER NOT NULL DEFAULT 10;
-- status: todo（これから）| doing（進行中）| done（実現した。achieved_at も入る）
ALTER TABLE life_goals ADD COLUMN status TEXT NOT NULL DEFAULT 'todo';
UPDATE life_goals SET status = 'done' WHERE achieved_at IS NOT NULL;
-- プロジェクト（タームの目標）が、どのありたい姿につながるか
ALTER TABLE goals ADD COLUMN vision_goal_id TEXT REFERENCES life_goals(id) ON DELETE SET NULL;
