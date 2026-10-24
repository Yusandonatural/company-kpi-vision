import { Hono } from 'hono';
import { todayJST } from '../../shared/dates';
import { kpiSignal, yearElapsedPct } from '../../shared/kpi';
import { taskStats } from '../../shared/progress';
import { all, one, run, uid } from '../db';
import { HttpError, ORG, type AppEnv } from '../env';
import { termForDate, withInfo } from '../stats';

export const socialRoutes = new Hono<AppEnv>();

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
type AutoKind = 'task_done' | 'milestone' | 'kpi' | 'review';

/** 自動の投稿。同じもと（kind + ref_id）からは1回だけ。本人が「流さない」にしていれば何もしない */
export async function autoPost(db: D1Database, userId: string, kind: AutoKind, refId: string, body: string, goalId: string | null = null) {
  if (userId === ORG) return;
  const s = await one(db, 'SELECT share_done FROM user_settings WHERE user_id = ?', userId);
  if (s && !s.share_done) return;
  await run(db, 'INSERT OR IGNORE INTO posts (id, user_id, kind, body, goal_id, ref_id) VALUES (?, ?, ?, ?, ?, ?)', uid(), userId, kind, body, goalId, refId);
}

/** 「できた」を取り消したときは、自動の投稿も消す（いいね・コメントがあれば残す） */
export async function retractAutoPost(db: D1Database, kind: AutoKind, refId: string) {
  await run(
    db,
    `DELETE FROM posts WHERE kind = ? AND ref_id = ?
       AND NOT EXISTS (SELECT 1 FROM post_likes l WHERE l.post_id = posts.id)
       AND NOT EXISTS (SELECT 1 FROM post_comments m WHERE m.post_id = posts.id)`,
    kind, refId,
  );
}

const POST_SELECT = `
  SELECT p.*, u.name AS user_name, u.email AS user_email, u.picture_url AS user_picture,
         m.role AS user_role, d.name AS department_name, g.title AS goal_title,
         (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS like_count,
         (SELECT COUNT(*) FROM post_comments k WHERE k.post_id = p.id) AS comment_count,
         EXISTS (SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked
  FROM posts p
  JOIN users u ON u.id = p.user_id
  LEFT JOIN members m ON m.user_id = p.user_id
  LEFT JOIN departments d ON d.id = m.department_id
  LEFT JOIN goals g ON g.id = p.goal_id`;

const shapePost = (p: any) => ({ ...p, liked: !!p.liked });

/** 最近のいいねした人（名前を3人まで） */
async function withLikers(db: D1Database, posts: any[]) {
  if (!posts.length) return posts;
  const ids = posts.map((p) => p.id);
  const rows = await all(
    db,
    `SELECT l.post_id, u.name, u.email FROM post_likes l JOIN users u ON u.id = l.user_id
     WHERE l.post_id IN (${ids.map(() => '?').join(',')}) ORDER BY l.created_at DESC`,
    ...ids,
  );
  return posts.map((p) => ({ ...p, likers: rows.filter((r) => r.post_id === p.id).slice(0, 3).map((r) => r.name || r.email) }));
}

/** タイムライン。?before=<created_at> で続きを、?user=<id> でその人の投稿だけを */
socialRoutes.get('/feed', async (c) => {
  const u = c.get('user');
  const before = c.req.query('before');
  const who = c.req.query('user');
  const limit = Math.min(30, Number(c.req.query('limit')) || 15);
  const where: string[] = [];
  const params: unknown[] = [u.id];
  if (before) { where.push('p.created_at < ?'); params.push(before); }
  if (who) { where.push('p.user_id = ?'); params.push(who); }
  const rows = await all(c.env.DB, `${POST_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.created_at DESC LIMIT ?`, ...params, limit + 1);
  const page = rows.slice(0, limit).map(shapePost);
  return c.json({ posts: await withLikers(c.env.DB, page), next: rows.length > limit ? page[page.length - 1].created_at : null });
});

socialRoutes.post('/posts', async (c) => {
  const u = c.get('user');
  const b = await c.req.json();
  const body = str(b.body);
  if (!body) throw new HttpError(400, '投稿する内容を書いてください');
  const goal = b.goal_id ? await one(c.env.DB, 'SELECT g.id FROM goals g JOIN terms t ON t.id = g.term_id WHERE g.id = ? AND t.user_id = ?', b.goal_id, ORG) : null;
  const id = uid();
  await run(c.env.DB, "INSERT INTO posts (id, user_id, kind, body, goal_id) VALUES (?, ?, 'post', ?, ?)", id, u.id, body, goal?.id ?? null);
  const p = await one(c.env.DB, `${POST_SELECT} WHERE p.id = ?`, u.id, id);
  return c.json({ ...shapePost(p), likers: [] });
});

async function getPost(db: D1Database, id: string) {
  const p = await one(db, 'SELECT * FROM posts WHERE id = ?', id);
  if (!p) throw new HttpError(404, '投稿が見つかりません');
  return p;
}

socialRoutes.delete('/posts/:id', async (c) => {
  const p = await getPost(c.env.DB, c.req.param('id'));
  if (p.user_id !== c.get('user').id && c.get('member').role !== 'owner') throw new HttpError(403, '自分の投稿だけ消せます');
  await run(c.env.DB, 'DELETE FROM posts WHERE id = ?', p.id);
  return c.json({ ok: true });
});

socialRoutes.put('/posts/:id/like', async (c) => {
  const p = await getPost(c.env.DB, c.req.param('id'));
  const { on } = await c.req.json();
  if (on) await run(c.env.DB, 'INSERT OR IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)', p.id, c.get('user').id);
  else await run(c.env.DB, 'DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', p.id, c.get('user').id);
  const n = await one(c.env.DB, 'SELECT COUNT(*) AS n FROM post_likes WHERE post_id = ?', p.id);
  return c.json({ liked: !!on, like_count: n?.n ?? 0 });
});

socialRoutes.get('/posts/:id/comments', async (c) => {
  const p = await getPost(c.env.DB, c.req.param('id'));
  return c.json(
    await all(
      c.env.DB,
      `SELECT k.*, u.name AS user_name, u.email AS user_email, u.picture_url AS user_picture FROM post_comments k JOIN users u ON u.id = k.user_id
       WHERE k.post_id = ? ORDER BY k.created_at`,
      p.id,
    ),
  );
});

socialRoutes.post('/posts/:id/comments', async (c) => {
  const p = await getPost(c.env.DB, c.req.param('id'));
  const body = str((await c.req.json()).body, 1000);
  if (!body) throw new HttpError(400, 'コメントを書いてください');
  const id = uid();
  await run(c.env.DB, 'INSERT INTO post_comments (id, post_id, user_id, body) VALUES (?, ?, ?, ?)', id, p.id, c.get('user').id, body);
  return c.json(await one(c.env.DB, 'SELECT k.*, u.name AS user_name, u.email AS user_email, u.picture_url AS user_picture FROM post_comments k JOIN users u ON u.id = k.user_id WHERE k.id = ?', id));
});

socialRoutes.delete('/comments/:id', async (c) => {
  const k = await one(c.env.DB, 'SELECT * FROM post_comments WHERE id = ?', c.req.param('id'));
  if (!k) throw new HttpError(404, 'コメントが見つかりません');
  if (k.user_id !== c.get('user').id && c.get('member').role !== 'owner') throw new HttpError(403, '自分のコメントだけ消せます');
  await run(c.env.DB, 'DELETE FROM post_comments WHERE id = ?', k.id);
  return c.json({ ok: true });
});

/** ストーリーズ: 会社のビジョン、年間10倍KPI、メンバーの今日の進み具合 */
socialRoutes.get('/stories', async (c) => {
  const u = c.get('user');
  const today = todayJST();
  const year = Number(today.slice(0, 4));
  const vision = await one(c.env.DB, 'SELECT life_vision FROM user_settings WHERE user_id = ?', ORG);
  const elapsed = yearElapsedPct(year, today);
  const kpis = (await all(c.env.DB, 'SELECT * FROM annual_kpis WHERE year = ? ORDER BY sort_order, created_at', year)).map((k) => ({
    ...k,
    ...kpiSignal(k.metric_start, k.metric_current, k.metric_target, elapsed),
  }));
  const people = await all(
    c.env.DB,
    `SELECT u.id, u.name, u.email, u.picture_url, m.role, d.name AS department_name FROM members m JOIN users u ON u.id = m.user_id
     LEFT JOIN departments d ON d.id = m.department_id WHERE u.id <> ?`,
    ORG,
  );
  const tasks = await all(c.env.DB, "SELECT t.user_id, t.title, t.status, g.title AS goal_title FROM tasks t LEFT JOIN goals g ON g.id = t.goal_id WHERE t.date = ? AND t.kind = 'must' ORDER BY t.position", today);
  const term = await termForDate(c.env.DB, ORG, today);
  const shaped = people
    .map((p) => {
      const mine = tasks.filter((t) => t.user_id === p.id);
      const s = taskStats(mine);
      return { ...p, me: p.id === u.id, tasks: mine.map(({ user_id: _u, ...t }) => t), done: s.done, total: mine.length };
    })
    // 自分を先頭に、そのあとは今日のタスクがある人から
    .sort((a, b) => Number(b.me) - Number(a.me) || b.total - a.total || b.done - a.done);
  return c.json({ today, vision: vision?.life_vision ?? '', year, elapsedPct: elapsed, kpis, people: shaped, term: withInfo(term) });
});

/** メンバーのプロフィール */
socialRoutes.get('/people/:id', async (c) => {
  const id = c.req.param('id');
  if (id === ORG) throw new HttpError(404, 'メンバーが見つかりません');
  const p = await one(
    c.env.DB,
    `SELECT u.id, u.name, u.email, u.picture_url, m.role, m.department_id, d.name AS department_name FROM members m JOIN users u ON u.id = m.user_id
     LEFT JOIN departments d ON d.id = m.department_id WHERE u.id = ?`,
    id,
  );
  if (!p) throw new HttpError(404, 'メンバーが見つかりません');
  const today = todayJST();
  const term = await termForDate(c.env.DB, ORG, today);
  const tasks = term
    ? await all(c.env.DB, "SELECT status FROM tasks WHERE user_id = ? AND kind = 'must' AND date BETWEEN ? AND ?", id, term.start_date, term.end_date)
    : [];
  const posts = await one(c.env.DB, 'SELECT COUNT(*) AS n FROM posts WHERE user_id = ?', id);
  const likes = await one(c.env.DB, 'SELECT COUNT(*) AS n FROM post_likes l JOIN posts p ON p.id = l.post_id WHERE p.user_id = ?', id);
  const goals = term
    ? await all(c.env.DB, "SELECT id, title, owner_type FROM goals WHERE term_id = ? AND (owner_user_id = ? OR (owner_type = 'department' AND department_id = ?)) ORDER BY sort_order", term.id, id, p.department_id ?? '')
    : [];
  return c.json({
    person: { ...p, me: id === c.get('user').id },
    stats: { posts: posts?.n ?? 0, likes: likes?.n ?? 0, term: taskStats(tasks) },
    goals,
    term: withInfo(term),
  });
});

/** 「できた」をタイムラインに流すか */
socialRoutes.put('/settings/share', async (c) => {
  const u = c.get('user');
  const { on } = await c.req.json();
  await run(c.env.DB, 'INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)', u.id);
  await run(c.env.DB, 'UPDATE user_settings SET share_done = ? WHERE user_id = ?', on ? 1 : 0, u.id);
  return c.json({ ok: true });
});
