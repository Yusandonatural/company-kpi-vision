import { useState } from 'react';
import { Link } from 'react-router-dom';
import { WEEKDAYS_EN } from '../../shared/dates';
import { habitLabel, habitWeekdays } from '../../shared/progress';
import { patch, put } from '../api';
import { isEn, L } from '../i18n';
import { metricText, Progress } from './ui';

export function GoalPanel({ goals, termId, date, onChange, editable = true }: { goals: any[]; termId?: string; date: string; onChange: () => void; editable?: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const projects = goals.filter((g) => g.type === 'project');
  const habits = goals.filter((g) => g.type === 'habit');

  async function toggleHabit(g: any) {
    g.doneOnDate = !g.doneOnDate;
    onChange();
    await put(`/goals/${g.id}/habit/${date}`, { done: g.doneOnDate });
    onChange();
  }

  async function toggleMilestone(m: any) {
    m.done = m.done ? 0 : 1;
    onChange();
    await patch(`/milestones/${m.id}`, { done: !!m.done });
    onChange();
  }

  if (goals.length === 0) {
    return (
      <div className="empty">
        <p>{L('このタームの目標がまだありません。', 'No goals for this term yet.')}</p>
        {termId && <Link className="btn btn-primary btn-small" to={`/term/${termId}/goals`}>{L('目標を立てる', 'Set goals')}</Link>}
      </div>
    );
  }

  return (
    <div className="goal-panel">
      {projects.length > 0 && <h3 className="mini-title">{L('プロジェクト', 'Projects')}</h3>}
      <ul className="goal-list">
        {projects.map((g) => (
          <li key={g.id} className={g.behind ? 'behind' : ''}>
            <button type="button" className="goal-head" onClick={() => setOpen(open === g.id ? null : g.id)} aria-expanded={open === g.id} title={g.why || undefined}>
              <span className="goal-title">{g.title}</span>
              <span className="goal-pct">{g.progress}%</span>
            </button>
            <Progress value={g.progress} tone={g.behind ? 'warn' : undefined} />
            {metricText(g) && <p className="goal-metric">{metricText(g)}</p>}
            {g.behind && <p className="goal-warn">{L('経過に対して遅れています', 'Behind schedule')}</p>}
            {open === g.id && (
              <div className="goal-detail">
                {g.why && <p className="muted small">{L('なぜ', 'Why')}: {g.why}</p>}
                {g.metric_target != null && editable && <MetricUpdate goal={g} onChange={onChange} />}
                {g.obstacle && (
                  <p className="obstacle small">
                    <strong>{L('障害', 'Obstacle')}:</strong> {g.obstacle}
                    {g.obstacle_plan && <><br /><strong>{L('対策', 'Plan')}:</strong> {g.obstacle_plan}</>}
                  </p>
                )}
                {g.milestones.length === 0 && <p className="muted small">{L('マイルストーンなし（進捗は手動）', 'No milestones (manual progress)')}</p>}
                <ul className="check-list">
                  {g.milestones.map((m: any) => (
                    <li key={m.id}>
                      <label className="check">
                        <input type="checkbox" checked={!!m.done} onChange={() => toggleMilestone(m)} disabled={!editable} />
                        <span className={m.done ? 'done' : ''}>{m.title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                {termId && <Link className="small" to={`/term/${termId}/goals`}>{L('目標を編集', 'Edit goals')}</Link>}
              </div>
            )}
          </li>
        ))}
      </ul>
      {habits.length > 0 && <h3 className="mini-title">{L('習慣', 'Habits')}</h3>}
      <ul className="habit-list">
        {habits.map((g) => (
          <li key={g.id}>
            <label className={`check ${g.scheduledOnDate === false ? 'off-day' : ''}`}>
              <input type="checkbox" checked={!!g.doneOnDate} onChange={() => toggleHabit(g)} disabled={!editable} />
              <span>{g.title}</span>
            </label>
            <span className="habit-meta">
              {habitText(g)} ・ {g.habit_frequency === 'weekly' ? `${L('今週', 'This week')} ${g.habit.weekDone}/${g.habit.weekTarget}` : g.habit.currentStreak > 0 ? L(`連続${g.habit.currentStreak}日`, `${g.habit.currentStreak}-day streak`) : `${g.habit.pct}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 習慣の頻度の表示（英語のときは画面側で訳す） */
function habitText(g: any): string {
  if (!isEn) return habitLabel(g);
  if (g.habit_frequency === 'weekly') return `${g.habit_times_per_week ?? 1}x/week`;
  if (g.habit_frequency === 'weekdays') return habitWeekdays(g).map((w) => WEEKDAYS_EN[w]).join('·') || 'No days set';
  return 'Daily';
}

/** 数値目標の現在値をその場で更新する */
export function MetricUpdate({ goal, onChange }: { goal: any; onChange: () => void }) {
  const [v, setV] = useState(String(goal.metric_current ?? goal.metric_start ?? 0));
  async function save(next: string) {
    setV(next);
    await patch(`/goals/${goal.id}`, { metric_current: next });
    onChange();
  }
  const step = (d: number) => save(String(Math.round(((Number(v) || 0) + d) * 100) / 100));
  return (
    <div className="metric-update">
      <span className="small muted">{L('現在の値', 'Current')}</span>
      <button type="button" className="icon-btn small" aria-label={L('1減らす', 'Decrease by 1')} onClick={() => step(-1)}>−</button>
      <input type="number" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => save(v)} aria-label={L('現在の値', 'Current value')} />
      <button type="button" className="icon-btn small" aria-label={L('1増やす', 'Increase by 1')} onClick={() => step(1)}>＋</button>
      <span className="small muted">/ {goal.metric_target}{goal.metric_unit ?? ''}</span>
    </div>
  );
}

/** 日々の入力の上に常に表示する、今タームの目標（と会社のビジョン）の帯 */
export function GoalStrip({ goals, termId, date, elapsedPct, vision, onChange, editable }: {
  goals: any[];
  termId?: string;
  date: string;
  elapsedPct?: number;
  vision?: string;
  onChange: () => void;
  editable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const projects = goals.filter((g) => g.type === 'project');
  const habits = goals.filter((g) => g.type === 'habit');
  const doneHabits = habits.filter((h) => h.doneOnDate).length;

  async function toggleHabit(g: any) {
    g.doneOnDate = !g.doneOnDate;
    onChange();
    await put(`/goals/${g.id}/habit/${date}`, { done: g.doneOnDate });
    onChange();
  }

  return (
    <section className="goal-strip no-swipe" aria-label={L('今タームの目標', 'Goals this term')}>
      {vision?.trim() && (
        <Link to="/life" className="gs-vision" title={L('会社のビジョンを見る', 'View company vision')}>
          <span className="gs-vision-label">{L('ビジョン', 'Vision')}</span>
          <span className="gs-vision-text">{vision}</span>
        </Link>
      )}
      <div className="gs-head">
        <span className="gs-label">{L('今タームの目標', 'Goals this term')}</span>
        {elapsedPct != null && <span className="gs-elapsed">{L('経過', 'Elapsed')} {elapsedPct}%</span>}
        <span className="spacer" />
        {goals.length > 0 && (
          <button type="button" className="gs-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? L('閉じる', 'Close') : L('詳しく', 'Details')}
          </button>
        )}
      </div>
      {goals.length === 0 ? (
        <p className="gs-empty">
          {L('目標がまだありません。', 'No goals yet. ')}{termId && <Link to={`/term/${termId}/goals`}>{L('目標を立てる', 'Set goals')}</Link>}
        </p>
      ) : open ? (
        <div className="gs-detail">
          <GoalPanel goals={goals} termId={termId} date={date} onChange={onChange} editable={editable} />
        </div>
      ) : (
        <>
          <ul className="gs-projects">
            {projects.map((g) => (
              <li key={g.id} className={g.behind ? 'behind' : ''}>
                <span className="gs-title">{g.title}</span>
                <span className="gs-bar" aria-hidden="true"><span style={{ width: `${g.progress}%` }} /></span>
                <span className="gs-pct">{metricText(g) ?? `${g.progress}%`}</span>
              </li>
            ))}
          </ul>
          {habits.length > 0 && (
            <div className="gs-habits" role="group" aria-label={`${L('今日の習慣', 'Habits today')} ${doneHabits}/${habits.length}`}>
              <span className="gs-habits-count">{L('習慣', 'Habits')} {doneHabits}/{habits.length}</span>
              {habits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  className={`gs-habit ${h.doneOnDate ? 'on' : ''} ${h.scheduledOnDate === false ? 'off-day' : ''}`}
                  aria-pressed={!!h.doneOnDate}
                  disabled={!editable}
                  onClick={() => toggleHabit(h)}
                >
                  {h.doneOnDate ? '✓ ' : ''}{h.title}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
