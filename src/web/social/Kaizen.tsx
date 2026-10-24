import { useState } from 'react';
import { Link } from 'react-router-dom';
import { shortDate, todayJST } from '../../shared/dates';
import { del, patch, post } from '../api';
import { Avatar } from '../components/Avatar';

export const KAIZEN_STATUS: Record<string, string> = { idea: '候補', doing: '実行中', done: '完了', dropped: '見送り' };
const ORDER: Record<string, number> = { doing: 0, idea: 1, done: 2, dropped: 3 };

/** ミッション → ビジョン → この90日 → プロジェクト＋改善 の流れ（目標のページの上） */
export function FlowStrip({ life, term, projects, imps }: { life: any; term: any; projects: any[]; imps: any[] }) {
  const info = term.info;
  const open = imps.filter((i) => i.status === 'idea' || i.status === 'doing').length;
  const done = imps.filter((i) => i.status === 'done').length;
  const steps = [
    { no: 1, label: 'ミッション', body: life?.mission || '（まだ決まっていません）', to: '/life' },
    { no: 2, label: 'ビジョン', body: life?.vision || '（まだ決まっていません）', to: '/life' },
    {
      no: 3,
      label: 'この90日',
      body: info.phase === 'active' ? `Day ${info.dayNumber} / ${info.totalDays}・残り${info.daysLeft}日` : info.phase === 'upcoming' ? 'まだ始まっていません' : '終わりました',
      to: null,
    },
    { no: 4, label: 'プロジェクト＋改善', body: `${projects.length}件・改善 完了${done} / 残り${open}`, to: `/term/${term.id}/goals` },
  ];
  return (
    <ol className="flow-strip" aria-label="ミッションから90日のプロジェクトまで">
      {steps.map((s) => (
        <li key={s.no}>
          <span className="step-no">{s.no}</span>
          <span className="flow-label">{s.label}</span>
          {s.to ? <Link to={s.to} className="flow-body">{s.body}</Link> : <span className="flow-body">{s.body}</span>}
        </li>
      ))}
      <li className="flow-end" aria-hidden="true">{term.end_date.slice(5).replace('-', '/')} までにやりきる</li>
    </ol>
  );
}

/** プロジェクトごとの改善。誰でも出せて、期限はタームの最終日まで */
export function KaizenList({ goal, term, items, members, onChange }: { goal: any; term: any; items: any[]; members: any[]; onChange: () => void }) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ issue: '', action: '', due_date: '', owner_user_id: '' });
  const [err, setErr] = useState('');
  const today = todayJST();
  const list = [...items].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));
  const act = async (fn: () => Promise<unknown>) => {
    setErr('');
    try {
      await fn();
      onChange();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const counts = { done: items.filter((i) => i.status === 'done').length, all: items.filter((i) => i.status !== 'dropped').length };
  return (
    <div className="kaizen">
      <div className="kaizen-head">
        <span className="mini-title">改善</span>
        <span className="muted small">完了 {counts.done} / {counts.all}</span>
        <button className="btn btn-small btn-ghost" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>{adding ? '閉じる' : '＋ 改善を出す'}</button>
      </div>
      {list.length === 0 && !adding && <p className="muted small">課題と打ち手を出して、この90日の中で回しきりましょう。</p>}
      <ul className="kaizen-list">
        {list.map((i) => {
          const late = i.due_date && i.due_date < today && (i.status === 'idea' || i.status === 'doing');
          return (
            <li key={i.id} className={`kz kz-${i.status}`}>
              <select
                aria-label="状況"
                id={`kz-${i.id}`}
                className={`kz-status kz-s-${i.status}`}
                value={i.status}
                onChange={(e) => act(() => patch(`/improvements/${i.id}`, { status: e.target.value }))}
              >
                {Object.entries(KAIZEN_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <div className="kz-body">
                {i.issue && <span className="kz-issue">課題：{i.issue}</span>}
                <span className="kz-action">{i.action}</span>
                {i.status === 'done' ? (
                  <ResultInput item={i} onSave={(result) => act(() => patch(`/improvements/${i.id}`, { result }))} />
                ) : null}
              </div>
              <div className="kz-side">
                {i.owner_user_id && <Avatar name={i.owner_name} email={i.owner_email} src={i.owner_picture} size={22} />}
                {i.due_date && <span className={late ? 'kz-late' : 'muted small'}>{late ? '期限切れ ' : ''}{shortDate(i.due_date)}</span>}
                <button className="icon-btn small" aria-label="削除" onClick={() => act(() => del(`/improvements/${i.id}`))}>×</button>
              </div>
            </li>
          );
        })}
      </ul>
      {adding && (
        <form
          className="form kaizen-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (f.action.trim()) act(() => post(`/goals/${goal.id}/improvements`, f)).then(() => { setF({ issue: '', action: '', due_date: '', owner_user_id: '' }); setAdding(false); });
          }}
        >
          <label>課題・気づき<input id={`kz-issue-${goal.id}`} value={f.issue} placeholder="例：定期便の2回目で解約が多い" onChange={(e) => setF({ ...f, issue: e.target.value })} /></label>
          <label>打ち手<input id={`kz-action-${goal.id}`} value={f.action} required placeholder="例：2回目の同梱物にお茶の淹れ方カードを入れる" onChange={(e) => setF({ ...f, action: e.target.value })} /></label>
          <div className="form-row">
            <label>
              期限（{shortDate(term.end_date)}まで）
              <input id={`kz-due-${goal.id}`} type="date" min={term.start_date} max={term.end_date} value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
            </label>
            <label>
              担当
              <select id={`kz-owner-${goal.id}`} value={f.owner_user_id} onChange={(e) => setF({ ...f, owner_user_id: e.target.value })}>
                <option value="">自分</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
              </select>
            </label>
          </div>
          <button className="btn btn-primary" disabled={!f.action.trim()}>改善を出す</button>
        </form>
      )}
      {err && <p className="form-error">{err}</p>}
    </div>
  );
}

function ResultInput({ item, onSave }: { item: any; onSave: (v: string) => void }) {
  const [v, setV] = useState(item.result ?? '');
  return (
    <input
      className="kz-result"
      aria-label="結果・学び"
      placeholder="結果・学び（数字がどう動いたか）"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== (item.result ?? '') && onSave(v)}
    />
  );
}
