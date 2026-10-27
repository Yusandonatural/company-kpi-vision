import { Hono } from 'hono';
import { PROJECT_KPI_SOURCES } from '../../shared/kpi';
import { all, one, ownGoal, ownTerm, run, uid } from '../db';
import { HttpError, type AppEnv } from '../env';
import { requireManager } from '../org';

/**
 * プロジェクトの毎月の KPI と、担当エージェントへの相談。
 * 相談の回答と毎月1日のレビューは、定期実行の Claude がデータベースに直接書き込む（agent_requests.status = 'answered'）
 */
export const agentRoutes = new Hono<AppEnv>();

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const isMonth = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

function kpiFields(b: any) {
  const f: Record<string, unknown> = {};
  if ('name' in b) f.name = str(b.name, 60);
  if ('kind' in b && ['kpi', 'kgi'].includes(b.kind)) f.kind = b.kind;
  if ('unit' in b) f.unit = str(b.unit, 10);
  if ('target' in b) f.target = num(b.target);
  if ('direction' in b && ['up', 'down'].includes(b.direction)) f.direction = b.direction;
  if ('auto_source' in b) f.auto_source = typeof b.auto_source === 'string' && PROJECT_KPI_SOURCES[b.auto_source] ? b.auto_source : null;
  if ('auto_note' in b) f.auto_note = str(b.auto_note, 200);
  return f;
}

async function ownKpi(c: any, id: string) {
  const k = await one(c.env.DB, 'SELECT * FROM project_kpis WHERE id = ?', id);
  if (!k) throw new HttpError(404, '指標が見つかりません');
  await ownGoal(c.env.DB, c.get('user').id, k.goal_id);
  return k;
}

/** タームのプロジェクトの指標（実績つき）と、エージェントとのやりとり */
agentRoutes.get('/terms/:id/project-kpis', async (c) => {
  const term = await ownTerm(c.env.DB, c.get('user').id, c.req.param('id'));
  const kpis = await all(c.env.DB, 'SELECT k.* FROM project_kpis k JOIN goals g ON g.id = k.goal_id WHERE g.term_id = ? ORDER BY k.sort_order, k.created_at', term.id);
  const values = await all(
    c.env.DB,
    'SELECT v.* FROM project_kpi_values v JOIN project_kpis k ON k.id = v.kpi_id JOIN goals g ON g.id = k.goal_id WHERE g.term_id = ?',
    term.id,
  );
  const requests = await all(
    c.env.DB,
    `SELECT r.*, u.name AS asked_by_name FROM agent_requests r JOIN goals g ON g.id = r.goal_id LEFT JOIN users u ON u.id = r.asked_by
     WHERE g.term_id = ? ORDER BY r.created_at DESC LIMIT 200`,
    term.id,
  );
  return c.json({
    sources: Object.values(PROJECT_KPI_SOURCES),
    kpis: kpis.map((k) => ({
      ...k,
      values: Object.fromEntries(values.filter((v) => v.kpi_id === k.id).map((v) => [v.month, v.value])),
      agentMonths: values.filter((v) => v.kpi_id === k.id && v.source === 'agent').map((v) => v.month),
    })),
    requests,
  });
});

agentRoutes.post('/goals/:id/kpis', async (c) => {
  requireManager(c);
  const g = await ownGoal(c.env.DB, c.get('user').id, c.req.param('id'));
  if (g.type !== 'project') throw new HttpError(400, '指標はプロジェクトに付けます');
  const f = kpiFields(await c.req.json());
  if (!f.name) throw new HttpError(400, '指標の名前を入れてください');
  const n = await one(c.env.DB, 'SELECT COALESCE(MAX(sort_order), -1) AS m FROM project_kpis WHERE goal_id = ?', g.id);
  const id = uid();
  await run(c.env.DB, 'INSERT INTO project_kpis (id, goal_id, name, sort_order) VALUES (?, ?, ?, ?)', id, g.id, f.name, (n?.m ?? -1) + 1);
  const keys = Object.keys(f).filter((k) => k !== 'name');
  if (keys.length) await run(c.env.DB, `UPDATE project_kpis SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...keys.map((k) => f[k]), id);
  return c.json(await one(c.env.DB, 'SELECT * FROM project_kpis WHERE id = ?', id));
});

agentRoutes.patch('/project-kpis/:id', async (c) => {
  requireManager(c);
  const k = await ownKpi(c, c.req.param('id'));
  const f = kpiFields(await c.req.json());
  if ('name' in f && !f.name) delete f.name;
  const keys = Object.keys(f);
  if (keys.length) await run(c.env.DB, `UPDATE project_kpis SET ${keys.map((x) => `${x} = ?`).join(', ')} WHERE id = ?`, ...keys.map((x) => f[x]), k.id);
  return c.json(await one(c.env.DB, 'SELECT * FROM project_kpis WHERE id = ?', k.id));
});

agentRoutes.delete('/project-kpis/:id', async (c) => {
  requireManager(c);
  const k = await ownKpi(c, c.req.param('id'));
  await run(c.env.DB, 'DELETE FROM project_kpis WHERE id = ?', k.id);
  return c.json({ ok: true });
});

/** 月の実績はメンバー全員が入れられる。null で消す */
agentRoutes.put('/project-kpis/:id/values/:month', async (c) => {
  const k = await ownKpi(c, c.req.param('id'));
  const month = c.req.param('month');
  if (!isMonth(month)) throw new HttpError(400, '月の形が正しくありません（YYYY-MM）');
  const v = num((await c.req.json()).value);
  if (v == null) await run(c.env.DB, 'DELETE FROM project_kpi_values WHERE kpi_id = ? AND month = ?', k.id, month);
  else
    await run(
      c.env.DB,
      `INSERT INTO project_kpi_values (kpi_id, month, value, source) VALUES (?, ?, ?, 'manual')
       ON CONFLICT (kpi_id, month) DO UPDATE SET value = excluded.value, source = 'manual', updated_at = datetime('now')`,
      k.id, month, v,
    );
  return c.json({ ok: true });
});

/** エージェントに相談する（回答は定期実行で入る） */
agentRoutes.post('/goals/:id/agent', async (c) => {
  const u = c.get('user');
  const g = await ownGoal(c.env.DB, u.id, c.req.param('id'));
  const q = str((await c.req.json()).question, 1000);
  if (!q) throw new HttpError(400, '相談の内容を書いてください');
  const id = uid();
  await run(c.env.DB, 'INSERT INTO agent_requests (id, goal_id, kind, question, asked_by) VALUES (?, ?, ?, ?, ?)', id, g.id, 'ask', q, u.id);
  return c.json(await one(c.env.DB, 'SELECT * FROM agent_requests WHERE id = ?', id));
});

agentRoutes.delete('/agent-requests/:id', async (c) => {
  const r = await one(c.env.DB, 'SELECT * FROM agent_requests WHERE id = ?', c.req.param('id'));
  if (!r) throw new HttpError(404, '見つかりません');
  await ownGoal(c.env.DB, c.get('user').id, r.goal_id);
  if (r.asked_by !== c.get('user').id && c.get('member').role === 'member') throw new HttpError(403, '自分の相談だけ消せます');
  await run(c.env.DB, 'DELETE FROM agent_requests WHERE id = ?', r.id);
  return c.json({ ok: true });
});
