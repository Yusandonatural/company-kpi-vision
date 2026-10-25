import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addDays, daysInRange, mondayOf, shortDate, weekday } from '../../shared/dates';
import { COMMON_RULES, EVENT_CHECKS } from '../../shared/lockin';
import { del, patch, post, put } from '../api';
import { commonHint, eventLabel, eventShort, ruleTitle, setupGroup, setupLabel } from '../components/LockinCard';
import { TermHeader } from '../components/TermHeader';
import { ErrorBox, Loading, Progress, SaveBadge, Stat, metricText } from '../components/ui';
import { useApi, useAutosave } from '../hooks';
import { isEn, L } from '../i18n';

export function LockinPage() {
  const { id = '' } = useParams();
  const term = useApi<any>(`/terms/${id}`);
  const lock = useApi<any>(`/terms/${id}/lockin`);
  const error = term.error ?? lock.error;
  if (error) return <ErrorBox message={error} onRetry={() => { term.reload(); lock.reload(); }} />;
  if (!term.data || !lock.data) return <Loading />;
  return (
    <div className="page lockin-page">
      <TermHeader term={term.data} tab="lockin" />
      {lock.data.lockin ? <LockinView key={id} d={lock.data} reload={lock.reload} /> : <LockinIntro termId={id} onStart={lock.reload} />}
    </div>
  );
}

function LockinIntro({ termId, onStart }: { termId: string; onStart: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <section className="card lockin-intro">
      <p className="life-eyebrow">The Great Lock-In</p>
      <h2 className="lockin-headline">{L('90日間、決めたことだけをやり抜く', 'For 90 days, do only what you decided — and finish it')}</h2>
      <p>{L('このタームを「ロックイン」にすると、次のしくみが入ります。', 'Turning this term into a “Lock-in” adds the following:')}</p>
      <ol className="lockin-intro-list">
        <li><strong>{L('毎日のルール', 'Daily rules')}</strong> — {L('運動30分・瞑想15分・禁酒の3つは共通。自分のルールを1〜3つ足して、全部で6つまで。', '30 min exercise, 15 min meditation and no alcohol are shared by everyone. Add 1–3 of your own, up to 6 in total.')}</li>
        <li><strong>{L('10倍の目標から逆算', 'Work back from a 10x goal')}</strong> — {L('1年後に成果10倍（またはランクを3つ上げる）→ 90日の目標 → 今週 → 今日。', '10x results in a year (or move up three ranks) → 90-day goal → this week → today.')}</li>
        <li><strong>{L('イベントモード', 'Event mode')}</strong> — {L('飲み会の日も「飲まない・午前中は作業・翌朝は定刻」の3つを守る。', 'Even on party days, keep three: no drinking, work in the morning, up on time the next day.')}</li>
        <li><strong>{L('Day 0 の基地づくり', 'Day 0: build your base')}</strong> — {L('始める前に、誘惑を片付け、スマホを遠ざけ、瞑想の場所を作る。', 'Before you start, clear temptations, keep your phone away and make a place to meditate.')}</li>
        <li><strong>{L('90日目の逃げられないイベント', 'A day-90 event you can’t escape')}</strong> — {L('大会・試験・発売日など、ごまかしのきかない日を先に決める。', 'Fix a date you can’t fudge — a race, an exam, a launch.')}</li>
      </ol>
      <button
        className="btn btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await put(`/terms/${termId}/lockin`, { lockin: true });
          onStart();
        }}
      >
        {L('このタームをロックインにする', 'Make this term a Lock-in')}
      </button>
    </section>
  );
}

function LockinView({ d, reload }: { d: any; reload: () => void }) {
  const termId = d.term.id;
  const [form, setForm] = useState({ tenx_goal: d.tenx_goal, commit_title: d.commit.title, commit_date: d.commit.date ?? '', commit_proof: d.commit.proof });
  const save = useAutosave((v: any) => put(`/terms/${termId}/lockin`, v), 800, `/api/terms/${termId}/lockin`, `fj.draft.lockin.${termId}`);
  const update = (p: Partial<typeof form>, now = false) => {
    setForm({ ...form, ...p });
    save.schedule(p);
    if (now) void save.flush().then(reload);
  };
  const [setup, setSetup] = useState<Record<string, boolean>>(d.setup);
  const steps = d.steps;
  const doneSteps = Object.values(steps).filter(Boolean).length;
  const custom = d.rules.filter((r: any) => r.category === 'custom');

  async function toggleSetup(key: string, v: boolean) {
    setSetup({ ...setup, [key]: v });
    await put(`/terms/${termId}/lockin`, { setup: { [key]: v } });
    reload();
  }

  return (
    <>
      <div className="period-toolbar">
        <span className={`chip ${d.ready ? 'chip-good' : 'chip-warn'}`}>{d.ready ? L('準備完了 — ロックイン中', 'Ready — locked in') : `${L('準備', 'Setup')} ${doneSteps} / 5`}</span>
        <span className="spacer" />
        <SaveBadge state={save.state} />
      </div>

      {/* 1. 1年後の10倍目標（いちばん上の階層） */}
      <section className="card tenx-card">
        <div className="card-head">
          <h2 className="card-title"><StepMark ok={steps.tenx} /> {L('1年後の10倍目標', '10x goal for one year from now')}</h2>
          <span className="muted small">{L('成果を10倍に、またはランクを3つ上げる', '10x your results, or move up three ranks')}</span>
        </div>
        <textarea
          className="vision-input"
          rows={2}
          value={form.tenx_goal}
          placeholder={L('例: 自然茶の年間売上を10倍にする／海外の取引先を10か国にする', 'e.g. 10x annual natural tea sales / partners in 10 countries')}
          onChange={(e) => update({ tenx_goal: e.target.value })}
        />
        <p className="muted small">{L('ここから逆算して、90日でどこまで行くかを下の「90日の目標」に置きます。', 'Work back from this and put how far you will get in 90 days under “90-day goals” below.')}</p>
      </section>

      {/* 90日目の逃げられないイベント */}
      <section className={`card commit-card ${steps.commit ? '' : 'pending'}`}>
        <div className="card-head">
          <h2 className="card-title"><StepMark ok={steps.commit} /> {L('90日目の、逃げられないイベント', 'A day-90 event you can’t escape')}</h2>
          {d.commit.daysLeft != null && (
            <span className="lockin-countdown">
              {d.commit.daysLeft > 0 ? (isEn ? <><strong>{d.commit.daysLeft}</strong> days left</> : <>あと <strong>{d.commit.daysLeft}</strong>日</>) : d.commit.daysLeft === 0 ? <strong>{L('今日です', 'It’s today')}</strong> : L('終わりました', 'Finished')}
            </span>
          )}
        </div>
        <div className="form-row">
          <label className="field">
            {L('何をするか', 'What')}
            <input value={form.commit_title} placeholder={L('例: 新商品の発売日／フルマラソン／資格試験', 'e.g. product launch / full marathon / certification exam')} onChange={(e) => update({ commit_title: e.target.value })} />
          </label>
          <label className="field" style={{ flex: '0 0 auto' }}>
            {L('日付', 'Date')}
            <input type="date" value={form.commit_date} min={d.term.start_date} onChange={(e) => update({ commit_date: e.target.value }, true)} />
          </label>
        </div>
        <label className="field">
          {L('申し込み・予約の証拠（URL や受付番号など）', 'Proof of sign-up or booking (URL, confirmation number…)')}
          <input value={form.commit_proof} placeholder={L('例: 大会のエントリー完了メール／発売告知のURL', 'e.g. race entry confirmation / launch announcement URL')} onChange={(e) => update({ commit_proof: e.target.value })} />
        </label>
        <p className="muted small">{L('ごまかしのきかない日を先に決めておくと、90日間の言い訳がなくなります。', 'Fixing a date you can’t fudge removes 90 days of excuses.')}</p>
      </section>

      {/* 2〜4. 90日 → 今週 → 今日 */}
      <section className="card hierarchy">
        <h2 className="card-title">{L('目標の階段', 'Goal staircase')}</h2>
        <div className="tier">
          <p className="tier-label"><StepMark ok={steps.goal} /> {L('90日の目標', '90-day goals')}</p>
          {d.projects.length === 0 && <p className="muted small">{L('まだありません。', 'None yet. ')}<Link to={`/term/${termId}/goals`}>{L('目標設定で立てる', 'Set them in Goals')}</Link></p>}
          <ul className="goal-progress">
            {d.projects.map((g: any) => (
              <li key={g.id} className={g.behind ? 'behind' : ''}>
                <div className="row">
                  <span>{g.title}</span>
                  <span className="num">{g.progress}%</span>
                </div>
                <Progress value={g.progress} tone={g.behind ? 'warn' : undefined} />
                {metricText(g) && <p className="muted small">{L('数値', 'Metric')} {metricText(g)}</p>}
              </li>
            ))}
          </ul>
        </div>
        <div className="tier">
          <p className="tier-label">{L('今週の目標', 'This week’s goals')} <Link className="small" to={`/week/${d.week.start}`}>{L(`${shortDate(d.week.start)}の週を開く`, `Open week of ${shortDate(d.week.start)}`)}</Link></p>
          {d.week.theme && <p className="small"><strong>{L('テーマ', 'Theme')}:</strong> {d.week.theme}</p>}
          {d.week.targets.length === 0 ? (
            <p className="muted small">{L('まだありません。', 'None yet. ')}<Link to={`/week/${d.week.start}`}>{L('週間予定で立てる', 'Set them in the week plan')}</Link></p>
          ) : (
            <ul className="plain-list">
              {d.week.targets.map((t: any, i: number) => (
                <li key={i} className={t.done ? 'done' : ''}>{t.done ? '✓ ' : '・'}{t.text}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="tier">
          <p className="tier-label">{L('今日のタスク', 'Today’s tasks')} <Link className="small" to={`/day/${d.asOf}`}>{L(`${shortDate(d.asOf)}のページを開く`, `Open ${shortDate(d.asOf)}`)}</Link></p>
          {d.todayTasks.length === 0 ? (
            <p className="muted small">{L('まだありません。', 'None yet.')}</p>
          ) : (
            <ul className="plain-list">
              {d.todayTasks.filter((t: any) => t.status !== 'carried').map((t: any) => (
                <li key={t.id}>{t.status === 'done' ? '✓ ' : '・'}{t.title}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="tier">
          <p className="tier-label">{L('進み具合（数字）', 'Progress (numbers)')}</p>
          {d.metrics.length === 0 ? (
            <p className="muted small">{L('毎日のページの「今日の進み具合」に数字で書くと、ここに並びます。', 'Write numbers in “Today’s progress” on each day page and they appear here.')}</p>
          ) : (
            <ul className="plain-list metric-log">
              {d.metrics.map((m: any) => (
                <li key={m.date}><Link to={`/day/${m.date}`} className="muted small">{shortDate(m.date)}</Link> {m.text}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="stats">
        <Stat label={L('ロックインできた日', 'Locked-in days')} value={L(`${d.perfectDays}日`, `${d.perfectDays}`)} sub={L(`${d.elapsedDays}日のうち・全ルールを守れた日`, `of ${d.elapsedDays} days · all rules kept`)} tone="good" />
        <Stat label={L('連続', 'Streak')} value={L(`${d.perfectStreak}日`, `${d.perfectStreak} days`)} sub={L('全ルールを守れた日が続いている', 'consecutive days with all rules kept')} />
        <Stat label={L('ルールの数', 'Rules')} value={`${d.rules.length} / ${d.limits.total}`} sub={`${L('自分のルール', 'Your rules')} ${custom.length} / ${d.limits.custom}`} />
        <Stat label={L('イベントの日', 'Event days')} value={L(`${d.events.length}日`, `${d.events.length}`)} sub={`${L('3条件を守れた日', 'All 3 kept')} ${d.events.filter((e: any) => e.noAlcohol && e.morningWork && e.nextDayOnTime).length}`} />
      </div>

      <RulesCard d={d} reload={reload} />

      {/* Day 0 */}
      <section className={`card ${steps.setup ? '' : 'pending'}`}>
        <div className="card-head">
          <h2 className="card-title"><StepMark ok={steps.setup} /> Day 0 — {L('基地づくり', 'Build your base')}</h2>
          <span className="muted small">{d.setupItems.filter((i: any) => setup[i.key]).length} / {d.setupItems.length}</span>
        </div>
        {[...new Set<string>(d.setupItems.map((i: any) => i.group))].map((g) => (
          <div key={g}>
            <h3 className="mini-title">{setupGroup(d.setupItems.find((i: any) => i.group === g)?.key, g)}</h3>
            {d.setupItems.filter((i: any) => i.group === g).map((i: any) => (
              <label key={i.key} className="check">
                <input type="checkbox" checked={!!setup[i.key]} onChange={(e) => toggleSetup(i.key, e.target.checked)} />
                <span>{setupLabel(i)}</span>
              </label>
            ))}
          </div>
        ))}
      </section>

      {d.events.length > 0 && (
        <section className="card">
          <h2 className="card-title">{L('イベントの日の記録', 'Event day log')}</h2>
          <table className="simple-table">
            <thead>
              <tr><th>{L('日付', 'Date')}</th><th>{L('イベント', 'Event')}</th>{EVENT_CHECKS.map((c) => <th key={c.key} className="num" title={eventLabel(c)}>{eventShort(c)}</th>)}</tr>
            </thead>
            <tbody>
              {d.events.map((e: any) => (
                <tr key={e.date}>
                  <td><Link to={`/day/${e.date}`}>{shortDate(e.date)}</Link></td>
                  <td>{e.title || <span className="muted">—</span>}</td>
                  {EVENT_CHECKS.map((c) => <td key={c.key} className="num">{e[c.key] ? '✓' : e[c.key] === false ? '×' : <span className="muted">—</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

function StepMark({ ok }: { ok: boolean }) {
  return <span className={`step-mark ${ok ? 'ok' : ''}`} aria-label={ok ? L('済み', 'Done') : L('まだ', 'Not yet')}>{ok ? '✓' : '・'}</span>;
}

function RulesCard({ d, reload }: { d: any; reload: () => void }) {
  const [title, setTitle] = useState('');
  const [unit, setUnit] = useState<'check' | 'min'>('check');
  const [minutes, setMinutes] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const custom = d.rules.filter((r: any) => r.category === 'custom');
  const full = custom.length >= d.limits.custom || d.rules.length >= d.limits.total;

  async function run(p: Promise<unknown>) {
    try {
      await p;
      setError(null);
      reload();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <section className={`card ${d.steps.rules ? '' : 'pending'}`}>
      <div className="card-head">
        <h2 className="card-title"><StepMark ok={d.steps.rules} /> {L('毎日のルール', 'Daily rules')}</h2>
        <span className="muted small">{L('共通3つ ＋ 自分のルール1〜3つ（全部で6つまで）', '3 shared + 1–3 of your own (up to 6 in total)')}</span>
      </div>
      <ul className="rule-list">
        {d.rules.map((r: any) => (
          <li key={r.id}>
            <div className="row">
              <span>
                {ruleTitle(r)}
                <span className="chip chip-soft">{r.category === 'common' ? L('共通', 'Shared') : L('自分', 'Mine')}</span>
                {r.unit === 'min' && (
                  <span className="muted small">
                    {' '}{L('1日', 'Per day')}
                    <input
                      className="min-input"
                      type="number"
                      min={1}
                      max={1440}
                      defaultValue={r.target_value}
                      aria-label={L(`${r.title}の目安（分）`, `Target minutes for ${ruleTitle(r)}`)}
                      onBlur={(e) => Number(e.target.value) !== r.target_value && run(patch(`/lockin/rules/${r.id}`, { target_value: Number(e.target.value) }))}
                    />
                    {L('分', 'min')}
                  </span>
                )}
                {r.category === 'common' && r.unit === 'check' && <span className="muted small"> {commonHint(r.rule_key, COMMON_RULES.find((c) => c.key === r.rule_key)?.hint)}</span>}
              </span>
              <span className="row">
                <span className="num small">{r.doneDays} / {r.elapsedDays}{L('日', ' days')}{r.streak > 1 && L(` ・ 連続${r.streak}日`, ` · ${r.streak}-day streak`)}</span>
                {r.category === 'custom' && (
                  <button className="icon-btn small" aria-label={L(`${r.title}を外す`, `Remove ${r.title}`)} onClick={() => confirm(L(`「${r.title}」を外しますか？記録も消えます。`, `Remove “${r.title}”? Its records will be deleted too.`)) && run(del(`/lockin/rules/${r.id}`))}>×</button>
                )}
              </span>
            </div>
            <RuleHeat d={d} rule={r} />
          </li>
        ))}
      </ul>
      {full ? (
        <p className="muted small">{L('ルールはこれ以上増やせません。増やしすぎると続かなくなるため、上限で止めています。', 'You can’t add more rules. Too many rules are hard to keep, so there is a limit.')}</p>
      ) : (
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            run(post(`/terms/${d.term.id}/lockin/rules`, { title, unit, target_value: minutes }).then(() => setTitle('')));
          }}
        >
          <input value={title} placeholder={L('自分のルール（例: 朝5時に起きる／SNSは夜だけ）', 'Your rule (e.g. wake at 5am / social media only at night)')} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1, minWidth: '14em' }} />
          <select value={unit} onChange={(e) => setUnit(e.target.value as any)} aria-label={L('記録のしかた', 'How to track')}>
            <option value="check">{L('守れたかチェック', 'Check if kept')}</option>
            <option value="min">{L('分数を記録', 'Log minutes')}</option>
          </select>
          {unit === 'min' && <input className="min-input" type="number" min={1} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label={L('1日の目安（分）', 'Daily target (min)')} />}
          <button className="btn btn-small btn-primary" type="submit">{L('追加', 'Add')}</button>
          <span className="muted small">{L(`あと${Math.min(d.limits.custom - custom.length, d.limits.total - d.rules.length)}つ`, `${Math.min(d.limits.custom - custom.length, d.limits.total - d.rules.length)} left`)}</span>
        </form>
      )}
      {error && <p className="error-text small">{error}</p>}
    </section>
  );
}

/** ルールを守れた日のマス（週ごとの行） */
function RuleHeat({ d, rule }: { d: any; rule: any }) {
  const done = new Set<string>(rule.dates);
  const { start_date, end_date } = d.term;
  const weeks: string[] = [];
  for (let w = mondayOf(start_date); w <= end_date; w = addDays(w, 7)) weeks.push(w);
  return (
    <div className="heatmap compact" aria-label={L(`${rule.title} を守れた日`, `Days ${ruleTitle(rule)} was kept`)}>
      {weeks.map((w) => (
        <div key={w} className="heat-row">
          {daysInRange(w, addDays(w, 6)).map((day) => {
            const inTerm = day >= start_date && day <= end_date;
            const cls = !inTerm ? 'out' : done.has(day) ? 'on' : day > d.today ? 'future' : 'miss';
            return <span key={day} className={`heat ${cls} ${weekday(day) === 0 ? 'sun' : ''}`} title={`${shortDate(day)}${done.has(day) ? ' ✓' : ''}`} />;
          })}
        </div>
      ))}
    </div>
  );
}

