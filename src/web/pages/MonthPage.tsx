import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addDays, daysInRange, mondayOf, monthLabel, monthStart, shortDate, todayJST, weekday, weekdayName } from '../../shared/dates';
import { CalendarError, CalendarPicker, EventModal, eventsOn, eventTime, useEvents, type CalEvent } from '../components/calendar';
import { ByGoalTable, DoneMissedLists, GoalProgressList, GoodsList, PeriodStats, PlanEditor, ReviewForm, useNote } from '../components/period';
import { ErrorBox, Loading, SaveBadge, SubTabs, pct } from '../components/ui';
import { useApi } from '../hooks';
import { L } from '../i18n';
import { dayRange } from './WeekPage';

export function MonthPage({ tab }: { tab: 'plan' | 'review' }) {
  const { start = '' } = useParams();
  const { data, error, reload } = useApi<any>(`/periods/month/${start}`);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return <MonthView key={start} data={data} tab={tab} reload={reload} />;
}

// 2026-01-04 は日曜。曜日名は weekdayName で言語に合わせる
const wdName = (w: number) => weekdayName(`2026-01-${String(4 + w).padStart(2, '0')}`);

function MonthView({ data, tab, reload }: { data: any; tab: 'plan' | 'review'; reload: () => void }) {
  const { start, end, today } = data;
  const { note, update, save } = useNote('month', start, data.note);
  const thisMonth = monthStart(todayJST());
  const base = `/month/${start}`;
  const suffix = tab === 'review' ? '/review' : '';

  return (
    <div className="page">
      <header className="period-header">
        <Link className="icon-btn" to={`/month/${data.prev}${suffix}`} aria-label={L('前の月', 'Previous month')}>‹</Link>
        <div>
          <h1 className="page-title">{monthLabel(start)}</h1>
          {data.term && <p className="muted small">{data.term.title}{dayRange(data.term, start, end)}</p>}
        </div>
        <Link className="icon-btn" to={`/month/${data.next}${suffix}`} aria-label={L('次の月', 'Next month')}>›</Link>
      </header>
      <div className="period-toolbar">
        <SubTabs items={[
          { to: base, label: L('月間予定', 'Month plan'), active: tab === 'plan' },
          { to: `${base}/review`, label: L('月間レビュー', 'Month review'), active: tab === 'review' },
        ]} />
        <span className="spacer" />
        {start !== thisMonth && <Link className="btn btn-small" to={`/month/${thisMonth}${suffix}`}>{L('今月へ', 'This month')}</Link>}
        <SaveBadge state={save.state} />
      </div>

      <DateJump data={data} today={today} />

      {tab === 'plan' ? (
        <>
          <div className="plan-grid">
            <PlanEditor note={note} update={update} unit="月" prevNext={data.prevNote.review_next} />
            <section className="card">
              <h2 className="card-title">{L('3ヶ月の目標', '90-day goals')}</h2>
              <GoalProgressList goals={data.goals} />
            </section>
          </div>
          <MonthGrid data={data} today={today} />
          <WeeksList weeks={data.weeks} />
        </>
      ) : (
        <>
          <PeriodStats data={data} unit="月" />
          {note.targets.length > 0 && (
            <section className="card">
              <h2 className="card-title">{L('今月の目標の結果', 'This month’s target results')}</h2>
              <ul className="plain-list">
                {note.targets.map((t, i) => (
                  <li key={i}>
                    <label className="check">
                      <input type="checkbox" checked={t.done} onChange={(e) => update({ targets: note.targets.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) }, true)} />
                      <span className={t.done ? 'done' : ''}>{t.text || L('（空欄）', '(blank)')}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <WeeksList weeks={data.weeks} review />
          <div className="two-col">
            <section className="card">
              <h2 className="card-title">{L('目標別', 'By goal')}</h2>
              <ByGoalTable rows={data.byGoal} />
            </section>
            <section className="card">
              <h2 className="card-title">{L('習慣', 'Habits')}</h2>
              {data.habits.length === 0 && <p className="muted">{L('習慣目標はまだありません', 'No habit goals yet')}</p>}
              <table className="simple-table">
                <tbody>
                  {data.habits.map((h: any) => (
                    <tr key={h.id}>
                      <td>{h.title}</td>
                      <td className="num">{h.done} / {h.target}{L('回', '')}</td>
                      <td className="num">{h.target ? `${Math.round((h.done / h.target) * 100)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
          <section className="card">
            <h2 className="card-title">{L('3ヶ月の目標の進み具合', '90-day goal progress')}</h2>
            <GoalProgressList goals={data.goals} />
          </section>
          <DoneMissedLists days={data.days} today={today} onChange={reload} />
          <GoodsList days={data.days} />
          <ReviewForm note={note} update={update} nextLabel={L('来月に活かすこと', 'To carry into next month')} state={save.state} />
          <p className="next-link"><Link className="btn" to={`/month/${data.next}`}>{L('来月の予定を立てる →', 'Plan next month →')}</Link></p>
        </>
      )}
    </div>
  );
}

function MonthGrid({ data, today }: { data: any; today: string }) {
  const gridStart = mondayOf(data.start);
  const gridEnd = addDays(mondayOf(data.end), 6);
  const { data: events, error, reload } = useEvents(data.start, data.end);
  const [edit, setEdit] = useState<{ event?: CalEvent; date: string } | null>(null);
  const byDate = new Map(data.days.map((d: any) => [d.date, d]));
  const nav = useNavigate();
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">{L('月間スケジュール', 'Monthly schedule')}</h2>
        <CalendarPicker onChange={reload} />
      </div>
      {error && <CalendarError message={error} />}
      <div className="month-grid" role="grid">
        {[1, 2, 3, 4, 5, 6, 0].map(wdName).map((w) => (
          <div key={w} className="month-wd" role="columnheader">{w}</div>
        ))}
        {daysInRange(gridStart, gridEnd).map((date) => {
          const d: any = byDate.get(date);
          if (!d) return <div key={date} className="month-cell out" />;
          const evs = events ? eventsOn(events, date) : [];
          const tasks = d.tasks.filter((t: any) => t.status !== 'dropped');
          return (
            <div
              key={date}
              className={`month-cell clickable ${date === today ? 'today' : ''} ${d.completed ? 'filled' : ''}`}
              role="gridcell"
              onClick={(e) => {
                // 予定や「＋」を押したときはその操作を優先し、それ以外はその日のページへ
                if ((e.target as HTMLElement).closest('button, a')) return;
                nav(`/day/${date}`);
              }}
            >
              <div className="month-cell-head">
                <Link to={`/day/${date}`} className={`month-num ${weekday(date) === 0 ? 'sun' : weekday(date) === 6 ? 'sat' : ''}`} aria-label={L(`${shortDate(date)}（${weekdayName(date)}）のページ`, `Open ${weekdayName(date)} ${shortDate(date)}`)}>
                  {Number(date.slice(8))}
                </Link>
                <button type="button" className="icon-btn small add" aria-label={L(`${shortDate(date)} に予定を追加`, `Add event on ${shortDate(date)}`)} onClick={() => setEdit({ date })}>＋</button>
              </div>
              <ul className="month-events">
                {evs.slice(0, 3).map((e) => (
                  <li key={e.calendarId + e.id}>
                    <button type="button" onClick={() => setEdit({ event: e, date })} title={`${eventTime(e, date)} ${e.summary}`}>
                      <span className="event-dot" style={{ background: e.color }} />
                      {e.summary}
                    </button>
                  </li>
                ))}
                {evs.length > 3 && <li className="muted small">{L(`ほか${evs.length - 3}件`, `+${evs.length - 3} more`)}</li>}
              </ul>
              {tasks.length > 0 && (
                <div className="task-dots" aria-label={L(`タスク ${tasks.length}件`, `${tasks.length} tasks`)}>
                  {tasks.map((t: any) => (
                    <span key={t.id} className={`dot status-${t.status}`} title={t.title} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="legend muted small">
        <span className="dot status-done" /> {L('できた', 'Done')} <span className="dot status-missed" /> {L('できなかった', 'Missed')} <span className="dot status-todo" /> {L('未着手 ・ 枠が緑の日は記入完了', 'Not started · green border = journal filled')}
      </p>
      {edit && <EventModal date={edit.date} event={edit.event} onClose={() => setEdit(null)} onSaved={reload} />}
    </section>
  );
}

function WeeksList({ weeks, review }: { weeks: any[]; review?: boolean }) {
  return (
    <section className="card">
      <h2 className="card-title">{review ? L('週ごとのふりかえり', 'Weekly reviews') : L('この月の週', 'Weeks in this month')}</h2>
      <table className="simple-table">
        <thead>
          <tr><th>{L('週', 'Week')}</th><th>{L('テーマ', 'Theme')}</th><th>{L('達成率', 'Done rate')}</th>{review && <th>{L('評価', 'Rating')}</th>}<th>{L('レビュー', 'Review')}</th></tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.start}>
              <td><Link to={`/week/${w.start}`}>{shortDate(w.start)}{L('〜', '–')}</Link></td>
              <td>{w.note.theme || <span className="muted">—</span>}</td>
              <td className="num">{pct(w.stats.rate)}</td>
              {review && <td>{w.note.review_score ? <span className="stars-text">{'★'.repeat(w.note.review_score)}</span> : <span className="muted">—</span>}</td>}
              <td><Link to={`/week/${w.start}/review`}>{w.note.reviewed ? L('✓ 済み', '✓ Done') : L('まだ', 'Not yet')}</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** 日付を押すとその日のページへ飛ぶ、小さなカレンダー */
function DateJump({ data, today }: { data: any; today: string }) {
  const gridStart = mondayOf(data.start);
  const gridEnd = addDays(mondayOf(data.end), 6);
  const byDate = new Map(data.days.map((d: any) => [d.date, d]));
  return (
    <nav className="card date-jump" aria-label={L('日付をえらんでその日のページへ', 'Pick a date to open that day')}>
      <div className="card-head">
        <h2 className="card-title">{L('日付へ移動', 'Jump to date')}</h2>
        <Link className="btn btn-small" to={`/day/${today}`}>{L('今日', 'Today')}</Link>
      </div>
      <div className="dj-grid">
        {[1, 2, 3, 4, 5, 6, 0].map(wdName).map((w, i) => (
          <span key={w} className={`dj-wd ${i === 5 ? 'sat' : i === 6 ? 'sun' : ''}`}>{w}</span>
        ))}
        {daysInRange(gridStart, gridEnd).map((date) => {
          const d: any = byDate.get(date);
          if (!d) return <span key={date} className="dj-cell out" aria-hidden="true" />;
          const tasks = d.tasks.filter((t: any) => t.status !== 'dropped' && t.status !== 'carried');
          const done = tasks.filter((t: any) => t.status === 'done').length;
          const w = weekday(date);
          return (
            <Link
              key={date}
              to={`/day/${date}`}
              className={`dj-cell ${date === today ? 'today' : ''} ${d.completed ? 'filled' : ''} ${w === 0 ? 'sun' : w === 6 ? 'sat' : ''}`}
              aria-label={L(`${shortDate(date)}（${weekdayName(date)}）${d.completed ? ' 記入済み' : ''}${tasks.length ? ` タスク ${done}/${tasks.length}` : ''}`, `${weekdayName(date)} ${shortDate(date)}${d.completed ? ', filled' : ''}${tasks.length ? `, tasks ${done}/${tasks.length}` : ''}`)}
            >
              <span className="dj-num">{Number(date.slice(8))}</span>
              {tasks.length > 0 && <span className={`dj-mark ${done === tasks.length ? 'all' : done > 0 ? 'some' : 'none'}`} aria-hidden="true" />}
            </Link>
          );
        })}
      </div>
      <p className="legend muted small">
        <span className="dj-legend filled" /> {L('記入済み', 'Filled')} <span className="dot status-done" /> {L('タスク全部できた', 'All tasks done')} <span className="dot dj-some" /> {L('一部できた', 'Some done')}
      </p>
    </nav>
  );
}
