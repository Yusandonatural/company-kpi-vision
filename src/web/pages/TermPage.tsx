import { Link, useParams } from 'react-router-dom';
import { addDays, daysInRange, mondayOf, shortDate, todayJST, weekday, WEEKDAYS_EN } from '../../shared/dates';
import { habitLabel, habitScheduled, habitWeekdays } from '../../shared/progress';
import { TermHeader } from '../components/TermHeader';
import { ErrorBox, Loading, Progress, Stat, metricText, pct } from '../components/ui';
import { useApi } from '../hooks';
import { isEn, L } from '../i18n';
import { FlowStrip, KaizenList } from '../social/Kaizen';
import { AgentBox, ProjectKpis } from '../social/ProjectKpis';

/** habitLabel（日本語）の英語版 */
function habitText(g: any): string {
  if (!isEn) return habitLabel(g);
  if (g.habit_frequency === 'weekly') return `${g.habit_times_per_week ?? 1}× a week`;
  if (g.habit_frequency === 'weekdays') return habitWeekdays(g).map((w) => WEEKDAYS_EN[w]).join(' · ') || 'No days set';
  return 'Daily';
}

export function TermPage() {
  const { id = '' } = useParams();
  const { data: term, error, reload } = useApi<any>(`/terms/${id}`);
  const life = useApi<any>('/life');
  const kaizen = useApi<any[]>(`/terms/${id}/improvements`);
  const org = useApi<any>('/org');
  const pk = useApi<any>(`/terms/${id}/project-kpis`);
  const me = useApi<any>('/me');
  const manager = ['owner', 'lead'].includes(me.data?.member?.role);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!term) return <Loading />;
  const imps = kaizen.data ?? [];
  const info = term.info;
  const projects = term.goals.filter((g: any) => g.type === 'project');
  const habits = term.goals.filter((g: any) => g.type === 'habit');
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const behind = term.goals.filter((g: any) => g.behind);

  return (
    <div className="page">
      <TermHeader term={term} tab="progress" />

      <FlowStrip life={life.data} term={term} projects={term.goals.filter((g: any) => g.type === 'project')} imps={imps} />

      <section className="card">
        <div className="row">
          <span className="card-title">{L('経過', 'Elapsed')}</span>
          <span className="num">{L(`${info.elapsedDays} / ${info.totalDays}日（${info.elapsedPct}%）`, `${info.elapsedDays} / ${info.totalDays} days (${info.elapsedPct}%)`)}</span>
        </div>
        <Progress value={info.elapsedPct} tone="gold" />
      </section>

      {(info.phase === 'ended' || (info.phase === 'active' && info.daysLeft <= 7)) && !term.nextTerm && (
        <div className="notice">
          {info.phase === 'ended' ? L('このタームは終わりました。', 'This term has ended. ') : L(`このタームは残り${info.daysLeft}日です。`, `${info.daysLeft} days left in this term. `)}
          <Link className="btn btn-small btn-primary" to={`/terms?new=1&from=${term.id}`}>{L('次のタームを作る', 'Create next term')}</Link>
          <Link className="btn btn-small" to={`/term/${term.id}/review`}>{L('総括を見る', 'See the wrap-up')}</Link>
        </div>
      )}

      <div className="stats">
        <Stat label={L('タスク達成率', 'Task done rate')} value={pct(term.taskStats.rate)} sub={L(`できた ${term.taskStats.done} ／ できなかった ${term.taskStats.missed + term.taskStats.carried}`, `Done ${term.taskStats.done} / missed ${term.taskStats.missed + term.taskStats.carried}`)} />
        <Stat label={L('プロジェクト平均', 'Project average')} value={pct(avg(projects.map((g: any) => g.progress)))} sub={L(`${projects.length}件`, `${projects.length}`)} />
        <Stat label={L('習慣 平均達成率', 'Habit average')} value={pct(avg(habits.map((g: any) => g.progress)))} sub={L(`${habits.length}件`, `${habits.length}`)} />
        <Stat label={L('記入率', 'Journal fill rate')} value={pct(term.fill.pct)} sub={L(`${term.fill.filled} / ${term.fill.days}日`, `${term.fill.filled} / ${term.fill.days} days`)} />
      </div>

      {behind.length > 0 && (
        <div className="notice warn">
          {L('経過率に対して20ポイント以上遅れている目標: ', 'Goals 20+ points behind elapsed time: ')}{behind.map((g: any) => g.title).join(L('、', ', '))}
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">{L('この90日のプロジェクト', 'Projects for these 90 days')}</h2>
          <Link className="btn btn-small btn-ghost" to={`/term/${term.id}/goals`}>{L('編集', 'Edit')}</Link>
        </div>
        {projects.length === 0 && <p className="muted">{L('まだありません。', 'None yet. ')}<Link to={`/term/${term.id}/goals`}>{L('目標を立てる', 'Set goals')}</Link></p>}
        <ul className="goal-progress">
          {projects.map((g: any) => (
            <li key={g.id} className={g.behind ? 'behind' : ''}>
              <div className="row">
                <span>
                  {g.title}
                  {g.status !== 'active' && <span className="chip">{{ achieved: L('達成', 'Achieved'), missed: L('未達', 'Missed'), cancelled: L('中止', 'Cancelled') }[g.status as string]}</span>}
                </span>
                <span className="num">{g.progress}%</span>
              </div>
              <Progress value={g.progress} tone={g.behind ? 'warn' : undefined} />
              {g.vision_goal_id && life.data?.goals?.find((v: any) => v.id === g.vision_goal_id) && (
                <p className="small vb-link">→ {L('ありたい姿：', 'Aspiration: ')}<Link to="/life">{life.data.goals.find((v: any) => v.id === g.vision_goal_id).title}</Link></p>
              )}
              <p className="muted small">
                {metricText(g) && <>{L('数値目標', 'Target')} {metricText(g)} {L('・', '·')} </>}
                {L('マイルストーン', 'Milestones')} {g.milestones.filter((m: any) => m.done).length} / {g.milestones.length}
                {g.tasks.total > 0 && L(` ・ 関連タスク できた ${g.tasks.done} / ${g.tasks.total}`, ` · Linked tasks done ${g.tasks.done} / ${g.tasks.total}`)}
                {g.due_date && L(` ・ 期限 ${shortDate(g.due_date)}`, ` · Due ${shortDate(g.due_date)}`)}
              </p>
              <ProjectKpis goal={g} kpis={(pk.data?.kpis ?? []).filter((k: any) => k.goal_id === g.id)} sources={pk.data?.sources ?? []} manager={manager} onChange={pk.reload} />
              <AgentBox goal={g} requests={(pk.data?.requests ?? []).filter((r: any) => r.goal_id === g.id)} manager={manager} onChange={() => { pk.reload(); reload(); }} />
              {g.obstacle && (
                <p className="obstacle small">
                  <strong>{L('障害:', 'Obstacle:')}</strong> {g.obstacle}
                  {g.obstacle_plan && <> → <strong>{L('対策:', 'Plan:')}</strong> {g.obstacle_plan}</>}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="card" id="kaizen">
        <h2 className="card-title">{L('この90日の改善', 'Kaizen for these 90 days')}</h2>
        <p className="muted small">{L('改善ポイントを指摘 → 修正。プロジェクトとは別に出せます（つなげるのは任意）。', 'Flag a kaizen point → fix it. Separate from projects (linking one is optional).')}</p>
        <KaizenList term={term} items={imps} projects={projects} members={org.data?.members ?? []} onChange={kaizen.reload} />
      </section>

      <section className="card">
        <h2 className="card-title">{L('習慣', 'Habits')}</h2>
        {habits.length === 0 && <p className="muted">{L('まだありません', 'None yet')}</p>}
        {habits.map((g: any) => (
          <div key={g.id} className="habit-block">
            <div className="row">
              <span>{g.title} <span className="muted small">{L('（', '(')}{habitText(g)}{L('）', ')')}</span></span>
              <span className="num">{g.progress}%</span>
            </div>
            <p className="muted small">
              {g.habit.done} / {g.habit.expected}{L('回', '')}
              {g.habit_frequency !== 'weekly' && L(` ・ 連続 ${g.habit.currentStreak}日 ・ 最長 ${g.habit.longestStreak}日`, ` · Streak ${g.habit.currentStreak} days · Best ${g.habit.longestStreak} days`)}
              {g.habit_frequency === 'weekly' && L(` ・ 今週 ${g.habit.weekDone}/${g.habit.weekTarget}`, ` · This week ${g.habit.weekDone}/${g.habit.weekTarget}`)}
            </p>
            <Heatmap term={term} goal={g} />
          </div>
        ))}
      </section>
    </div>
  );
}

/** 週ごとの行 × 月〜日 の達成マス */
function Heatmap({ term, goal }: { term: any; goal: any }) {
  const done = new Set<string>(goal.logs);
  const today = todayJST();
  const weeks: string[] = [];
  for (let w = mondayOf(term.start_date); w <= term.end_date; w = addDays(w, 7)) weeks.push(w);
  return (
    <div className="heatmap" aria-label={L(`${goal.title} の達成カレンダー`, `${goal.title} streak calendar`)}>
      {weeks.map((w) => (
        <div key={w} className="heat-row">
          {daysInRange(w, addDays(w, 6)).map((d) => {
            const inTerm = d >= term.start_date && d <= term.end_date;
            const cls = !inTerm ? 'out' : done.has(d) ? 'on' : d > today ? 'future' : habitScheduled(goal, d) ? 'miss' : 'off';
            return <span key={d} className={`heat ${cls} ${weekday(d) === 0 ? 'sun' : ''}`} title={`${shortDate(d)}${done.has(d) ? ' ✓' : ''}`} />;
          })}
        </div>
      ))}
    </div>
  );
}
