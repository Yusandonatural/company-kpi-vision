import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { mondayOf, shortDate, todayJST, weekday, weekdayName } from '../../shared/dates';
import { termInfo } from '../../shared/progress';
import { post, put } from '../api';
import { CalendarError, CalendarPicker, EventLine, EventModal, eventsOn, useEvents, type CalEvent } from '../components/calendar';
import { ByGoalTable, DoneMissedLists, GoalProgressList, GoodsList, HabitWeekTable, PeriodStats, PlanEditor, ReviewForm, StatusChip, useNote } from '../components/period';
import { ErrorBox, Loading, SaveBadge, SubTabs } from '../components/ui';
import { useApi } from '../hooks';
import { L } from '../i18n';

export function WeekPage({ tab }: { tab: 'plan' | 'review' }) {
  const { start = '' } = useParams();
  const { data, error, reload } = useApi<any>(`/periods/week/${start}`);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return <WeekView key={start} data={data} tab={tab} reload={reload} />;
}

function WeekView({ data, tab, reload }: { data: any; tab: 'plan' | 'review'; reload: () => void }) {
  const { start, end, today } = data;
  const { note, update, save } = useNote('week', start, data.note);
  const thisWeek = mondayOf(todayJST());
  const base = `/week/${start}`;

  async function toggleHabit(goalId: string, date: string, done: boolean) {
    await put(`/goals/${goalId}/habit/${date}`, { done });
    reload();
  }

  return (
    <div className="page">
      <header className="period-header">
        <Link className="icon-btn" to={`/week/${data.prev}${tab === 'review' ? '/review' : ''}`} aria-label={L('前の週', 'Previous week')}>‹</Link>
        <div>
          <h1 className="page-title">{L(`${shortDate(start)}〜${shortDate(end)} の週`, `Week of ${shortDate(start)}–${shortDate(end)}`)}</h1>
          {data.term && <p className="muted small">{data.term.title}{dayRange(data.term, start, end)}</p>}
        </div>
        <Link className="icon-btn" to={`/week/${data.next}${tab === 'review' ? '/review' : ''}`} aria-label={L('次の週', 'Next week')}>›</Link>
      </header>
      <div className="period-toolbar">
        <SubTabs items={[
          { to: base, label: L('週間予定', 'Week plan'), active: tab === 'plan' },
          { to: `${base}/review`, label: L('週間レビュー', 'Week review'), active: tab === 'review' },
        ]} />
        <span className="spacer" />
        {start !== thisWeek && <Link className="btn btn-small" to={`/week/${thisWeek}${tab === 'review' ? '/review' : ''}`}>{L('今週へ', 'This week')}</Link>}
        <SaveBadge state={save.state} />
      </div>

      {tab === 'plan' ? (
        <>
          <div className="plan-grid">
            <PlanEditor note={note} update={update} unit="週" prevNext={data.prevNote.review_next} />
            <section className="card">
              <h2 className="card-title">{L('3ヶ月の目標', '90-day goals')}</h2>
              <GoalProgressList goals={data.goals} />
            </section>
          </div>
          <WeekDays data={data} today={today} />
          {data.habits.length > 0 && (
            <section className="card">
              <h2 className="card-title">{L('今週の習慣', 'Habits this week')}</h2>
              <HabitWeekTable habits={data.habits} onToggle={toggleHabit} />
            </section>
          )}
        </>
      ) : (
        <>
          <PeriodStats data={data} unit="週" />
          {note.targets.length > 0 && (
            <section className="card">
              <h2 className="card-title">{L('今週の目標の結果', 'This week’s target results')}</h2>
              <ul className="plain-list">
                {note.targets.map((t, i) => (
                  <li key={i}>
                    <label className="check">
                      <input type="checkbox" checked={t.done} onChange={(e) => update({ targets: note.targets.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) }, true)} />
                      <span className={t.done ? 'done' : ''}>{t.text || L('（空欄）', '(blank)')}</span>
                    </label>
                    {!t.done && t.text && (
                      <ToKaizen
                        target={t}
                        projects={data.goals.filter((g: any) => g.type === 'project')}
                        termId={data.term?.id}
                        onSent={(id) => update({ targets: note.targets.map((x, j) => (j === i ? { ...x, kaizen_id: id } : x)) }, true)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="two-col">
            <section className="card">
              <h2 className="card-title">{L('目標別', 'By goal')}</h2>
              <ByGoalTable rows={data.byGoal} />
            </section>
            <section className="card">
              <h2 className="card-title">{L('習慣', 'Habits')}</h2>
              <HabitWeekTable habits={data.habits} />
              {data.habits.length === 0 && <p className="muted">{L('習慣目標はまだありません', 'No habit goals yet')}</p>}
            </section>
          </div>
          <DoneMissedLists days={data.days} today={today} onChange={reload} />
          <GoodsList days={data.days} />
          <ReviewForm note={note} update={update} nextLabel={L('来週に活かすこと', 'To carry into next week')} state={save.state} />
          <p className="next-link"><Link className="btn" to={`/week/${data.next}`}>{L('来週の予定を立てる →', 'Plan next week →')}</Link></p>
        </>
      )}
    </div>
  );
}

/** 週間目標 → 改善ポイントへ: 未達の目標を、プロジェクトの改善（課題 → 打ち手）として出す */
function ToKaizen({ target, projects, termId, onSent }: { target: { text: string; kaizen_id?: string }; projects: any[]; termId?: string; onSent: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ goal: projects[0]?.id ?? '', issue: L(`今週の目標「${target.text}」が未達`, `Missed this week’s goal: “${target.text}”`), action: '' });
  const [err, setErr] = useState('');
  if (target.kaizen_id) {
    return (
      <p className="to-kaizen-sent small">
        {L('✓ 改善ポイントにしました', '✓ Added as a kaizen point')}
        {termId && <> · <Link to={`/term/${termId}`}>{L('改善を見る', 'See kaizen')}</Link></>}
      </p>
    );
  }
  if (!open) {
    return (
      <button type="button" className="btn btn-small btn-ghost to-kaizen-btn" onClick={() => setOpen(true)}>
        {L('→ 改善ポイントへ', '→ Make it a kaizen point')}
      </button>
    );
  }
  if (projects.length === 0) return <p className="muted small">{L('改善はプロジェクトに付けます。先にこのタームのプロジェクトを作ってください。', 'Kaizen points belong to a project. Create a project for this term first.')}</p>;
  return (
    <form
      className="to-kaizen"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!f.action.trim()) return;
        try {
          const imp = await post(`/goals/${f.goal}/improvements`, { issue: f.issue, action: f.action });
          onSent(imp.id);
        } catch (x: any) {
          setErr(x.message);
        }
      }}
    >
      <select value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} aria-label={L('どのプロジェクトの改善か', 'Which project')}>
        {projects.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
      </select>
      <input value={f.issue} onChange={(e) => setF({ ...f, issue: e.target.value })} aria-label={L('課題', 'Issue')} placeholder={L('課題（なぜできなかったか）', 'Issue (why it didn’t happen)')} />
      <input value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} aria-label={L('打ち手', 'Action')} placeholder={L('打ち手（次に何を変えるか）', 'Action (what to change next)')} autoFocus />
      <div className="row">
        <button className="btn btn-small btn-primary" disabled={!f.action.trim()}>{L('改善ポイントにする', 'Add kaizen point')}</button>
        <button type="button" className="btn btn-small btn-ghost" onClick={() => setOpen(false)}>{L('やめる', 'Cancel')}</button>
      </div>
      {err && <p className="error small">{err}</p>}
    </form>
  );
}

export function dayRange(term: any, start: string, end: string) {
  const a = termInfo(term, start < term.start_date ? term.start_date : start).dayNumber;
  const b = termInfo(term, end > term.end_date ? term.end_date : end).dayNumber;
  return a && b ? L(` ・ Day ${a}〜${b}`, ` · Day ${a}–${b}`) : '';
}

function WeekDays({ data, today }: { data: any; today: string }) {
  const { data: events, error, reload } = useEvents(data.start, data.end);
  const [edit, setEdit] = useState<{ event?: CalEvent; date: string } | null>(null);
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">{L('今週のスケジュールとタスク', 'This week’s schedule and tasks')}</h2>
        <CalendarPicker onChange={reload} />
      </div>
      {error && <CalendarError message={error} />}
      <div className="week-grid">
        {data.days.map((d: any) => (
          <div key={d.date} className={`week-day ${d.date === today ? 'today' : ''} ${weekday(d.date) === 0 ? 'sun' : weekday(d.date) === 6 ? 'sat' : ''}`}>
            <div className="week-day-head">
              <Link to={`/day/${d.date}`}>
                <span className="wd">{weekdayName(d.date)}</span> {shortDate(d.date)}
              </Link>
              {d.completed && <span className="chip chip-good" title={L('記入完了', 'Journal filled')}>✓</span>}
              <button type="button" className="icon-btn small" aria-label={L(`${shortDate(d.date)} に予定を追加`, `Add event on ${shortDate(d.date)}`)} onClick={() => setEdit({ date: d.date })}>＋</button>
            </div>
            {d.focus && <p className="week-focus">{d.focus}</p>}
            <div className="events compact">
              {events && eventsOn(events, d.date).map((e) => (
                <EventLine key={e.calendarId + e.id} e={e} date={d.date} onClick={() => setEdit({ event: e, date: d.date })} />
              ))}
            </div>
            <ul className="week-tasks">
              {d.tasks.filter((t: any) => t.status !== 'dropped').map((t: any) => (
                <li key={t.id} className={`status-${t.status}`}>
                  <span className="dot" aria-hidden="true" />
                  <span className="t">{t.title}</span>
                  {t.status === 'missed' && <StatusChip status={t.status} />}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {edit && <EventModal date={edit.date} event={edit.event} onClose={() => setEdit(null)} onSaved={reload} />}
    </section>
  );
}
