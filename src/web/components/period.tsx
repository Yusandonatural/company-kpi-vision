import { useState } from 'react';
import { Link } from 'react-router-dom';
import { shortDate, weekdayName } from '../../shared/dates';
import { put } from '../api';
import { useAutosave } from '../hooks';
import { StatusChip, TaskActions, type Task } from './TaskRow';
import { Progress, SaveBadge, Stars, Stat, metricText, pct } from './ui';
import { L } from '../i18n';

/** 英語表示用の期間名（「週」「月」を受け取る） */
const unitEn = (u: string) => (u === '週' || u === 'week' ? 'week' : u === '月' || u === 'month' ? 'month' : u);

export interface Note {
  theme: string;
  /** kaizen_id: 未達の目標を改善ポイントにしたとき、その改善の id */
  targets: { text: string; done: boolean; kaizen_id?: string }[];
  plan_memo: string;
  review_good: string;
  review_bad: string;
  review_learn: string;
  review_next: string;
  review_score: number | null;
  reviewed: boolean;
}

export function useNote(kind: string, start: string, initial: Note) {
  const save = useAutosave((v: Partial<Note>) => put(`/periods/${kind}/${start}`, v), 800, `/api/periods/${kind}/${start}`, `fj.draft.${kind}.${start}`);
  // 前回保存しきれなかった下書きがあれば重ねる
  const [note, setNote] = useState<Note>(() => ({ ...initial, ...(save.takeDraft() ?? {}) }));
  const update = (p: Partial<Note>, immediate = false) => {
    setNote((n) => ({ ...n, ...p }));
    save.schedule(p);
    if (immediate) save.flush();
  };
  return { note, update, save };
}

export function PlanEditor({ note, update, unit, prevNext }: { note: Note; update: (p: Partial<Note>, now?: boolean) => void; unit: string; prevNext?: string }) {
  const targets = note.targets;
  const setTargets = (t: Note['targets'], now = false) => update({ targets: t }, now);
  return (
    <section className="card">
      <h2 className="card-title">{L(`${unit}の予定`, `Plan for the ${unitEn(unit)}`)}</h2>
      {prevNext?.trim() && (
        <div className="notice soft">
          <strong>{L('前回のレビューで決めたこと', 'Decided at the last review')}</strong>
          <p className="pre">{prevNext}</p>
        </div>
      )}
      <label className="field">
        <span>{L(`${unit}のテーマ`, `Theme of the ${unitEn(unit)}`)}</span>
        <input className="big-input" value={note.theme} placeholder={L(`この${unit}、いちばん大事にすること`, `What matters most this ${unitEn(unit)}`)} onChange={(e) => update({ theme: e.target.value })} />
      </label>
      <div className="field">
        <span>{L(`${unit}の目標`, `Goals for the ${unitEn(unit)}`)}</span>
        <ul className="target-list">
          {targets.map((t, i) => (
            <li key={i}>
              <input type="checkbox" checked={t.done} onChange={(e) => setTargets(targets.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)), true)} aria-label={L('達成', 'Done')} />
              <input value={t.text} onChange={(e) => setTargets(targets.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} className={t.done ? 'done' : ''} />
              <button type="button" className="icon-btn" aria-label={L('削除', 'Delete')} onClick={() => setTargets(targets.filter((_, j) => j !== i), true)}>×</button>
            </li>
          ))}
        </ul>
        {targets.length < 10 && (
          <button type="button" className="btn btn-small btn-ghost" onClick={() => setTargets([...targets, { text: '', done: false }])}>{L('＋ 目標を追加', '+ Add goal')}</button>
        )}
      </div>
      <label className="field">
        <span>{L('メモ', 'Notes')}</span>
        <textarea rows={3} value={note.plan_memo} onChange={(e) => update({ plan_memo: e.target.value })} />
      </label>
    </section>
  );
}

export function ReviewForm({ note, update, nextLabel, state }: { note: Note; update: (p: Partial<Note>, now?: boolean) => void; nextLabel: string; state: any }) {
  const fields: [keyof Note, string, string][] = [
    ['review_good', L('良かったこと・できたこと', 'What went well'), ''],
    ['review_bad', L('うまくいかなかったこと', 'What didn\'t go well'), ''],
    ['review_learn', L('学び・気づき', 'Lessons & insights'), ''],
    ['review_next', nextLabel, L('次の予定のページに表示されます', 'Shown on the next period\'s plan')],
  ];
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">{L('ふりかえり', 'Review')}</h2>
        <SaveBadge state={state} />
      </div>
      {fields.map(([k, label, hint]) => (
        <label className="field" key={k}>
          <span>{label}{hint && <em className="muted small">（{hint}）</em>}</span>
          <textarea rows={3} value={note[k] as string} onChange={(e) => update({ [k]: e.target.value })} />
        </label>
      ))}
      <div className="field">
        <span>{L('自己評価', 'Self-rating')}</span>
        <Stars value={note.review_score} onChange={(v) => update({ review_score: v }, true)} />
      </div>
      <button className={`btn ${note.reviewed ? 'btn-done' : 'btn-primary'}`} onClick={() => update({ reviewed: !note.reviewed }, true)}>
        {note.reviewed ? L('✓ レビュー完了', '✓ Review done') : L('レビューを完了する', 'Finish review')}
      </button>
    </section>
  );
}

export function PeriodStats({ data, unit }: { data: any; unit: string }) {
  const s = data.stats;
  const diff = s.rate != null && data.prevStats.rate != null ? s.rate - data.prevStats.rate : null;
  const habitDone = data.habits.reduce((a: number, h: any) => a + h.done, 0);
  const habitTarget = data.habits.reduce((a: number, h: any) => a + h.target, 0);
  return (
    <div className="stats">
      <Stat label={L('タスク達成率', 'Task completion')} value={pct(s.rate)} sub={diff == null ? L(`前${unit}の記録なし`, `No record last ${unitEn(unit)}`) : L(`前${unit}比 ${diff >= 0 ? '+' : ''}${diff}pt`, `${diff >= 0 ? '+' : ''}${diff}pt vs last ${unitEn(unit)}`)} tone={diff != null && diff < 0 ? 'warn' : undefined} />
      <Stat label={L('できた／できなかった', 'Done / missed')} value={`${s.done} / ${s.missed + s.carried}`} sub={L(`未着手 ${s.todo}`, `Not started ${s.todo}`)} />
      <Stat label={L('習慣', 'Habits')} value={habitTarget ? `${Math.round((habitDone / habitTarget) * 100)}%` : '—'} sub={L(`${habitDone} / ${habitTarget}回`, `${habitDone} / ${habitTarget} times`)} />
      <Stat label={L('記入した日', 'Days logged')} value={data.fill.days ? L(`${data.fill.filled} / ${data.fill.days}日`, `${data.fill.filled} / ${data.fill.days} days`) : '—'} sub={pct(data.fill.pct)} />
    </div>
  );
}

export function HabitWeekTable({ habits, onToggle }: { habits: any[]; onToggle?: (goalId: string, date: string, done: boolean) => void }) {
  if (habits.length === 0) return null;
  const dates = habits[0].days.map((d: any) => d.date);
  return (
    <div className="table-wrap">
      <table className="habit-table">
        <thead>
          <tr>
            <th>{L('習慣', 'Habits')}</th>
            {dates.map((d: string) => (
              <th key={d}>{weekdayName(d)}<br /><span className="muted small">{shortDate(d)}</span></th>
            ))}
            <th>{L('達成', 'Done')}</th>
          </tr>
        </thead>
        <tbody>
          {habits.map((h) => (
            <tr key={h.id}>
              <th scope="row">{h.title}</th>
              {h.days.map((d: any) => (
                <td key={d.date} className={d.scheduled ? '' : 'off'}>
                  <button
                    type="button"
                    className={`habit-cell ${d.done ? 'on' : ''}`}
                    aria-pressed={d.done}
                    aria-label={`${h.title} ${d.date}`}
                    disabled={!onToggle}
                    onClick={() => onToggle?.(h.id, d.date, !d.done)}
                  />
                </td>
              ))}
              <td className="num">{h.done}/{h.target}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ByGoalTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) return <p className="muted">{L('タスクはまだありません', 'No tasks yet')}</p>;
  return (
    <table className="simple-table">
      <thead>
        <tr><th>{L('目標', 'Goal')}</th><th>{L('できた', 'Done')}</th><th>{L('できなかった', 'Missed')}</th><th>{L('達成率', 'Rate')}</th></tr>
      </thead>
      <tbody>
        {rows.map((g) => (
          <tr key={g.goal_id ?? 'none'}>
            <td>{g.goal_title}</td>
            <td className="num">{g.stats.done}</td>
            <td className="num">{g.stats.missed + g.stats.carried}</td>
            <td className="num">{pct(g.stats.rate)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function GoalProgressList({ goals }: { goals: any[] }) {
  if (goals.length === 0) return <p className="muted">{L('プロジェクト目標はまだありません', 'No project goals yet')}</p>;
  return (
    <ul className="goal-progress">
      {goals.map((g) => (
        <li key={g.id}>
          <div className="row"><span>{g.title}{metricText(g) && <span className="muted small">（{metricText(g)}）</span>}</span><span className="num">{g.progress}%</span></div>
          <Progress value={g.progress} tone={g.behind ? 'warn' : undefined} />
        </li>
      ))}
    </ul>
  );
}

export function DoneMissedLists({ days, today, onChange }: { days: any[]; today: string; onChange: () => void }) {
  const all: Task[] = days.flatMap((d) => d.tasks);
  const done = all.filter((t) => t.status === 'done');
  const missed = all.filter((t) => t.status === 'missed');
  return (
    <div className="two-col">
      <section className="card">
        <h2 className="card-title">{L('できたこと', 'Done')} <span className="count">{done.length}</span></h2>
        <ul className="plain-list">
          {done.map((t) => (
            <li key={t.id}><Link to={`/day/${t.date}`} className="muted small">{shortDate(t.date)}</Link> {t.title}</li>
          ))}
          {done.length === 0 && <li className="muted">{L('まだありません', 'None yet')}</li>}
        </ul>
      </section>
      <section className="card">
        <h2 className="card-title">{L('できなかったこと', 'Missed')} <span className="count">{missed.length}</span></h2>
        <ul className="plain-list">
          {missed.map((t) => (
            <li key={t.id} className="with-actions">
              <span><Link to={`/day/${t.date}`} className="muted small">{shortDate(t.date)}</Link> {t.title} {t.carry_count > 0 && <span className="chip chip-soft">{L(`送った ${t.carry_count}回`, `Carried ${t.carry_count}×`)}</span>}</span>
              <TaskActions task={t} today={today} onChange={onChange} />
            </li>
          ))}
          {missed.length === 0 && <li className="muted">{L('ありません', 'None')}</li>}
        </ul>
      </section>
    </div>
  );
}

export function GoodsList({ days }: { days: any[] }) {
  const goods = days.flatMap((d) => d.goods.map((g: string) => ({ date: d.date, text: g })));
  return (
    <section className="card">
      <h2 className="card-title">{L('良かったこと', 'What went well')} <span className="count">{goods.length}</span></h2>
      <ul className="plain-list">
        {goods.map((g, i) => (
          <li key={i}><Link to={`/day/${g.date}`} className="muted small">{shortDate(g.date)}</Link> {g.text}</li>
        ))}
        {goods.length === 0 && <li className="muted">{L('まだありません', 'None yet')}</li>}
      </ul>
    </section>
  );
}

export { StatusChip };
