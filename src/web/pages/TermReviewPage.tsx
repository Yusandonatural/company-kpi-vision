import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { shortDate, WEEKDAYS_EN } from '../../shared/dates';
import { post } from '../api';
import { ByGoalTable } from '../components/period';
import { TermHeader } from '../components/TermHeader';
import { ErrorBox, Loading, Progress, Stat, pct } from '../components/ui';
import { useApi } from '../hooks';
import { isEn, L } from '../i18n';

export function TermReviewPage() {
  const { id = '' } = useParams();
  const { data, error, reload } = useApi<any>(`/terms/${id}/review`);
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const { term, stats } = data;
  const ended = term.info.phase === 'ended';
  const maxRate = Math.max(1, ...data.byWeekday.map((w: any) => w.stats.rate ?? 0));
  const wdName = (w: any) => (isEn ? WEEKDAYS_EN[w.weekday] : w.name);

  async function carry(taskId: string, on: boolean) {
    setBusy(true);
    await post(`/terms/${term.id}/carry-over`, { task_ids: [taskId], on });
    await reload();
    setBusy(false);
  }

  return (
    <div className="page">
      <TermHeader term={term} tab="review" />
      {!ended && <div className="notice soft">{L(`ターム途中の経過です。ターム終了後（${shortDate(term.end_date)}の翌日）に確定します。`, `This is mid-term progress. It becomes final after the term ends (the day after ${shortDate(term.end_date)}).`)}</div>}

      <div className="stats">
        <Stat label={L('達成率', 'Done rate')} value={pct(stats.rate)} sub={L(`${stats.total}件中`, `of ${stats.total}`)} />
        <Stat label={L('できたこと', 'Done')} value={stats.done} tone="good" />
        <Stat label={L('できなかったこと', 'Missed')} value={stats.missed} sub={L(`送った ${stats.carried}回`, `Postponed ${stats.carried}×`)} tone={stats.missed ? 'warn' : undefined} />
        <Stat label={L('記入率', 'Journal fill rate')} value={pct(data.fill.pct)} sub={L(`${data.fill.filled} / ${data.fill.days}日`, `${data.fill.filled} / ${data.fill.days} days`)} />
      </div>

      <div className="two-col">
        <section className="card">
          <h2 className="card-title">{L('目標の結果', 'Goal results')}</h2>
          <ul className="goal-progress">
            {data.goals.map((g: any) => (
              <li key={g.id}>
                <div className="row"><span>{g.type === 'habit' ? L('習慣: ', 'Habit: ') : ''}{g.title}</span><span className="num">{g.progress}%</span></div>
                <Progress value={g.progress} tone={g.behind ? 'warn' : undefined} />
              </li>
            ))}
            {data.goals.length === 0 && <li className="muted">{L('目標がありません', 'No goals')}</li>}
          </ul>
        </section>
        <section className="card">
          <h2 className="card-title">{L('曜日別の達成率', 'Done rate by weekday')}</h2>
          <p className="muted small">{L('どの曜日に崩れやすいかを見ます。', 'See which days tend to slip.')}</p>
          <div className="bars">
            {data.byWeekday.slice(1).concat(data.byWeekday.slice(0, 1)).map((w: any) => (
              <div key={w.weekday} className="bar-col">
                <div className="bar" style={{ height: `${((w.stats.rate ?? 0) / maxRate) * 100}%` }} title={`${wdName(w)}: ${pct(w.stats.rate)}`} />
                <span className="bar-val">{pct(w.stats.rate)}</span>
                <span className="bar-label">{wdName(w)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card">
        <h2 className="card-title">{L('目標別', 'By goal')}</h2>
        <ByGoalTable rows={data.byGoal} />
      </section>

      <section className="card">
        <h2 className="card-title">{L('できたこと', 'Done')} <span className="count">{stats.done}</span></h2>
        {data.doneByGoal.length === 0 && <p className="muted">{L('まだありません', 'None yet')}</p>}
        {data.doneByGoal.map((g: any) => (
          <details key={g.goal_id ?? 'none'} className="group" open={data.doneByGoal.length <= 3}>
            <summary>{g.goal_title} <span className="count">{g.tasks.length}</span></summary>
            <ul className="plain-list">
              {g.tasks.map((t: any) => (
                <li key={t.id}><Link className="muted small" to={`/day/${t.date}`}>{shortDate(t.date)}</Link> {t.title}</li>
              ))}
            </ul>
          </details>
        ))}
      </section>

      <section className="card">
        <h2 className="card-title">{L('できなかったこと', 'Missed')} <span className="count">{data.missed.length}</span></h2>
        <p className="muted small">{L('先送りした回数が多いものから並べています。「次のタームへ」に印を付けると、次のタームの目標設定画面に出てきます。', 'Most-postponed first. Check “To next term” to see it on the next term’s goal screen.')}</p>
        <ul className="plain-list">
          {data.missed.map((t: any) => (
            <li key={t.id} className="with-actions">
              <span>
                <Link className="muted small" to={`/day/${t.date}`}>{shortDate(t.date)}</Link> {t.title}
                {t.carry_count > 0 && <span className="chip chip-warn">{L(`送った ${t.carry_count}回`, `Postponed ${t.carry_count}×`)}</span>}
                {t.goal_title && <span className="chip chip-soft">{t.goal_title}</span>}
              </span>
              <label className="check small">
                <input type="checkbox" checked={t.carry_over === 1} disabled={busy || t.carry_over === 2} onChange={(e) => carry(t.id, e.target.checked)} />
                <span>{t.carry_over === 2 ? L('持ち越し済み', 'Carried over') : L('次のタームへ', 'To next term')}</span>
              </label>
            </li>
          ))}
          {data.missed.length === 0 && <li className="muted">{L('ありません', 'None')}</li>}
        </ul>
        {data.nextTerm ? (
          <Link className="btn btn-wrap" to={`/term/${data.nextTerm.id}/goals`}>{L(`次のターム（${data.nextTerm.title}）の目標設定へ →`, `Set goals for the next term (${data.nextTerm.title}) →`)}</Link>
        ) : (
          ended && <Link className="btn btn-primary" to={`/terms?new=1&from=${term.id}`}>{L('次のタームを作る', 'Create next term')}</Link>
        )}
      </section>
    </div>
  );
}
