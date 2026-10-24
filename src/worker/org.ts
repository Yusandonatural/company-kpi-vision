import { Hono } from 'hono';
import { all, one, run, uid } from './db';
import { HttpError, ORG, type AppEnv, type Env, type Role } from './env';

const ROLES: Role[] = ['owner', 'lead', 'member'];
const str = (v: unknown, max = 100) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/** ログインしてよいアカウントか（個別に許可したメール、または会社のドメイン） */
export function allowedEmail(env: Env, email: string): boolean {
  const e = email.toLowerCase();
  if (list(env.ALLOWED_EMAILS).includes(e)) return true;
  const domain = e.split('@')[1] ?? '';
  return list(env.ALLOWED_DOMAINS).includes(domain);
}

/** 初めてログインした人をメンバーにする。OWNER_EMAILS の人は代表、それ以外は担当 */
export async function ensureMember(env: Env, userId: string, email: string) {
  const role: Role = list(env.OWNER_EMAILS).includes(email.toLowerCase()) ? 'owner' : 'member';
  await run(env.DB, 'INSERT OR IGNORE INTO members (user_id, role) VALUES (?, ?)', userId, role);
}

export async function memberOf(db: D1Database, userId: string) {
  return (
    (await one<{ role: Role; department_id: string | null }>(db, 'SELECT role, department_id FROM members WHERE user_id = ?', userId)) ?? {
      role: 'member' as Role,
      department_id: null,
    }
  );
}

/** 会社の共有データを変える操作は、代表と部署長だけ */
export function requireManager(c: any, roles: Role[] = ['owner', 'lead']) {
  const m = c.get('member');
  if (!m || !roles.includes(m.role)) {
    throw new HttpError(403, roles.length === 1 ? 'この操作は代表だけができます' : 'この操作は代表と部署長だけができます');
  }
}

export const orgRoutes = new Hono<AppEnv>();

/** 部署とメンバーの一覧（全員が見られる） */
orgRoutes.get('/org', async (c) => {
  const departments = await all(c.env.DB, 'SELECT * FROM departments ORDER BY sort_order, created_at');
  const members = await all(
    c.env.DB,
    `SELECT u.id, u.email, u.name, u.picture_url, m.role, m.department_id FROM members m JOIN users u ON u.id = m.user_id
     WHERE u.id <> ? ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'lead' THEN 1 ELSE 2 END, u.name`,
    ORG,
  );
  return c.json({ departments, members, me: { id: c.get('user').id, ...c.get('member') } });
});

orgRoutes.post('/org/departments', async (c) => {
  requireManager(c, ['owner']);
  const b = await c.req.json();
  const name = str(b.name);
  if (!name) throw new HttpError(400, '部署の名前を入れてください');
  const max = await one(c.env.DB, 'SELECT COALESCE(MAX(sort_order), -1) AS m FROM departments');
  const id = uid();
  await run(c.env.DB, 'INSERT INTO departments (id, name, sort_order) VALUES (?, ?, ?)', id, name, (max?.m ?? -1) + 1);
  return c.json(await one(c.env.DB, 'SELECT * FROM departments WHERE id = ?', id));
});

orgRoutes.patch('/org/departments/:id', async (c) => {
  requireManager(c, ['owner']);
  const d = await one(c.env.DB, 'SELECT * FROM departments WHERE id = ?', c.req.param('id'));
  if (!d) throw new HttpError(404, '部署が見つかりません');
  const b = await c.req.json();
  if ('name' in b && str(b.name)) await run(c.env.DB, 'UPDATE departments SET name = ? WHERE id = ?', str(b.name), d.id);
  if ('lead_user_id' in b) {
    const lead = b.lead_user_id ? await one(c.env.DB, 'SELECT user_id FROM members WHERE user_id = ?', b.lead_user_id) : null;
    if (b.lead_user_id && !lead) throw new HttpError(400, 'メンバーが見つかりません');
    await run(c.env.DB, 'UPDATE departments SET lead_user_id = ? WHERE id = ?', lead?.user_id ?? null, d.id);
    // 部署長にした人は、その部署の所属・役割 lead にする（代表はそのまま）
    if (lead) await run(c.env.DB, "UPDATE members SET department_id = ?, role = CASE role WHEN 'owner' THEN 'owner' ELSE 'lead' END WHERE user_id = ?", d.id, lead.user_id);
  }
  return c.json({ ok: true });
});

orgRoutes.delete('/org/departments/:id', async (c) => {
  requireManager(c, ['owner']);
  await run(c.env.DB, 'DELETE FROM departments WHERE id = ?', c.req.param('id'));
  return c.json({ ok: true });
});

orgRoutes.patch('/org/members/:id', async (c) => {
  requireManager(c, ['owner']);
  const id = c.req.param('id');
  const m = await one(c.env.DB, 'SELECT * FROM members WHERE user_id = ?', id);
  if (!m) throw new HttpError(404, 'メンバーが見つかりません');
  const b = await c.req.json();
  if ('role' in b) {
    if (!ROLES.includes(b.role)) throw new HttpError(400, '役割が正しくありません');
    if (m.role === 'owner' && b.role !== 'owner') {
      const owners = await one(c.env.DB, "SELECT COUNT(*) AS n FROM members WHERE role = 'owner'");
      if ((owners?.n ?? 0) <= 1) throw new HttpError(400, '代表がいなくなるため変えられません');
    }
    await run(c.env.DB, 'UPDATE members SET role = ? WHERE user_id = ?', b.role, id);
  }
  if ('department_id' in b) {
    const d = b.department_id ? await one(c.env.DB, 'SELECT id FROM departments WHERE id = ?', b.department_id) : null;
    if (b.department_id && !d) throw new HttpError(400, '部署が見つかりません');
    await run(c.env.DB, 'UPDATE members SET department_id = ? WHERE user_id = ?', d?.id ?? null, id);
  }
  return c.json({ ok: true });
});
