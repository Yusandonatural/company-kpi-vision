import { Hono } from 'hono';
import { isDate } from '../../shared/dates';
import { all, one, ownGoal, ownTerm, run, uid } from '../db';
import { HttpError, type AppEnv } from '../env';
import { autoPost, retractAutoPost } from './social';

/** 改善（プロジェクトごとの「課題 → 打ち手 → 結果」）。90日のタームの中で終わらせる */
export const kaizenRoutes = new Hono<AppEnv>();

const STATUSES = ['idea', 'doing', 'done', 'dropped'];
const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const SELECT = `SELECT i.*, g.title AS goal_title, u.name AS owner_name, u.email AS owner_email, u.picture_url AS owner_picture
  FROM improvements i LEFT JOIN goals g ON g.id = i.goal_id LEFT JOIN users u ON u.id = i.owner_user_id`;

/** 期限はタームの最終日まで。空ならタームの最終日 */
function checkDue(term: any, due: unknown): string {
  if (due == null || due === '') return term.end_date;
  if (!isDate(due)) throw new HttpError(400, '期限の日付が正しくありません');
  if (due > term.end_date) throw new HttpError(400, `改善はこの90日で終わらせます。期限は ${term.end_date.replace(/-/g, '/')}（タームの最終日）までにしてください`);
  return due as string;
}

async function checkOwner(db: D1Database, id: unknown) {
  if (!id) return null;
  const m = await one(db, 'SELECT user_id FROM members WHERE user_id = ?', id);
  if (!m) throw new HttpError(400, '担当のメンバーが見つかりません');
  return m.user_id as string;
}

/** つなぐプロジェクトは任意。つなぐならこのタームのプロジェクトだけ */
async function checkProject(db: D1Database, userId: string, term: any, id: unknown) {
  if (!id) return null;
  const g = await ownGoal(db, userId, String(id));
  if (g.type !== 'project' || g.term_id !== term.id) throw new HttpError(400, 'つなげられるのはこのタームのプロジェクトだけです');
  return g.id as string;
}

kaizenRoutes.get('/terms/:id/improvements', async (c) => {
  const term = await ownTerm(c.env.DB, c.get('user').id, c.req.param('id'));
  return c.json(await all(c.env.DB, `${SELECT} WHERE i.term_id = ? ORDER BY i.sort_order, i.created_at`, term.id));
});

/** 改善はチーム全員が出せる（会社の目標そのものを変えるのは代表・部署長だけ）。プロジェクトとは別に、タームに出す */
async function createImprovement(c: any, term: any, goalId: unknown) {
  const u = c.get('user');
  const b = await c.req.json();
  const action = str(b.action, 300);
  if (!action) throw new HttpError(400, '打ち手を書いてください');
  const goal = await checkProject(c.env.DB, u.id, term, goalId ?? b.goal_id);
  const due = checkDue(term, b.due_date);
  const owner = (await checkOwner(c.env.DB, b.owner_user_id)) ?? u.id;
  const status = STATUSES.includes(b.status) ? b.status : 'idea';
  const max = await one(c.env.DB, 'SELECT COALESCE(MAX(sort_order), -1) AS m FROM improvements WHERE term_id = ?', term.id);
  const id = uid();
  await run(
    c.env.DB,
    'INSERT INTO improvements (id, term_id, goal_id, issue, action, status, owner_user_id, due_date, sort_order, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id, term.id, goal, str(b.issue, 500), action, status, owner, due, (max?.m ?? -1) + 1, u.id,
  );
  return c.json(await one(c.env.DB, `${SELECT} WHERE i.id = ?`, id));
}

kaizenRoutes.post('/terms/:id/improvements', async (c) => {
  const term = await ownTerm(c.env.DB, c.get('user').id, c.req.param('id'));
  return createImprovement(c, term, undefined);
});

/** 以前の呼び方（プロジェクトから出す）も残す */
kaizenRoutes.post('/goals/:id/improvements', async (c) => {
  const g = await ownGoal(c.env.DB, c.get('user').id, c.req.param('id'));
  if (g.type !== 'project') throw new HttpError(400, '改善はプロジェクトに付けます');
  return createImprovement(c, await one(c.env.DB, 'SELECT * FROM terms WHERE id = ?', g.term_id), g.id);
});

async function ownImprovement(c: any, id: string) {
  const i = await one(c.env.DB, `${SELECT} WHERE i.id = ?`, id);
  if (!i) throw new HttpError(404, '改善が見つかりません');
  await ownTerm(c.env.DB, c.get('user').id, i.term_id);
  return i;
}

kaizenRoutes.patch('/improvements/:id', async (c) => {
  const u = c.get('user');
  const i = await ownImprovement(c, c.req.param('id'));
  const b = await c.req.json();
  const f: Record<string, unknown> = {};
  if ('issue' in b) f.issue = str(b.issue, 500);
  if ('action' in b) f.action = str(b.action, 300) || i.action;
  if ('result' in b) f.result = str(b.result, 1000);
  if ('due_date' in b) f.due_date = checkDue(await one(c.env.DB, 'SELECT * FROM terms WHERE id = ?', i.term_id), b.due_date);
  if ('goal_id' in b) f.goal_id = await checkProject(c.env.DB, u.id, await one(c.env.DB, 'SELECT * FROM terms WHERE id = ?', i.term_id), b.goal_id);
  if ('owner_user_id' in b) f.owner_user_id = await checkOwner(c.env.DB, b.owner_user_id);
  if ('status' in b && STATUSES.includes(b.status)) {
    f.status = b.status;
    f.done_at = b.status === 'done' ? new Date().toISOString() : null;
  }
  const keys = Object.keys(f);
  if (keys.length) await run(c.env.DB, `UPDATE improvements SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...keys.map((k) => f[k]), i.id);
  if (f.status === 'done' && i.status !== 'done') {
    const result = (f.result as string | undefined) ?? i.result;
    await autoPost(c.env.DB, u.id, 'improvement', i.id, `改善「${(f.action as string) ?? i.action}」を完了${result ? '\n' + result : ''}`, ('goal_id' in f ? (f.goal_id as string | null) : i.goal_id));
  }
  if (f.status && f.status !== 'done' && i.status === 'done') await retractAutoPost(c.env.DB, 'improvement', i.id);
  return c.json(await one(c.env.DB, `${SELECT} WHERE i.id = ?`, i.id));
});

kaizenRoutes.delete('/improvements/:id', async (c) => {
  const i = await ownImprovement(c, c.req.param('id'));
  const role = c.get('member').role;
  if (i.created_by !== c.get('user').id && role === 'member') throw new HttpError(403, '自分が出した改善だけ消せます');
  await run(c.env.DB, 'DELETE FROM improvements WHERE id = ?', i.id);
  return c.json({ ok: true });
});
