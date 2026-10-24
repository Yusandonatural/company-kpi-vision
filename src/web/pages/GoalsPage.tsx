import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { shortDate, weekdayName } from '../../shared/dates';
import { LANG_SOURCES } from '../../shared/langs';
import { del, patch, post } from '../api';
import { TermHeader } from '../components/TermHeader';
import { ErrorBox, Loading, Progress, metricText } from '../components/ui';
import { useApi } from '../hooks';
import { L } from '../i18n';
import { HORIZONS } from '../social/VisionBoard';

// 2026-01-04 は日曜。曜日名は weekdayName で言語に合わせる（言語の設定後に呼ぶ）
const wdName = (w: number) => weekdayName(`2026-01-${String(4 + w).padStart(2, '0')}`);

export function GoalsPage() {
  const { id = '' } = useParams();
  const { data: term, error, reload } = useApi<any>(`/terms/${id}`);
  const carriedIn = useApi<any[]>(`/terms/${id}/carried-in`);
  const life = useApi<any>('/life');
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!term) return <Loading />;
  const projects = term.goals.filter((g: any) => g.type === 'project');
  const habits = term.goals.filter((g: any) => g.type === 'habit');

  return (
    <div className="page narrow-wide">
      <TermHeader term={term} tab="goals" />
      <p className="muted">{L('3ヶ月で「完了させる」ものはプロジェクト、「続ける」ものは習慣として立てます。目安は合わせて3〜5個です。', 'Things to finish in 90 days are projects; things to keep doing are habits. Aim for 3–5 in total.')}</p>
      {term.goals.length >= 6 && <div className="notice warn">{L(`目標が ${term.goals.length}個あります。絞ったほうが達成しやすくなります。`, `You have ${term.goals.length} goals. Fewer goals are easier to achieve.`)}</div>}

      {carriedIn.data && carriedIn.data.length > 0 && (
        <section className="card">
          <h2 className="card-title">{L('前のタームから持ち越したこと', 'Carried over from the last term')}</h2>
          <ul className="plain-list">
            {carriedIn.data.map((t: any) => (
              <CarriedItem key={t.id} task={t} projects={projects} onDone={() => { carriedIn.reload(); reload(); }} />
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="card-title">{L('プロジェクト目標', 'Project goals')}</h2>
        {projects.map((g: any, i: number) => (
          <GoalEditor key={g.id} goal={g} first={i === 0} last={i === projects.length - 1} onChange={reload} visions={life.data?.goals ?? []} />
        ))}
        <AddGoal termId={term.id} type="project" onAdded={reload} />
      </section>

      <section className="card">
        <h2 className="card-title">{L('習慣目標', 'Habit goals')}</h2>
        {habits.map((g: any, i: number) => (
          <GoalEditor key={g.id} goal={g} first={i === 0} last={i === habits.length - 1} onChange={reload} />
        ))}
        <AddGoal termId={term.id} type="habit" onAdded={reload} />
      </section>
    </div>
  );
}

function CarriedItem({ task, projects, onDone }: { task: any; projects: any[]; onDone: () => void }) {
  const [goal, setGoal] = useState(projects[0]?.id ?? '');
  return (
    <li className="with-actions">
      <span><span className="muted small">{shortDate(task.date)}</span> {task.title}</span>
      <span className="inline-form">
        {projects.length > 0 ? (
          <>
            <select value={goal} onChange={(e) => setGoal(e.target.value)} aria-label={L('追加先の目標', 'Target goal')}>
              {projects.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
            <button className="btn btn-small" onClick={async () => { await post(`/tasks/${task.id}/to-milestone`, { goal_id: goal }); onDone(); }}>{L('マイルストーンにする', 'Make it a milestone')}</button>
          </>
        ) : (
          <span className="muted small">{L('先にプロジェクト目標を作ってください', 'Create a project goal first')}</span>
        )}
        <button className="btn btn-small btn-ghost" onClick={async () => { await patch(`/tasks/${task.id}`, { carry_over: false }); onDone(); }}>{L('外す', 'Remove')}</button>
      </span>
    </li>
  );
}

function AddGoal({ termId, type, onAdded }: { termId: string; type: 'project' | 'habit'; onAdded: () => void }) {
  const [title, setTitle] = useState('');
  async function add() {
    if (!title.trim()) return;
    await post(`/terms/${termId}/goals`, { type, title });
    setTitle('');
    onAdded();
  }
  return (
    <form className="add-row" onSubmit={(e) => (e.preventDefault(), add())}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'project' ? L('例: カフェ／SHOPをオープンする', 'e.g. Open the café / shop') : L('例: 毎日フランス語の日記を書く', 'e.g. Write a French diary every day')} aria-label={L('新しい目標', 'New goal')} />
      <button className="btn btn-primary" disabled={!title.trim()}>{L('追加', 'Add')}</button>
    </form>
  );
}

function GoalEditor({ goal, first, last, onChange, visions = [] }: { goal: any; first: boolean; last: boolean; onChange: () => void; visions?: any[] }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    title: goal.title,
    why: goal.why ?? '',
    obstacle: goal.obstacle ?? '',
    obstacle_plan: goal.obstacle_plan ?? '',
    metric_unit: goal.metric_unit ?? '',
    metric_start: goal.metric_start ?? '',
    metric_current: goal.metric_current ?? '',
    metric_target: goal.metric_target ?? '',
  });
  const blurSave = (k: keyof typeof f) => () => String(f[k]) !== String(goal[k] ?? '') && save({ [k]: f[k] });
  const [ms, setMs] = useState('');
  const weekdays: number[] = JSON.parse(goal.habit_weekdays_json || '[]');
  const save = async (p: Record<string, unknown>) => {
    await patch(`/goals/${goal.id}`, p);
    onChange();
  };

  return (
    <div className={`goal-editor ${goal.behind ? 'behind' : ''}`}>
      <div className="goal-editor-head">
        <input
          className="goal-title-input"
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          onBlur={() => f.title.trim() && f.title !== goal.title && save({ title: f.title })}
          aria-label={L('目標', 'Goal')}
        />
        <span className="num">{goal.progress}%</span>
        <button className="icon-btn" disabled={first} aria-label={L('上へ', 'Move up')} onClick={async () => { await post(`/goals/${goal.id}/move`, { dir: -1 }); onChange(); }}>↑</button>
        <button className="icon-btn" disabled={last} aria-label={L('下へ', 'Move down')} onClick={async () => { await post(`/goals/${goal.id}/move`, { dir: 1 }); onChange(); }}>↓</button>
        <button className="btn btn-small btn-ghost" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? L('閉じる', 'Close') : L('詳細', 'Details')}</button>
      </div>
      <Progress value={goal.progress} tone={goal.behind ? 'warn' : undefined} />
      {goal.link_source && LANG_SOURCES[goal.link_source] && (
        <p className="muted small goal-sub"><span>🔗 {L(`${LANG_SOURCES[goal.link_source].label}と連動`, `Linked to ${LANG_SOURCES[goal.link_source].label}`)}{goal.type === 'habit' ? L('（学習した日に自動で ✓）', ' (auto ✓ on study days)') : L('（クリアした Day 数 ÷ 90）', ' (days cleared ÷ 90)')}</span></p>
      )}
      {(metricText(goal) || goal.obstacle) && (
        <p className="muted small goal-sub">
          {metricText(goal) && <span>{L('数値目標', 'Target')} {metricText(goal)}</span>}
          {goal.obstacle && <span>{L('障害', 'Obstacle')}: {goal.obstacle}</span>}
        </p>
      )}

      {goal.type === 'project' && (
        <ul className="check-list">
          {goal.milestones.map((m: any) => (
            <li key={m.id} className="with-actions">
              <label className="check">
                <input type="checkbox" checked={!!m.done} onChange={async () => { await patch(`/milestones/${m.id}`, { done: !m.done }); onChange(); }} />
                <span className={m.done ? 'done' : ''}>{m.title}</span>
              </label>
              <button className="icon-btn small" aria-label={L('削除', 'Delete')} onClick={async () => { await del(`/milestones/${m.id}`); onChange(); }}>×</button>
            </li>
          ))}
          <li>
            <form className="add-row small" onSubmit={async (e) => { e.preventDefault(); if (!ms.trim()) return; await post(`/goals/${goal.id}/milestones`, { title: ms }); setMs(''); onChange(); }}>
              <input value={ms} onChange={(e) => setMs(e.target.value)} placeholder={L('マイルストーンを追加', 'Add a milestone')} aria-label={L('マイルストーン', 'Milestone')} />
              <button className="btn btn-small" disabled={!ms.trim()}>{L('追加', 'Add')}</button>
            </form>
          </li>
        </ul>
      )}

      {open && (
        <div className="goal-detail form">
          <label>
            {L('なぜやるか', 'Why it matters')}
            <input value={f.why} onChange={(e) => setF({ ...f, why: e.target.value })} onBlur={() => f.why !== (goal.why ?? '') && save({ why: f.why })} placeholder={L('動機をひとこと', 'Your motivation in a few words')} />
          </label>
          {goal.type === 'project' && (
            <fieldset>
              <legend>{L('数値目標（入れると進捗はこの数字で計算します）', 'Numeric target (progress is calculated from it when set)')}</legend>
              <div className="form-row">
                <label>
                  {L('開始値', 'Start')}
                  <input type="number" inputMode="decimal" value={f.metric_start} onChange={(e) => setF({ ...f, metric_start: e.target.value })} onBlur={blurSave('metric_start')} />
                </label>
                <label>
                  {L('現在値', 'Current')}
                  <input type="number" inputMode="decimal" value={f.metric_current} onChange={(e) => setF({ ...f, metric_current: e.target.value })} onBlur={blurSave('metric_current')} />
                </label>
                <label>
                  {L('目標値', 'Target')}
                  <input type="number" inputMode="decimal" value={f.metric_target} onChange={(e) => setF({ ...f, metric_target: e.target.value })} onBlur={blurSave('metric_target')} />
                </label>
                <label>
                  {L('単位', 'Unit')}
                  <input value={f.metric_unit} placeholder={L('件・万円・人', 'items, ¥, people')} onChange={(e) => setF({ ...f, metric_unit: e.target.value })} onBlur={blurSave('metric_unit')} />
                </label>
              </div>
            </fieldset>
          )}
          {goal.type === 'project' && (
            <label>
              {L('つながるビジョン（ありたい姿）', 'Linked vision (aspiration)')}
              <select value={goal.vision_goal_id ?? ''} onChange={(e) => save({ vision_goal_id: e.target.value || null })}>
                <option value="">{L('つなげない', 'None')}</option>
                {HORIZONS.map((h) => (
                  <optgroup key={h.k} label={h.label}>
                    {visions.filter((v) => (v.horizon ?? 10) === h.k && v.status !== 'done').map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
                  </optgroup>
                ))}
              </select>
              <span className="muted small">{L('ビジョンのページのボードで、このプロジェクトがそのありたい姿の下に並びます。', 'On the Vision page board, this project appears under that aspiration.')}</span>
            </label>
          )}
          <label>
            {L('大きな障害（うまくいかなくなるとしたら何が原因か）', 'Biggest obstacle (what could make this fail?)')}
            <textarea rows={2} value={f.obstacle} onChange={(e) => setF({ ...f, obstacle: e.target.value })} onBlur={blurSave('obstacle')} />
          </label>
          <label>
            {L('障害への対策', 'Plan for the obstacle')}
            <textarea rows={2} value={f.obstacle_plan} onChange={(e) => setF({ ...f, obstacle_plan: e.target.value })} onBlur={blurSave('obstacle_plan')} />
          </label>
          {goal.type === 'project' ? (
            <div className="form-row">
              <label>
                {L('期限', 'Due date')}
                <input type="date" value={goal.due_date ?? ''} onChange={(e) => save({ due_date: e.target.value || null })} />
              </label>
              {goal.milestones.length === 0 && goal.metric_target == null && !goal.link_source && (
                <label>
                  {L('進捗（手動）', 'Progress (manual)')} {goal.manual_progress ?? 0}%
                  <input type="range" min={0} max={100} step={5} defaultValue={goal.manual_progress ?? 0} onMouseUp={(e) => save({ manual_progress: Number((e.target as HTMLInputElement).value) })} onTouchEnd={(e) => save({ manual_progress: Number((e.target as HTMLInputElement).value) })} />
                </label>
              )}
            </div>
          ) : (
            <div className="form-row">
              <label>
                {L('頻度', 'Frequency')}
                <select value={goal.habit_frequency ?? 'daily'} onChange={(e) => save({ habit_frequency: e.target.value })}>
                  <option value="daily">{L('毎日', 'Daily')}</option>
                  <option value="weekly">{L('週N回', 'N times a week')}</option>
                  <option value="weekdays">{L('曜日を指定', 'Specific days')}</option>
                </select>
              </label>
              {goal.habit_frequency === 'weekly' && (
                <label>
                  {L('週の回数', 'Times per week')}
                  <select value={goal.habit_times_per_week ?? 1} onChange={(e) => save({ habit_times_per_week: Number(e.target.value) })}>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{L(`${n}回`, `${n}×`)}</option>)}
                  </select>
                </label>
              )}
              {goal.habit_frequency === 'weekdays' && (
                <fieldset className="weekday-pick">
                  <legend>{L('曜日', 'Days')}</legend>
                  {[1, 2, 3, 4, 5, 6, 0].map((w) => (
                    <label key={w} className="inline">
                      <input type="checkbox" checked={weekdays.includes(w)} onChange={(e) => save({ habit_weekdays: e.target.checked ? [...weekdays, w] : weekdays.filter((x) => x !== w) })} />
                      {wdName(w)}
                    </label>
                  ))}
                </fieldset>
              )}
            </div>
          )}
          <div className="form-row">
            <label>
              {L('状態', 'Status')}
              <select value={goal.status} onChange={(e) => save({ status: e.target.value })}>
                <option value="active">{L('進行中', 'In progress')}</option>
                <option value="achieved">{L('達成', 'Achieved')}</option>
                <option value="missed">{L('未達', 'Missed')}</option>
                <option value="cancelled">{L('中止', 'Cancelled')}</option>
              </select>
            </label>
            <span className="spacer" />
            <button className="btn btn-danger btn-small" onClick={async () => { if (confirm(L(`「${goal.title}」を削除しますか？`, `Delete “${goal.title}”?`))) { await del(`/goals/${goal.id}`); onChange(); } }}>{L('目標を削除', 'Delete goal')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
