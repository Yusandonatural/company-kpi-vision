import { useState } from 'react';
import { Link } from 'react-router-dom';
import { shortDate, todayJST } from '../../shared/dates';
import { del, patch, post } from '../api';
import { Avatar } from '../components/Avatar';
import { L } from '../i18n';

/** 改善ポイントの指摘 → 修正。状況の値はそのまま、見せ方だけ「指摘・修正中・修正済み・見送り」 */
export const KAIZEN_STATUS: Record<string, string> = { idea: L('指摘', 'Flagged'), doing: L('修正中', 'Fixing'), done: L('修正済み', 'Fixed'), dropped: L('見送り', 'Dropped') };
const ORDER: Record<string, number> = { doing: 0, idea: 1, done: 2, dropped: 3 };

/** ミッション → ビジョン → この90日 → プロジェクト／改善 の流れ（目標のページの上） */
export function FlowStrip({ life, term, projects, imps }: { life: any; term: any; projects: any[]; imps: any[] }) {
  const info = term.info;
  const open = imps.filter((i) => i.status === 'idea' || i.status === 'doing').length;
  const done = imps.filter((i) => i.status === 'done').length;
  const steps = [
    { no: 1, label: L('ミッション', 'Mission'), body: life?.mission || L('（まだ決まっていません）', '(not set yet)'), to: '/life' },
    { no: 2, label: L('ビジョン', 'Vision'), body: life?.vision || L('（まだ決まっていません）', '(not set yet)'), to: '/life' },
    {
      no: 3,
      label: L('この90日', 'These 90 days'),
      body:
        info.phase === 'active'
          ? L(`Day ${info.dayNumber} / ${info.totalDays}・残り${info.daysLeft}日`, `Day ${info.dayNumber} / ${info.totalDays} · ${info.daysLeft} days left`)
          : info.phase === 'upcoming'
            ? L('まだ始まっていません', 'Not started yet')
            : L('終わりました', 'Finished'),
      to: null,
    },
    { no: 4, label: L('プロジェクト', 'Projects'), body: L(`${projects.length}件`, `${projects.length}`), to: `/term/${term.id}/goals` },
    { no: 5, label: L('改善', 'Kaizen'), body: L(`修正済み${done} / 残り${open}`, `${done} fixed / ${open} open`), to: `#kaizen` },
  ];
  return (
    <ol className="flow-strip" aria-label={L('ミッションから90日のプロジェクトと改善まで', 'From mission to 90-day projects and kaizen')}>
      {steps.map((s) => (
        <li key={s.no}>
          <span className="step-no">{s.no}</span>
          <span className="flow-label">{s.label}</span>
          {s.to?.startsWith('#') ? <a href={s.to} className="flow-body">{s.body}</a> : s.to ? <Link to={s.to} className="flow-body">{s.body}</Link> : <span className="flow-body">{s.body}</span>}
        </li>
      ))}
      <li className="flow-end" aria-hidden="true">{L(`${term.end_date.slice(5).replace('-', '/')} までにやりきる`, `Finish by ${shortDate(term.end_date)}`)}</li>
    </ol>
  );
}

/** この90日の改善。改善ポイントを指摘 → 修正。プロジェクトとは別に出し、つなぐのは任意。誰でも指摘でき、期限はタームの最終日まで */
export function KaizenList({ term, items, projects, members, onChange }: { term: any; items: any[]; projects: any[]; members: any[]; onChange: () => void }) {
  const [adding, setAdding] = useState(false);
  const empty = { issue: '', due_date: '', owner_user_id: '', goal_id: '' };
  const [f, setF] = useState(empty);
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
        <span className="muted small">{L('修正済み ', 'Fixed ')}{counts.done} / {counts.all}</span>
        <button className="btn btn-small btn-ghost" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>{adding ? L('閉じる', 'Close') : L('＋ 改善ポイントを指摘', '+ Flag a kaizen point')}</button>
      </div>
      {list.length === 0 && !adding && <p className="muted small">{L('気づいた改善ポイントを指摘して、この90日の中で修正しきりましょう。', 'Flag what should improve, and get it fixed within these 90 days.')}</p>}
      <ul className="kaizen-list">
        {list.map((i) => {
          const late = i.due_date && i.due_date < today && (i.status === 'idea' || i.status === 'doing');
          return (
            <li key={i.id} className={`kz kz-${i.status}`}>
              <select
                aria-label={L('状況', 'Status')}
                id={`kz-${i.id}`}
                className={`kz-status kz-s-${i.status}`}
                value={i.status}
                onChange={(e) => act(() => patch(`/improvements/${i.id}`, { status: e.target.value }))}
              >
                {Object.entries(KAIZEN_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <div className="kz-body">
                <span className="kz-point">{i.issue || i.action}</span>
                <FixInput item={i} onSave={(action) => act(() => patch(`/improvements/${i.id}`, i.issue ? { action } : { issue: i.action, action }))} />
                {i.result && <span className="kz-issue">{L('結果：', 'Result: ')}{i.result}</span>}
                {i.goal_title && <span className="kz-project">◎ {i.goal_title}</span>}
              </div>
              <div className="kz-side">
                {i.owner_user_id && <Avatar name={i.owner_name} email={i.owner_email} src={i.owner_picture} size={22} />}
                {i.due_date && <span className={late ? 'kz-late' : 'muted small'}>{late ? L('期限切れ ', 'Overdue ') : ''}{shortDate(i.due_date)}</span>}
                <button className="icon-btn small" aria-label={L('削除', 'Delete')} onClick={() => act(() => del(`/improvements/${i.id}`))}>×</button>
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
            if (f.issue.trim()) act(() => post(`/terms/${term.id}/improvements`, { ...f, goal_id: f.goal_id || null })).then(() => { setF(empty); setAdding(false); });
          }}
        >
          <label>{L('改善ポイント（指摘）', 'Kaizen point (what to fix)')}<input id="kz-issue" value={f.issue} required placeholder={L('例：定期便の2回目で解約が多い', 'e.g. Many subscribers cancel after the 2nd box')} onChange={(e) => setF({ ...f, issue: e.target.value })} /></label>
          <div className="form-row">
            <label>
              {L(`期限（${shortDate(term.end_date)}まで）`, `Due (by ${shortDate(term.end_date)})`)}
              <input id="kz-due" type="date" min={term.start_date} max={term.end_date} value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
            </label>
            <label>
              {L('担当', 'Owner')}
              <select id="kz-owner" value={f.owner_user_id} onChange={(e) => setF({ ...f, owner_user_id: e.target.value })}>
                <option value="">{L('自分', 'Me')}</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
              </select>
            </label>
          </div>
          <label>
            {L('つながるプロジェクト（任意）', 'Related project (optional)')}
            <select id="kz-project" value={f.goal_id} onChange={(e) => setF({ ...f, goal_id: e.target.value })}>
              <option value="">{L('なし', 'None')}</option>
              {projects.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" disabled={!f.issue.trim()}>{L('指摘する', 'Flag it')}</button>
        </form>
      )}
      {err && <p className="form-error">{err}</p>}
    </div>
  );
}

/** 修正：どう直すか・どう直したか（指摘のあとから書く） */
function FixInput({ item, onSave }: { item: any; onSave: (v: string) => void }) {
  const fix = item.issue ? item.action ?? '' : '';
  const [v, setV] = useState(fix);
  return (
    <label className="kz-fix">
      <span>{L('修正', 'Fix')}</span>
      <input
        aria-label={L('修正', 'Fix')}
        placeholder={item.status === 'done' ? L('どう直したか', 'How it was fixed') : L('どう直すか（直したら「修正済み」に）', 'How to fix it (then mark as Fixed)')}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== fix && onSave(v)}
      />
    </label>
  );
}
