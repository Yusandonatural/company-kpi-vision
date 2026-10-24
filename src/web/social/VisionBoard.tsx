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
        <span className="muted small">ありたい姿に、90日のプロジェクトをつなげます</span>
      </div>
      {err && <p className="form-error">{err}</p>}
      <div className="vb-lanes">
        {HORIZONS.map((h) => {
          const items = goals.filter((g) => (g.horizon ?? 10) === h.k).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.sort_order - b.sort_order);
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
