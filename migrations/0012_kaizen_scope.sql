-- 改善の区分: company（会社全体）/ department（部署）/ project（プロジェクト）
-- ※本番はアプリが最初のリクエストで同じ変更を自分で入れる（src/worker/routes/kaizen.ts の ensureKaizenScope）
ALTER TABLE improvements ADD COLUMN scope TEXT NOT NULL DEFAULT 'company';
ALTER TABLE improvements ADD COLUMN department_id TEXT REFERENCES departments(id) ON DELETE SET NULL;
UPDATE improvements SET scope = 'project' WHERE goal_id IS NOT NULL;
