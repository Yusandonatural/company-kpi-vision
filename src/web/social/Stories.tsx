import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, RingProgress } from '../components/Avatar';
import { Icon } from '../components/Icon';

const SIGNAL: Record<string, string> = { ok: '順調', warn: '注意', bad: '遅れ', none: '未入力' };
const fmt = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('ja-JP', { maximumFractionDigits: 1 }));

type Story = { key: string; kind: 'mission' | 'vision' | 'board' | 'kpi' | 'person'; data: any };

/** 上のストーリーズ（会社のビジョン → 年間10倍KPI → メンバーの今日） */
export function Stories({ s }: { s: any }) {
  const [open, setOpen] = useState<number | null>(null);
  const items: Story[] = [
    ...(s.mission ? [{ key: 'mission', kind: 'mission' as const, data: s }] : []),
    ...(s.vision ? [{ key: 'vision', kind: 'vision' as const, data: s }] : []),
    ...(s.board ?? []).map((b: any) => ({ key: 'b' + b.id, kind: 'board' as const, data: b })),
    ...s.kpis.map((k: any) => ({ key: k.id, kind: 'kpi' as const, data: k })),
    ...s.people.map((p: any) => ({ key: p.id, kind: 'person' as const, data: p })),
  ];
  return (
    <>
      <div className="stories" role="list" aria-label="ストーリーズ">
        {items.map((it, i) => (
          <button key={it.key} role="listitem" className="story" onClick={() => setOpen(i)}>
            {it.kind === 'mission' && (
              <span className="story-ring vision"><span className="story-badge"><Icon name="flag" size={26} /></span></span>
            )}
            {it.kind === 'vision' && (
              <span className="story-ring vision"><span className="story-badge"><Icon name="vision" size={26} /></span></span>
            )}
            {it.kind === 'board' && (
              <span className="story-ring vision"><span className="story-badge story-yr">{it.data.horizon}年</span></span>
            )}
            {it.kind === 'kpi' && (
              <RingProgress pct={it.data.pct} tone={it.data.signal} size={66}>
                <span className="story-pct">{it.data.pct == null ? '—' : `${it.data.pct}%`}</span>
              </RingProgress>
            )}
            {it.kind === 'person' && (
              <RingProgress pct={it.data.total ? (it.data.done / it.data.total) * 100 : 0} tone={it.data.total && it.data.done === it.data.total ? 'ok' : 'story'} size={66}>
                <Avatar name={it.data.name} email={it.data.email} src={it.data.picture_url} size={56} />
              </RingProgress>
            )}
            <span className="story-label">
              {it.kind === 'mission' ? 'ミッション' : it.kind === 'vision' ? 'ビジョン' : it.kind === 'board' ? it.data.title : it.kind === 'kpi' ? it.data.title : it.data.me ? 'あなた' : it.data.name || it.data.email}
            </span>
          </button>
        ))}
        {items.length === 0 && <p className="muted small">年間の10倍KPIを決めると、ここに並びます。</p>}
      </div>
      {open != null && <StoryViewer items={items} start={open} s={s} onClose={() => setOpen(null)} />}
    </>
  );
}

function StoryViewer({ items, start, s, onClose }: { items: Story[]; start: number; s: any; onClose: () => void }) {
  const [i, setI] = useState(start);
  const it = items[i];
  const next = () => (i + 1 < items.length ? setI(i + 1) : onClose());
  const prev = () => setI(Math.max(0, i - 1));
  useEffect(() => {
    const t = setTimeout(next, 7000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  });
  return (
    <div className="sv-backdrop" role="dialog" aria-modal="true" aria-label="ストーリー" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sv sv-${it.kind} ${it.kind === 'kpi' ? `tone-${it.data.signal}` : ''}`}>
        <div className="sv-bars">
          {items.map((x, n) => (
            <span key={x.key} className={n < i ? 'done' : n === i ? 'now' : ''}><i key={i} /></span>
          ))}
        </div>
        <button className="sv-close" aria-label="閉じる" onClick={onClose}><Icon name="close" /></button>
        <div className="sv-tap left" onClick={prev} aria-hidden="true" />
        <div className="sv-tap right" onClick={next} aria-hidden="true" />
        <div className="sv-content">
          {it.kind === 'mission' && (
            <>
              <span className="sv-kicker">悠三堂のミッション</span>
              <p className="sv-vision">{s.mission}</p>
            </>
          )}
          {it.kind === 'board' && (
            <>
              <span className="sv-kicker">{it.data.horizon}年後のありたい姿</span>
              <p className="sv-vision">{it.data.title}</p>
              {it.data.note && <p className="sv-num">{it.data.note}</p>}
              <Link className="btn sv-cta" to="/life" onClick={onClose}>ビジョンボードを見る</Link>
            </>
          )}
          {it.kind === 'vision' && (
            <>
              <span className="sv-kicker">悠三堂のビジョン</span>
              <p className="sv-vision">{s.vision}</p>
            </>
          )}
          {it.kind === 'kpi' && (
            <>
              <span className="sv-kicker">{s.year}年 10倍KPI</span>
              <h2 className="sv-title">{it.data.title}</h2>
              <RingProgress pct={it.data.pct} tone={it.data.signal} size={180} stroke={10}>
                <span className="sv-big">{it.data.pct == null ? '—' : `${it.data.pct}%`}</span>
              </RingProgress>
              <p className="sv-num">
                <b>{fmt(it.data.metric_current)}</b> / {fmt(it.data.metric_target)}
                {it.data.metric_unit}
              </p>
              <p className="sv-signal">
                {SIGNAL[it.data.signal]}・年の経過 {s.elapsedPct}%
              </p>
            </>
          )}
          {it.kind === 'person' && (
            <>
              <Avatar name={it.data.name} email={it.data.email} src={it.data.picture_url} size={84} />
              <h2 className="sv-title">{it.data.me ? 'あなたの今日' : `${it.data.name || it.data.email}の今日`}</h2>
              {it.data.department_name && <span className="sv-kicker">{it.data.department_name}</span>}
              {it.data.tasks.length ? (
                <ul className="sv-tasks">
                  {it.data.tasks.map((t: any, n: number) => (
                    <li key={n} className={`is-${t.status}`}>
                      <span className="sv-check">{t.status === 'done' ? <Icon name="check" size={18} /> : null}</span>
                      <span>
                        {t.title}
                        {t.goal_title && <small>{t.goal_title}</small>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sv-empty">今日のやるべきことはまだありません</p>
              )}
              <Link className="btn sv-cta" to={it.data.me ? '/today' : `/people/${it.data.id}`} onClick={onClose}>
                {it.data.me ? '今日のページへ' : 'プロフィールを見る'}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
