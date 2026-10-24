import { Hono } from 'hono';
import { isDate, todayJST } from '../../shared/dates';
import { KPI_SOURCES, kpiSignal, yearElapsedPct } from '../../shared/kpi';
import { all, one, ownGoal, run, uid } from '../db';
import { HttpError, type AppEnv } from '../env';
import { requireManager } from '../org';

export const kpiRoutes = new Hono<AppEnv>();

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));

function annualFields(b: any) {
  const f: Record<string, unknown> = {};
  if ('title' in b) f.title = str(b.title);
  if ('metric_unit' in b) f.metric_unit = str(b.metric_unit, 20);
  for (const k of ['metric_start', 'metric_current', 'metric_target']) if (k in b) f[k] = num(b[k]);
  if ('link_source' in b) f.link_source = typeof b.link_source === 'string' && KPI_SOURCES[b.link_source] ? b.link_source : null;
  return f;
}

/** 年間の10倍KPI（信号つき） */
kpiRoutes.get('/kpis/annual', async (c) => {
  const year = Number(c.req.query('year')) || Number(todayJST().slice(0, 4));
  const rows = await all(c.env.DB, 'SELECT * FROM annual_kpis WHERE year = ? ORDER BY sort_order, created_at', year);
  const elapsed = yearElapsedPct(year, todayJST());
  return c.json({
    year,
    elapsedPct: elapsed,
    sources: Object.values(KPI_SOURCES),
    kpis: rows.map((k) => ({ ...k, ...kpiSignal(k.metric_start, k.metric_current, k.metric_target, elapsed) })),
  });
});

kpiRoutes.post('/kpis/annual', async (c) => {
  requireManager(c, ['owner']);
  const b = await c.req.json();
  const year = Number(b.year) || Number(todayJST().slice(0, 4));
  const f = annualFields(b);
  if (!f.title) throw new HttpError(400, 'KPIの名前を入れてください');
  const n = await one(c.env.DB, 'SELECT COUNT(*) AS n, COALESCE(MAX(sort_order), -1) AS m FROM annual_kpis WHERE year = ?', year);
  if ((n?.n ?? 0) >= 3) throw new HttpError(400, '年間の10倍KPIは3つまでです。絞るほど全員の力が集まります');
  const id = uid();
  await run(c.env.DB, 'INSERT INTO annual_kpis (id, year, title, sort_order) VALUES (?, ?, ?, ?)', id, year, f.title, (n?.m ?? -1) + 1);
  const keys = Object.keys(f).filter((k) => k !== 'title');
  if (keys.length) await run(c.env.DB, `UPDATE annual_kpis SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, ...keys.map((k) => f[k]), id);
  return c.json(await one(c.env.DB, 'SELECT * FROM annual_kpis WHERE id = ?', id));
});

kpiRoutes.patch('/kpis/annual/:id', async (c) => {
  requireManager(c, ['owner']);
  const k = await one(c.env.DB, 'SELECT * FROM annual_kpis WHERE id = ?', c.req.param('id'));
  if (!k) throw new HttpError(404, 'KPIが見つかりません');
  const f = annualFields(await c.req.json());
  if ('title' in f && !f.title) delete f.title;
  const keys = Object.keys(f);
  if (keys.length) await run(c.env.DB, `UPDATE annual_kpis SET ${keys.map((x) => `${x} = ?`).join(', ')} WHERE id = ?`, ...keys.map((x) => f[x]), k.id);
  return c.json({ ok: true });
});

kpiRoutes.delete('/kpis/annual/:id', async (c) => {
  requireManager(c, ['owner']);
  await run(c.env.DB, 'DELETE FROM annual_kpis WHERE id = ?', c.req.param('id'));
  await run(c.env.DB, "DELETE FROM kpi_values WHERE target_type = 'annual' AND target_id = ?", c.req.param('id'));
  return c.json({ ok: true });
});

async function target(c: any, type: string, id: string) {
  if (type === 'annual') {
    const k = await one(c.env.DB, 'SELECT * FROM annual_kpis WHERE id = ?', id);
    if (!k) throw new HttpError(404, 'KPIが見つかりません');
    return k;
  }
  if (type === 'goal') return ownGoal(c.env.DB, c.get('user').id, id);
  throw new HttpError(400, '種類が正しくありません');
}

/** KPI の推移（日付順） */
kpiRoutes.get('/kpis/:type/:id/values', async (c) => {
  const { type, id } = c.req.param();
  await target(c, type, id);
  return c.json(await all(c.env.DB, 'SELECT date, value, source FROM kpi_values WHERE target_type = ? AND target_id = ? ORDER BY date', type, id));
});

/** 手入力の値。現在値（metric_current）もこの値にそろえる */
kpiRoutes.put('/kpis/:type/:id/values/:date', async (c) => {
  requireManager(c);
  const { type, id, date } = c.req.param();
  if (!isDate(date)) throw new HttpError(400, '日付が正しくありません');
  const t = await target(c, type, id);
  const value = num((await c.req.json()).value);
  if (value == null) {
    await run(c.env.DB, "DELETE FROM kpi_values WHERE target_type = ? AND target_id = ? AND date = ? AND source = 'manual'", type, id, date);
    return c.json({ ok: true });
  }
  await run(
    c.env.DB,
    `INSERT INTO kpi_values (id, target_type, target_id, date, value, source, created_by) VALUES (?, ?, ?, ?, ?, 'manual', ?)
     ON CONFLICT (target_type, target_id, date, source) DO UPDATE SET value = excluded.value, created_by = excluded.created_by`,
    uid(), type, id, date, value, c.get('user').id,
  );
  const latest = await one(c.env.DB, 'SELECT MAX(date) AS d FROM kpi_values WHERE target_type = ? AND target_id = ?', type, id);
  if (latest?.d === date) await run(c.env.DB, `UPDATE ${type === 'annual' ? 'annual_kpis' : 'goals'} SET metric_current = ? WHERE id = ?`, value, t.id);
  return c.json({ ok: true });
});
