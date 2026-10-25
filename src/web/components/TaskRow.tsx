import { useEffect, useRef, useState } from 'react';
import { addDays, shortDate } from '../../shared/dates';
import { TASK_STATUS_LABEL, type TaskStatus } from '../../shared/progress';
import { del, patch, post } from '../api';
import { isEn, L } from '../i18n';

export interface Task {
  id: string;
  date: string;
  position: number;
  title: string;
  status: TaskStatus;
  kind?: 'must' | 'might';
  goal_id: string | null;
  goal_title?: string | null;
  carry_count: number;
  source: string;
  notion_page_id: string | null;
  notion_error: string | null;
  notion_dirty: number;
}

export function TaskActions({ task, today, onChange }: { task: Task; today: string; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  async function act(fn: () => Promise<unknown>) {
    setOpen(false);
    try {
      await fn();
    } catch (e: any) {
      alert(e.message);
    }
    onChange();
  }
  const canCarry = task.status === 'todo' || task.status === 'missed';
  const tomorrow = addDays(today, 1);
  return (
    <div className="task-actions" ref={ref}>
      <button type="button" className="icon-btn" aria-label={L('操作', 'Actions')} aria-expanded={open} onClick={() => setOpen(!open)}>⋯</button>
      {open && (
        <div className="menu" role="menu">
          {canCarry && task.date < today && (
            <button role="menuitem" onClick={() => act(() => post(`/tasks/${task.id}/carry`, { date: today }))}>{L('今日に送る', 'Move to today')}</button>
          )}
          {canCarry && (
            <button role="menuitem" onClick={() => act(() => post(`/tasks/${task.id}/carry`, { date: task.date >= today ? addDays(task.date, 1) : tomorrow }))}>
              {task.date >= today ? L('翌日へ送る', 'Move to next day') : L(`明日（${shortDate(tomorrow)}）に送る`, `Move to tomorrow (${shortDate(tomorrow)})`)}
            </button>
          )}
          {task.kind === 'might' && task.status === 'todo' && (
            <button role="menuitem" onClick={() => act(() => post(`/tasks/${task.id}/promote`))}>{L('やるべきことに上げる', 'Promote to must-do')}</button>
          )}
          {task.kind !== 'might' && task.status === 'todo' && task.date >= today && (
            <button role="menuitem" onClick={() => act(() => post(`/tasks/${task.id}/demote`))}>{L('「時間があれば」に下げる', 'Move to “if time allows”')}</button>
          )}
          {task.status === 'done' && <button role="menuitem" onClick={() => act(() => patch(`/tasks/${task.id}`, { status: 'todo' }))}>{L('未完了に戻す', 'Mark as not done')}</button>}
          {task.kind !== 'might' && task.status !== 'missed' && task.status !== 'done' && task.date < today && (
            <button role="menuitem" onClick={() => act(() => patch(`/tasks/${task.id}`, { status: 'missed' }))}>{L('できなかった', "Couldn't do it")}</button>
          )}
          {task.status !== 'dropped' && task.status !== 'carried' && (
            <button role="menuitem" onClick={() => act(() => patch(`/tasks/${task.id}`, { status: 'dropped' }))}>{L('取り下げ', 'Drop')}</button>
          )}
          <button role="menuitem" className="danger" onClick={() => confirm(L('このタスクを削除しますか？（Notion の行もアーカイブされます）', 'Delete this task? (The Notion row will be archived too.)')) && act(() => del(`/tasks/${task.id}`))}>{L('削除', 'Delete')}</button>
        </div>
      )}
    </div>
  );
}

const STATUS_EN: Record<TaskStatus, string> = { todo: 'To do', done: 'Done', missed: 'Missed', carried: 'Moved', dropped: 'Dropped' };

export function StatusChip({ status }: { status: TaskStatus }) {
  return <span className={`chip status-${status}`}>{isEn ? STATUS_EN[status] : TASK_STATUS_LABEL[status]}</span>;
}

export function TaskRow({ task, today, goals, onChange }: { task: Task; today: string; goals: { id: string; title: string }[]; onChange: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => setStatus(task.status), [task.status]);
  const inactive = status === 'carried' || status === 'dropped';

  async function saveTitle() {
    const t = title.trim();
    if (!t) return setTitle(task.title);
    if (t !== task.title) {
      await patch(`/tasks/${task.id}`, { title: t });
      onChange();
    }
  }

  async function toggle() {
    const next: TaskStatus = status === 'done' ? (task.date < today && task.kind !== 'might' ? 'missed' : 'todo') : 'done';
    setStatus(next); // 押した瞬間に反映し、保存は裏で行う
    try {
      await patch(`/tasks/${task.id}`, { status: next });
    } catch (e: any) {
      setStatus(task.status);
      alert(e.message);
    }
    onChange();
  }

  return (
    <div className={`task-row status-${status}`} id={`task-${task.id}`}>
      <input type="checkbox" className="task-check" checked={status === 'done'} onChange={toggle} disabled={inactive} aria-label={L('できた', 'Done')} />
      <div className="task-main">
        <input
          className="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          disabled={inactive}
          aria-label={L('やるべきこと', 'Must-do')}
        />
        <div className="task-sub">
          <select
            className="goal-select"
            value={task.goal_id ?? ''}
            onChange={async (e) => {
              await patch(`/tasks/${task.id}`, { goal_id: e.target.value || null });
              onChange();
            }}
            aria-label={L('紐づく目標', 'Linked goal')}
          >
            <option value="">{L('目標なし', 'No goal')}</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
          {status !== 'todo' && status !== 'done' && <StatusChip status={status} />}
          {task.carry_count > 0 && <span className="chip chip-soft">{L(`送った ${task.carry_count}回`, `Moved ${task.carry_count}x`)}</span>}
          {task.notion_page_id && <span className="chip chip-soft" title={task.notion_error ?? L('Notion と同期', 'Synced with Notion')}>{task.notion_error ? L('Notion未同期', 'Notion not synced') : 'Notion'}</span>}
        </div>
      </div>
      <TaskActions task={task} today={today} onChange={onChange} />
    </div>
  );
}

export function EmptyTaskSlot({ date, position, goals, onCreated }: { date: string; position: number; goals: { id: string; title: string }[]; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  async function create() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await post(`/days/${date}/tasks`, { title: t, position, goal_id: goal || null });
      setTitle('');
      onCreated();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="task-row empty" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && create()}>
      <span className="task-num" aria-hidden="true">{position}</span>
      <div className="task-main">
        <input
          className="task-title"
          placeholder={`${L('やるべきこと', 'Must-do')} ${position}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          aria-label={`${L('やるべきこと', 'Must-do')} ${position}`}
        />
        {title && goals.length > 0 && (
          <div className="task-sub">
            <select className="goal-select" value={goal} onChange={(e) => setGoal(e.target.value)} aria-label={L('紐づく目標', 'Linked goal')}>
              <option value="">{L('目標なし', 'No goal')}</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

/** 時間があればやること（Might Do）。できなくても「できなかった」にはならない */
export function MightList({ date, today, tasks, onChange }: { date: string; today: string; tasks: Task[]; onChange: () => void }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  async function add() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await post(`/days/${date}/tasks`, { title: t, kind: 'might' });
      setTitle('');
      onChange();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }
  const shown = tasks.filter((t) => t.status !== 'carried');
  return (
    <div className="might">
      <ul className="might-list">
        {shown.map((t) => (
          <MightItem key={t.id} task={t} today={today} onChange={onChange} />
        ))}
      </ul>
      {shown.length < 10 && (
        <form className="add-row small" onSubmit={(e) => (e.preventDefault(), add())}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={L('時間があればやること', 'If time allows')} aria-label={L('時間があればやること', 'If time allows')} />
          <button className="btn btn-small" disabled={!title.trim() || busy}>{L('追加', 'Add')}</button>
        </form>
      )}
    </div>
  );
}

function MightItem({ task, today, onChange }: { task: Task; today: string; onChange: () => void }) {
  const [done, setDone] = useState(task.status === 'done');
  useEffect(() => setDone(task.status === 'done'), [task.status]);
  return (
    <li className={`with-actions ${task.status === 'dropped' ? 'dropped' : ''}`}>
      <label className="check">
        <input
          type="checkbox"
          checked={done}
          disabled={task.status === 'dropped'}
          onChange={async () => {
            setDone(!done);
            await patch(`/tasks/${task.id}`, { status: done ? 'todo' : 'done' });
            onChange();
          }}
        />
        <span className={done || task.status === 'dropped' ? 'done' : ''}>{task.title}</span>
      </label>
      <TaskActions task={task} today={today} onChange={onChange} />
    </li>
  );
}
