import { useState } from 'react';
import { kpiJudge, kpiRate } from '../../shared/kpi';
import { monthLabel, todayJST } from '../../shared/dates';
import { del, patch, post, put } from '../api';
import { isEn, L } from '../i18n';

const JUDGE: Record<string, string> = { ok: L('達成', 'On track'), warn: L('あと一歩', 'Close'), bad: L('要注意', 'Behind'), none: L('未入力', 'No data') };

const thisMonth = () => todayJST().slice(0, 7);
function shiftMonth(m: string, d: number) {
  const [y, mo] = m.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1 + d, 1));
  return t.toISOString().slice(0, 7);
}
const lastMonths = (n: number, end = thisMonth()) => Array.from({ length: n }, (_, i) => shiftMonth(end, i - n + 1));
const fmt = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString(isEn ? 'en-US' : 'ja-JP', { maximumFractionDigits: 2 }));

/** KGI は表示月までで最後に入った値を「現在値」にする */
function currentValue(k: any, month: string): { month: string; value: number } | null {
  const ms = Object.keys(k.values).filter((m) => m <= month).sort();
  const m = k.kind === 'kgi' ? ms[ms.length - 1] : ms.includes(month) ? month : undefined;
  return m ? { month: m, value: k.values[m] } : null;
}

/** 直近6か月の推移。点線が目標 */
function Spark({ k, months }: { k: any; months: string[] }) {
  const W = 200, H = 36, P = 3;
  const vals = months.map((m) => (m in k.values ? Number(k.values[m]) : null));
  const nums = vals.filter((v): v is number => v != null).concat(k.target != null ? [Number(k.target)] : []);
  if (!nums.length) return <div className="pk-spark empty" aria-hidden="true" />;
  let lo = Math.min(...nums), hi = Math.max(...nums);
  if (hi === lo) { hi += 1; lo -= 1; }
  const x = (i: number) => P + (i * (W - 2 * P)) / (months.length - 1);
  const y = (v: number) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const pts = vals.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean);
  return (
    <svg className="pk-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {k.target != null && <line x1={P} x2={W - P} y1={y(Number(k.target))} y2={y(Number(k.target))} className="pk-target" />}
      {pts.length > 1 && <polyline points={pts.join(' ')} className="pk-line" />}
      {vals.map((v, i) => v != null && <circle key={i} cx={x(i)} cy={y(v)} r={2.5} className="pk-dot" />)}
    </svg>
  );
}

function KpiCard({ k, manager, sources, onChange }: { k: any; manager: boolean; sources: any[]; onChange: () => void }) {
  const month = thisMonth();
  const cur = currentValue(k, month);
  const rate = kpiRate(cur?.value, k.target, k.direction);
  const judge = kpiJudge(rate);
  const prev = k.kind === 'kpi' && shiftMonth(month, -1) in k.values ? Number(k.values[shiftMonth(month, -1)]) : null;
  const diff = cur && prev != null && k.kind === 'kpi' ? cur.value - prev : null;
  const [open, setOpen] = useState(false);
  const [m, setM] = useState(month);
  const [v, setV] = useState('');
  const [f, setF] = useState({ name: k.name, kind: k.kind, target: k.target ?? '', unit: k.unit, direction: k.direction, auto_source: k.auto_source ?? '', auto_note: k.auto_note });
  const [err, setErr] = useState('');
  const act = async (fn: () => Promise<unknown>) => {
    setErr('');
    try { await fn(); onChange(); } catch (e: any) { setErr(e.message); }
  };
  return (
    <div className={`pk-card pk-${judge} ${k.kind === 'kgi' ? 'pk-kgi' : ''}`}>
      <button type="button" className="pk-main" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="pk-top">
          <span className="pk-kind">{k.kind === 'kgi' ? 'KGI' : 'KPI'}</span>
          <span className="pk-name">{k.name}</span>
          <span className={`pk-pill pk-pill-${judge}`}>{JUDGE[judge]}</span>
        </span>
        <span className="pk-val">
          <b className="num">{fmt(cur?.value)}</b>
          <span>{k.unit} {k.target != null && <>/ {k.kind === 'kgi' ? L('目標', 'goal') : L('月目標', 'monthly')} {fmt(k.target)}{k.unit}</>}</span>
        </span>
        <span className="pk-bar"><i style={{ width: `${Math.min(100, Math.max(0, (rate ?? 0) * 100))}%` }} /></span>
        <Spark k={k} months={lastMonths(6)} />
        <span className="pk-foot">
          <span>{L('達成率', 'Rate')} {rate == null ? '—' : `${Math.round(rate * 100)}%`}</span>
          {k.kind === 'kgi'
            ? <span>{cur ? L(`${monthLabel(cur.month + '-01')}時点`, `as of ${monthLabel(cur.month + '-01')}`) : ''}</span>
            : <span>{L('前月比', 'vs last month')} {diff == null ? '—' : `${diff >= 0 ? '+' : ''}${fmt(diff)}`}</span>}
          {k.auto_source && <span className="pk-auto">{L('自動', 'Auto')}</span>}
        </span>
      </button>
      {open && (
        <div className="pk-edit">
          <form
            className="pk-row"
            onSubmit={(e) => { e.preventDefault(); act(() => put(`/project-kpis/${k.id}/values/${m}`, { value: v })).then(() => setV('')); }}
          >
            <select value={m} onChange={(e) => setM(e.target.value)} aria-label={L('月', 'Month')}>
              {lastMonths(12).reverse().map((x) => <option key={x} value={x}>{monthLabel(x + '-01')}{x in k.values ? `（${fmt(k.values[x])}）` : ''}</option>)}
            </select>
            <input inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} placeholder={L('実績', 'Actual')} aria-label={L('実績', 'Actual')} />
            <button className="btn btn-small btn-primary" disabled={v.trim() === ''}>{L('記録', 'Save')}</button>
            {m in k.values && <button type="button" className="btn btn-small btn-ghost" onClick={() => act(() => put(`/project-kpis/${k.id}/values/${m}`, { value: null }))}>{L('この月を消す', 'Clear month')}</button>}
          </form>
          {manager && (
            <form className="pk-settings" onSubmit={(e) => { e.preventDefault(); act(() => patch(`/project-kpis/${k.id}`, f)).then(() => setOpen(false)); }}>
              <label>{L('名前', 'Name')}<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
              <label>{L('種類', 'Type')}<select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="kpi">{L('KPI（毎月）', 'KPI (monthly)')}</option><option value="kgi">{L('KGI（最終ゴール）', 'KGI (end goal)')}</option></select></label>
              <label>{L('目標', 'Target')}<input inputMode="decimal" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></label>
              <label>{L('単位', 'Unit')}<input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></label>
              <label>{L('良い方向', 'Better when')}<select value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })}><option value="up">{L('大きいほど良い', 'Higher')}</option><option value="down">{L('小さいほど良い', 'Lower')}</option></select></label>
              <label>{L('エージェントが自動で入れる', 'Agent fills in')}<select value={f.auto_source} onChange={(e) => setF({ ...f, auto_source: e.target.value })}><option value="">{L('しない（手入力）', 'No (manual)')}</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
              {f.auto_source && <label className="wide">{L('取り方のメモ', 'How to pull it')}<input value={f.auto_note} onChange={(e) => setF({ ...f, auto_note: e.target.value })} placeholder={L('例：定期便タグの注文だけ数える', 'e.g. only count subscription orders')} /></label>}
              <div className="pk-row wide">
                <button className="btn btn-small btn-primary">{L('保存', 'Save')}</button>
                <button type="button" className="btn btn-small btn-ghost danger" onClick={() => confirm(L('この指標を消しますか？', 'Delete this metric?')) && act(() => del(`/project-kpis/${k.id}`))}>{L('指標を削除', 'Delete metric')}</button>
              </div>
            </form>
          )}
          {err && <p className="form-error">{err}</p>}
        </div>
      )}
    </div>
  );
}

/** プロジェクトの KGI・KPI（毎月の実績とグラフ） */
export function ProjectKpis({ goal, kpis, sources, manager, onChange }: { goal: any; kpis: any[]; sources: any[]; manager: boolean; onChange: () => void }) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', kind: 'kpi', target: '', unit: '' });
  const [err, setErr] = useState('');
  if (!kpis.length && !manager) return null;
  return (
    <div className="pk">
      {kpis.length > 0 && (
        <div className="pk-grid">
          {kpis.map((k) => <KpiCard key={k.id} k={k} manager={manager} sources={sources} onChange={onChange} />)}
        </div>
      )}
      {manager && (adding ? (
        <form
          className="pk-add"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr('');
            try { await post(`/goals/${goal.id}/kpis`, f); setF({ name: '', kind: 'kpi', target: '', unit: '' }); setAdding(false); onChange(); } catch (x: any) { setErr(x.message); }
          }}
        >
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} aria-label={L('種類', 'Type')}><option value="kpi">KPI</option><option value="kgi">KGI</option></select>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={L('指標の名前（例：新規の取引先）', 'Metric name (e.g. new wholesale accounts)')} aria-label={L('指標の名前', 'Metric name')} required />
          <input inputMode="decimal" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder={f.kind === 'kgi' ? L('目標', 'Target') : L('月目標', 'Monthly target')} aria-label={L('目標', 'Target')} />
          <input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder={L('単位', 'Unit')} aria-label={L('単位', 'Unit')} className="pk-unit" />
          <button className="btn btn-small btn-primary" disabled={!f.name.trim()}>{L('追加', 'Add')}</button>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => setAdding(false)}>{L('やめる', 'Cancel')}</button>
          {err && <p className="form-error">{err}</p>}
        </form>
      ) : (
        <button type="button" className="btn btn-small btn-ghost pk-add-btn" onClick={() => setAdding(true)}>{L('＋ KGI・KPI を追加', '+ Add KGI / KPI')}</button>
      ))}
    </div>
  );
}

/** 担当エージェント：指示と相談。回答・毎月のレビューは定期実行で入る */
export function AgentBox({ goal, requests, manager, onChange }: { goal: any; requests: any[]; manager: boolean; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [ins, setIns] = useState<string>(goal.agent_instructions ?? '');
  const [err, setErr] = useState('');
  const pending = requests.filter((r) => r.status === 'pending').length;
  const latest = requests.find((r) => r.status === 'answered');
  const act = async (fn: () => Promise<unknown>) => {
    setErr('');
    try { await fn(); onChange(); } catch (e: any) { setErr(e.message); }
  };
  return (
    <div className={`agent ${open ? 'open' : ''}`}>
      <button type="button" className="agent-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="agent-dot" aria-hidden="true" />
        <span className="agent-title">{L('担当エージェント', 'Project agent')}</span>
        <span className="agent-sub">
          {pending > 0 ? L(`回答待ち ${pending}件`, `${pending} waiting`) : latest ? (latest.kind === 'review' ? L('月次レビューあり', 'Monthly review in') : L('回答あり', 'Answered')) : L('相談できます', 'Ask anything')}
        </span>
        <span className="agent-chev" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="agent-body">
          {manager ? (
            <label className="agent-ins">
              {L('エージェントへの指示（毎月のレビューと相談のときに読みます）', 'Standing instructions (read for the monthly review and every question)')}
              <textarea rows={2} value={ins} onChange={(e) => setIns(e.target.value)} onBlur={() => ins !== (goal.agent_instructions ?? '') && act(() => patch(`/goals/${goal.id}`, { agent_instructions: ins }))} placeholder={L('例：毎月、解約理由の傾向も見て改善案を出して', 'e.g. Each month, look at churn reasons and suggest fixes')} />
            </label>
          ) : goal.agent_instructions ? <p className="agent-ins-ro">{L('指示：', 'Instructions: ')}{goal.agent_instructions}</p> : null}
          <form className="agent-ask" onSubmit={(e) => { e.preventDefault(); act(() => post(`/goals/${goal.id}/agent`, { question: q })).then(() => setQ('')); }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('エージェントに相談する（例：見込み客の探し方は？）', 'Ask the agent (e.g. how do we find prospects?)')} aria-label={L('相談', 'Question')} />
            <button className="btn btn-small btn-primary" disabled={!q.trim()}>{L('相談', 'Ask')}</button>
          </form>
          <p className="agent-note">{L('回答は毎朝まとめて入ります。毎月1日には、数字を見たレビューが届きます。', 'Answers arrive each morning. A review of the numbers arrives on the 1st of each month.')}</p>
          <ul className="agent-list">
            {requests.map((r) => (
              <li key={r.id} className={`agent-item ${r.status}`}>
                <div className="agent-q">
                  <span className="agent-tag">{r.kind === 'review' ? L('月次レビュー', 'Monthly review') : L('相談', 'Question')}</span>
                  {r.question && <span>{r.question}</span>}
                  <button type="button" className="icon-btn small" aria-label={L('削除', 'Delete')} onClick={() => act(() => del(`/agent-requests/${r.id}`))}>×</button>
                </div>
                {r.status === 'answered' ? <div className="agent-a">{r.answer}</div> : <div className="agent-wait">{L('回答待ち', 'Waiting for an answer')}</div>}
              </li>
            ))}
          </ul>
          {err && <p className="form-error">{err}</p>}
        </div>
      )}
    </div>
  );
}
