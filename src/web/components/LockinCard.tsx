import { useState } from 'react';
import { Link } from 'react-router-dom';
import { shortDate } from '../../shared/dates';
import { EVENT_CHECKS } from '../../shared/lockin';
import { put } from '../api';
import { isEn, L } from '../i18n';

/** ロックインの決まった文言の英語（ルール名などは記録に日本語で入っているので、表示のときに訳す） */
const COMMON_EN: Record<string, { title: string; hint: string }> = {
  exercise: { title: 'Exercise', hint: '30 min a day' },
  meditation: { title: 'Meditation', hint: '15 min a day in total. Splitting is OK' },
  alcohol: { title: 'No alcohol', hint: 'Not a single drop' },
};
const EVENT_EN: Record<string, { label: string; short: string }> = {
  noAlcohol: { label: 'Did not drink a single drop', short: 'No drink' },
  morningWork: { label: 'Was absorbed in work that morning', short: 'AM work' },
  nextDayOnTime: { label: 'Got up on time the next morning and resumed work', short: 'On time' },
};
const SETUP_EN: Record<string, { group: string; label: string }> = {
  alcohol: { group: 'Clear out temptations', label: 'Removed alcohol from my room' },
  temptations: { group: 'Clear out temptations', label: 'Put away games and other distractions' },
  phone: { group: 'Optimize what you see', label: 'Decided to keep my phone 5+ steps away from my workspace' },
  desk: { group: 'Optimize what you see', label: 'Kept only work items on my desk' },
  cushion: { group: 'Meditation & work area', label: 'Placed a cushion for meditation and breaks' },
  green: { group: 'Meditation & work area', label: 'Added plants or other greenery' },
};
/** 共通ルールは英語名に置き換える。自分のルールは書いたまま */
export const ruleTitle = (r: { category?: string; rule_key: string | null; title: string }) => (isEn && r.rule_key && r.category !== 'custom' && COMMON_EN[r.rule_key] ? COMMON_EN[r.rule_key].title : r.title);
export const commonHint = (key: string | null, ja?: string) => (isEn && key && COMMON_EN[key] ? COMMON_EN[key].hint : ja);
export const eventLabel = (c: { key: string; label: string }) => (isEn ? EVENT_EN[c.key]?.label ?? c.label : c.label);
export const eventShort = (c: { key: string; short: string }) => (isEn ? EVENT_EN[c.key]?.short ?? c.short : c.short);
export const setupLabel = (i: { key: string; label: string }) => (isEn ? SETUP_EN[i.key]?.label ?? i.label : i.label);
export const setupGroup = (key: string | undefined, ja: string) => (isEn && key ? SETUP_EN[key]?.group ?? ja : ja);

type Rule = { id: string; category: string; rule_key: string | null; title: string; target_value: number; unit: 'min' | 'check'; value: number; done: boolean };

/** デイリーページの「ロックイン」：毎日のルール・イベントの日の例外モード・今日の進み具合 */
export function LockinCard({ date, termId, data, progress, onProgress }: {
  date: string;
  termId: string;
  data: any;
  progress: string;
  onProgress: (v: string) => void;
}) {
  const [rules, setRules] = useState<Rule[]>(data.rules);
  const [event, setEvent] = useState(data.event);
  const [prevEvent, setPrevEvent] = useState(data.prevEvent);
  const [error, setError] = useState<string | null>(null);
  const kept = rules.filter((r) => r.done).length;
  const commit = data.commit;

  async function log(rule: Rule, body: { value?: number; add?: number; done?: boolean }) {
    // 先に画面を変えておき、保存の結果で上書きする
    const guess = { ...rule };
    if (body.add != null) guess.value = Math.max(0, rule.value + body.add);
    if (body.value != null) guess.value = body.value;
    if (body.done != null) guess.done = body.done;
    if (rule.unit === 'min') guess.done = guess.value >= rule.target_value;
    setRules((rs) => rs.map((r) => (r.id === rule.id ? guess : r)));
    try {
      const r = await put(`/days/${date}/lockin/${rule.id}`, body);
      setRules((rs) => rs.map((x) => (x.id === rule.id ? { ...x, ...r } : x)));
      setError(null);
    } catch (e: any) {
      setRules((rs) => rs.map((x) => (x.id === rule.id ? rule : x)));
      setError(e.message);
    }
  }

  async function saveEvent(on: boolean | null, patch: Record<string, unknown> = {}) {
    const next = { ...event, ...(on == null ? {} : { on }), ...patch };
    setEvent(next);
    try {
      await put(`/days/${date}`, { ...(on == null ? {} : { event_day: on }), ...(Object.keys(patch).length ? { event: patch } : {}) });
      if ('noAlcohol' in patch) {
        setRules((rs) => rs.map((r) => (r.rule_key === 'alcohol' ? { ...r, done: !!patch.noAlcohol } : r)));
      }
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function answerPrev(v: boolean) {
    setPrevEvent({ ...prevEvent, nextDayOnTime: v });
    try {
      await put(`/days/${prevEvent.date}`, { event: { nextDayOnTime: v } });
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <section className="card lockin-card no-swipe">
      <div className="card-head">
        <h2 className="card-title">
          {L('ロックイン', 'Lock-in')} <span className={`chip ${kept === rules.length ? 'chip-good' : ''}`}>{kept} / {rules.length}</span>
        </h2>
        {commit?.daysLeft != null && commit.daysLeft >= 0 && (
          <span className="lockin-countdown">{isEn ? <><strong>{commit.daysLeft}</strong> days until {commit.title}</> : <>{commit.title}まで <strong>{commit.daysLeft}</strong>日</>}</span>
        )}
      </div>

      {!data.ready && (
        <p className="notice small">
          {L('始める前の準備（Day 0）がまだ終わっていません。', 'Your Day 0 preparation is not finished yet.')}
          <Link className="btn btn-small" to={`/term/${termId}/lockin`}>{L('準備する', 'Prepare')}</Link>
        </p>
      )}

      <ul className="lockin-rules">
        {rules.map((r) => (
          <li key={r.id} className={r.done ? 'kept' : ''}>
            {r.unit === 'check' ? (
              <label className="check">
                <input type="checkbox" checked={r.done} onChange={(e) => log(r, { done: e.target.checked })} />
                <span>{ruleTitle(r)}{r.rule_key === 'alcohol' && <span className="muted small">{L('（1滴も飲まない）', ' (not a single drop)')}</span>}</span>
              </label>
            ) : (
              <MinuteRule rule={r} onLog={(b) => log(r, b)} />
            )}
          </li>
        ))}
      </ul>
      {kept === rules.length && rules.length > 0 && <p className="celebrate">{L('今日のルールは全部守れました。ロックインできています。', 'You kept every rule today. You are locked in.')}</p>}

      {prevEvent && (
        <div className="lockin-prev">
          <p className="small">{isEn ? `Yesterday (${shortDate(prevEvent.date)}) was an event day${prevEvent.title ? `: ${prevEvent.title}` : ''}.` : `昨日（${shortDate(prevEvent.date)}）はイベントの日でした${prevEvent.title ? `：${prevEvent.title}` : ''}。`}</p>
          <span className="seg" role="group" aria-label={L('今朝、定刻に起きて作業を再開できたか', 'Did you get up on time and resume work this morning')}>
            <span className="seg-label small">{L('今朝、定刻に起きて作業を再開できた？', 'Up on time and back to work this morning?')}</span>
            <button type="button" className={prevEvent.nextDayOnTime === true ? 'active' : ''} onClick={() => answerPrev(true)}>{L('できた', 'Yes')}</button>
            <button type="button" className={prevEvent.nextDayOnTime === false ? 'active' : ''} onClick={() => answerPrev(false)}>{L('できなかった', 'No')}</button>
          </span>
        </div>
      )}

      <div className="lockin-event">
        <label className="check">
          <input type="checkbox" checked={!!event.on} onChange={(e) => saveEvent(e.target.checked)} />
          <span><strong>{L('イベントモード', 'Event mode')}</strong> <span className="muted small">{L('飲み会・会食などがある日', 'Days with parties or business dinners')}</span></span>
        </label>
        {event.on && (
          <div className="lockin-event-body">
            <input
              className="small-input"
              defaultValue={event.title ?? ''}
              placeholder={L('何のイベント？（例: 取引先との会食）', 'What event? (e.g. dinner with a client)')}
              onBlur={(e) => e.target.value !== (event.title ?? '') && saveEvent(null, { title: e.target.value })}
            />
            <p className="muted small">{L('イベントの日も、この3つは守ります。', 'Even on event days, keep these three.')}</p>
            {EVENT_CHECKS.map((c) => (
              <label key={c.key} className="check">
                <input type="checkbox" checked={!!event[c.key]} onChange={(e) => saveEvent(null, { [c.key]: e.target.checked })} />
                <span>{eventLabel(c)}{c.key === 'nextDayOnTime' && <span className="muted small">{L('（翌日のページでも答えられます）', ' (you can also answer on the next day’s page)')}</span>}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <label className="field lockin-metric">
        {L('今日の進み具合（数字で）', 'Today’s progress (in numbers)')}
        <input value={progress} placeholder={L('例: 原稿 3,000字 ／ 動画 1本 ／ 商談 2件', 'e.g. 3,000 words / 1 video / 2 sales meetings')} onChange={(e) => onProgress(e.target.value)} />
      </label>
      {error && <p className="error-text small">{error}</p>}
    </section>
  );
}

function MinuteRule({ rule, onLog }: { rule: Rule; onLog: (b: { value?: number; add?: number }) => void }) {
  const pctDone = Math.min(100, Math.round((rule.value / rule.target_value) * 100));
  return (
    <div className="minute-rule">
      <div className="row">
        <span className={`rule-title ${rule.done ? 'done-mark' : ''}`}>
          {rule.done ? '✓ ' : ''}{ruleTitle(rule)}
          <span className="muted small"> {rule.target_value}{L('分', ' min')}{rule.rule_key === 'meditation' ? L('（分けてOK）', ' (can split)') : ''}</span>
        </span>
        <span className="num">
          <input
            className="min-input"
            type="number"
            inputMode="numeric"
            min={0}
            max={1440}
            key={rule.value}
            defaultValue={rule.value || ''}
            placeholder="0"
            aria-label={L(`${rule.title}の分数`, `Minutes of ${ruleTitle(rule)}`)}
            onBlur={(e) => {
              const v = Math.max(0, Number(e.target.value) || 0);
              if (v !== rule.value) onLog({ value: v });
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          {L('分', 'min')}
        </span>
      </div>
      <div className="minute-bar" aria-hidden="true"><span style={{ width: `${pctDone}%` }} /></div>
      <div className="minute-add">
        {[5, 10, 15, 30].map((n) => (
          <button key={n} type="button" className="btn btn-small btn-ghost" onClick={() => onLog({ add: n })}>＋{n}{L('分', ' min')}</button>
        ))}
        {rule.value > 0 && <button type="button" className="btn btn-small btn-ghost" onClick={() => onLog({ value: 0 })}>{L('0に戻す', 'Reset')}</button>}
      </div>
    </div>
  );
}
