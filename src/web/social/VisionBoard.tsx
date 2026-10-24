import { useState } from 'react';
import { Link } from 'react-router-dom';
import { monthLabel, todayJST } from '../../shared/dates';
import { del, patch, post } from '../api';
import { L } from '../i18n';

export const HORIZONS = [
  { k: 1, label: L('1年後', 'In 1 year') },
  { k: 3, label: L('3年後', 'In 3 years') },
  { k: 10, label: L('10年後', 'In 10 years') },
];
export const VB_STATUS: Record<string, string> = { todo: L('これから', 'Not started'), doing: L('進行中', 'In progress'), done: L('実現した', 'Achieved') };

/** ビジョンボード: 1年後・3年後・10年後の「ありたい姿」。プロジェクトはここにつながる */
export function VisionBoard({ goals, owner, onChange }: { goals: any[]; owner: boolean; onChange: () => void }) {
  const year = Number(todayJST().slice(0, 4));
  const [err, setErr] = useState('');
  const act = async (fn: () => Promise<unknown>) => {
    setErr('');
    try {
      await fn();
      onChange();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  return (
    <section className="card vboard">
      <div className="card-head">
        <h2 className="card-title"><span className="step-no">3</span>{L('ビジョンボード', 'Vision board')}</h2>
        <span className="muted small">{L('これまで → 1年後 → 3年後 → 10年後。ありたい姿に90日のプロジェクトをつなげます', 'So far → 1 year → 3 years → 10 years. Link 90-day projects to each aspiration')}</span>
      </div>
      {err && <p className="form-error">{err}</p>}
      <div className="vb-lanes">
        <PastLane goals={goals} owner={owner} act={act} />
        {HORIZONS.map((h) => {
          // 実現したものは「これまで」の列に移る
          const items = goals.filter((g) => (g.horizon ?? 10) === h.k && g.status !== 'done').sort((a, b) => a.sort_order - b.sort_order);
          return (
            <div key={h.k} className="vb-lane">
              <div className="vb-lane-head">
                <h3>{h.label}</h3>
                <span className="num muted">{L(`${year + h.k}年`, `${year + h.k}`)}</span>
              </div>
              {items.map((g) => <VisionCard key={g.id} g={g} owner={owner} act={act} />)}
              {items.length === 0 && !owner && <p className="muted small">{L('まだありません', 'Nothing yet')}</p>}
              {owner && <AddCard horizon={h.k} label={h.label} act={act} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const ym = (d?: string | null) => (d ? monthLabel(d) : '');

/** これまで（成し遂げたこと）。直接書き足したものと、ありたい姿のうち実現したものが、新しい順に並ぶ */
function PastLane({ goals, owner, act }: { goals: any[]; owner: boolean; act: (fn: () => Promise<unknown>) => Promise<void> }) {
  const items = goals
    .filter((g) => (g.horizon ?? 10) === 0 || g.status === 'done')
    .sort((a, b) => String(b.achieved_at ?? '').localeCompare(String(a.achieved_at ?? '')));
  const [f, setF] = useState({ title: '', achieved_at: todayJST().slice(0, 7) });
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="vb-lane vb-past">
      <div className="vb-lane-head">
        <h3>{L('これまで', 'So far')}</h3>
        <span className="muted small">{L(`成し遂げたこと ${items.length}件`, `Achievements: ${items.length}`)}</span>
      </div>
      <ol className="vb-timeline">
        {items.map((g) => (
          <li key={g.id}>
            <span className="vb-when">{ym(g.achieved_at)}</span>
            <div className="vb-done-body">
              <b>{g.title}</b>
              {g.note && <span className="vb-note">{g.note}</span>}
              {(g.horizon ?? 10) !== 0 && <span className="muted small">{L(`${g.horizon}年後のありたい姿を実現`, `Achieved a ${g.horizon}-year aspiration`)}</span>}
              {g.projects?.length > 0 && <span className="muted small">{L(`プロジェクト ${g.projects.length}件`, `Projects: ${g.projects.length}`)}</span>}
            </div>
            {owner && (
              editing === g.id ? (
                <span className="vb-past-edit">
                  <input type="month" aria-label={L('実現した年月', 'Month achieved')} defaultValue={(g.achieved_at ?? '').slice(0, 7)} onBlur={(e) => e.target.value && act(() => patch(`/life/goals/${g.id}`, { achieved_at: `${e.target.value}-01` }))} />
                  {(g.horizon ?? 10) !== 0 && <button className="btn btn-small btn-ghost" onClick={() => act(() => patch(`/life/goals/${g.id}`, { status: 'doing' }))}>{L('ボードに戻す', 'Back to board')}</button>}
                  <button className="btn btn-small btn-danger" onClick={() => act(() => del(`/life/goals/${g.id}`))}>{L('削除', 'Delete')}</button>
                  <button className="btn btn-small btn-ghost" onClick={() => setEditing(null)}>{L('閉じる', 'Close')}</button>
                </span>
              ) : (
                <button className="icon-btn small" aria-label={L('編集', 'Edit')} onClick={() => setEditing(g.id)}>…</button>
              )
            )}
          </li>
        ))}
      </ol>
      {items.length === 0 && <p className="muted small">{L('これまでに成し遂げたことを残しておくと、ここに並びます。', 'Record what you have achieved and it will appear here.')}</p>}
      {owner && (
        <form
          className="vb-add vb-add-past"
          onSubmit={(e) => {
            e.preventDefault();
            if (f.title.trim()) act(() => post('/life/goals', { title: f.title, horizon: 0, achieved_at: `${f.achieved_at || todayJST().slice(0, 7)}-01` })).then(() => setF({ ...f, title: '' }));
          }}
        >
          <input id="vb-new-past-when" type="month" aria-label={L('成し遂げた年月', 'Month achieved')} value={f.achieved_at} onChange={(e) => setF({ ...f, achieved_at: e.target.value })} />
          <input id="vb-new-past" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={L('＋ 成し遂げたこと', '+ Achievement')} aria-label={L('成し遂げたことを追加', 'Add an achievement')} />
          {f.title.trim() && <button className="btn btn-small btn-primary">{L('追加', 'Add')}</button>}
        </form>
      )}
    </div>
  );
}

function VisionCard({ g, owner, act }: { g: any; owner: boolean; act: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: g.title, note: g.note ?? '', horizon: g.horizon ?? 10 });
  const status = g.status ?? (g.achieved_at ? 'done' : 'todo');
  return (
    <article className={`vb-card vb-${status}`}>
      <h4>{g.title}</h4>
      {g.note && !open && <p className="vb-note">{g.note}</p>}
      <div className="vb-foot">
        {owner ? (
          <select aria-label={L('状況', 'Status')} id={`vb-st-${g.id}`} className={`vb-status vb-s-${status}`} value={status} onChange={(e) => act(() => patch(`/life/goals/${g.id}`, { status: e.target.value }))}>
            {Object.entries(VB_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        ) : (
          <span className={`vb-status vb-s-${status}`}>{VB_STATUS[status]}</span>
        )}
        <span className="muted small">{L(`プロジェクト ${g.projects?.length ?? 0}件`, `Projects: ${g.projects?.length ?? 0}`)}</span>
        {owner && <button className="btn btn-small btn-ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? L('閉じる', 'Close') : L('編集', 'Edit')}</button>}
      </div>
      {g.projects?.length > 0 && (
        <ul className="vb-projects">
          {g.projects.slice(0, 4).map((p: any) => (
            <li key={p.id}><Link to={`/term/${p.term_id}`}>◎ {p.title}</Link></li>
          ))}
        </ul>
      )}
      {open && owner && (
        <div className="form vb-edit">
          <label>{L('ありたい姿', 'Aspiration')}<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label>{L('メモ・なぜ目指すか', 'Notes · why it matters')}<textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
          <label>
            {L('時間軸', 'Horizon')}
            <select value={f.horizon} onChange={(e) => setF({ ...f, horizon: Number(e.target.value) })}>
              {HORIZONS.map((h) => <option key={h.k} value={h.k}>{h.label}</option>)}
            </select>
          </label>
          <div className="form-row">
            <button className="btn btn-primary" onClick={() => act(() => patch(`/life/goals/${g.id}`, f)).then(() => setOpen(false))}>{L('保存', 'Save')}</button>
            <button className="btn btn-danger" onClick={() => act(() => del(`/life/goals/${g.id}`))}>{L('削除', 'Delete')}</button>
          </div>
        </div>
      )}
    </article>
  );
}

function AddCard({ horizon, label, act }: { horizon: number; label: string; act: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [title, setTitle] = useState('');
  return (
    <form className="vb-add" onSubmit={(e) => { e.preventDefault(); if (title.trim()) act(() => post('/life/goals', { title, horizon })).then(() => setTitle('')); }}>
      <input id={`vb-new-${horizon}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={L(`＋ ${label}のありたい姿`, `+ Aspiration (${horizon} yr)`)} aria-label={L(`${label}のありたい姿を追加`, `Add an aspiration for ${horizon} years`)} />
      {title.trim() && <button className="btn btn-small btn-primary">{L('追加', 'Add')}</button>}
    </form>
  );
}
