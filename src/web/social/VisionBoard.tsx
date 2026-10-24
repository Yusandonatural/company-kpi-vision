import { useState } from 'react';
import { Link } from 'react-router-dom';
import { todayJST } from '../../shared/dates';
import { del, patch, post } from '../api';

export const HORIZONS = [
  { k: 1, label: '1年後' },
  { k: 3, label: '3年後' },
  { k: 10, label: '10年後' },
];
export const VB_STATUS: Record<string, string> = { todo: 'これから', doing: '進行中', done: '実現した' };

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
        <h2 className="card-title"><span className="step-no">3</span>ビジョンボード</h2>
        <span className="muted small">これまで → 1年後 → 3年後 → 10年後。ありたい姿に90日のプロジェクトをつなげます</span>
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
                <span className="num muted">{year + h.k}年</span>
              </div>
              {items.map((g) => <VisionCard key={g.id} g={g} owner={owner} act={act} />)}
              {items.length === 0 && !owner && <p className="muted small">まだありません</p>}
              {owner && <AddCard horizon={h.k} label={h.label} act={act} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const ym = (d?: string | null) => (d ? `${d.slice(0, 4)}年${Number(d.slice(5, 7))}月` : '');

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
        <h3>これまで</h3>
        <span className="muted small">成し遂げたこと {items.length}件</span>
      </div>
      <ol className="vb-timeline">
        {items.map((g) => (
          <li key={g.id}>
            <span className="vb-when">{ym(g.achieved_at)}</span>
            <div className="vb-done-body">
              <b>{g.title}</b>
              {g.note && <span className="vb-note">{g.note}</span>}
              {(g.horizon ?? 10) !== 0 && <span className="muted small">{g.horizon}年後のありたい姿を実現</span>}
              {g.projects?.length > 0 && <span className="muted small">プロジェクト {g.projects.length}件</span>}
            </div>
            {owner && (
              editing === g.id ? (
                <span className="vb-past-edit">
                  <input type="month" aria-label="実現した年月" defaultValue={(g.achieved_at ?? '').slice(0, 7)} onBlur={(e) => e.target.value && act(() => patch(`/life/goals/${g.id}`, { achieved_at: `${e.target.value}-01` }))} />
                  {(g.horizon ?? 10) !== 0 && <button className="btn btn-small btn-ghost" onClick={() => act(() => patch(`/life/goals/${g.id}`, { status: 'doing' }))}>ボードに戻す</button>}
                  <button className="btn btn-small btn-danger" onClick={() => act(() => del(`/life/goals/${g.id}`))}>削除</button>
                  <button className="btn btn-small btn-ghost" onClick={() => setEditing(null)}>閉じる</button>
                </span>
              ) : (
                <button className="icon-btn small" aria-label="編集" onClick={() => setEditing(g.id)}>…</button>
              )
            )}
          </li>
        ))}
      </ol>
      {items.length === 0 && <p className="muted small">これまでに成し遂げたことを残しておくと、ここに並びます。</p>}
      {owner && (
        <form
          className="vb-add vb-add-past"
          onSubmit={(e) => {
            e.preventDefault();
            if (f.title.trim()) act(() => post('/life/goals', { title: f.title, horizon: 0, achieved_at: `${f.achieved_at || todayJST().slice(0, 7)}-01` })).then(() => setF({ ...f, title: '' }));
          }}
        >
          <input id="vb-new-past-when" type="month" aria-label="成し遂げた年月" value={f.achieved_at} onChange={(e) => setF({ ...f, achieved_at: e.target.value })} />
          <input id="vb-new-past" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="＋ 成し遂げたこと" aria-label="成し遂げたことを追加" />
          {f.title.trim() && <button className="btn btn-small btn-primary">追加</button>}
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
          <select aria-label="状況" id={`vb-st-${g.id}`} className={`vb-status vb-s-${status}`} value={status} onChange={(e) => act(() => patch(`/life/goals/${g.id}`, { status: e.target.value }))}>
            {Object.entries(VB_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        ) : (
          <span className={`vb-status vb-s-${status}`}>{VB_STATUS[status]}</span>
        )}
        <span className="muted small">プロジェクト {g.projects?.length ?? 0}件</span>
        {owner && <button className="btn btn-small btn-ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '閉じる' : '編集'}</button>}
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
          <label>ありたい姿<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label>メモ・なぜ目指すか<textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
          <label>
            時間軸
            <select value={f.horizon} onChange={(e) => setF({ ...f, horizon: Number(e.target.value) })}>
              {HORIZONS.map((h) => <option key={h.k} value={h.k}>{h.label}</option>)}
            </select>
          </label>
          <div className="form-row">
            <button className="btn btn-primary" onClick={() => act(() => patch(`/life/goals/${g.id}`, f)).then(() => setOpen(false))}>保存</button>
            <button className="btn btn-danger" onClick={() => act(() => del(`/life/goals/${g.id}`))}>削除</button>
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
      <input id={`vb-new-${horizon}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`＋ ${label}のありたい姿`} aria-label={`${label}のありたい姿を追加`} />
      {title.trim() && <button className="btn btn-small btn-primary">追加</button>}
    </form>
  );
}
