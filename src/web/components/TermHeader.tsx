import { Link } from 'react-router-dom';
import { shortDate } from '../../shared/dates';
import { SubTabs } from './ui';
import { L } from '../i18n';

export function TermHeader({ term, tab }: { term: any; tab: 'progress' | 'tasks' | 'review' | 'goals' | 'lockin' }) {
  const info = term.info;
  const base = `/term/${term.id}`;
  return (
    <>
      <header className="period-header">
        {term.prevTerm ? <Link className="icon-btn" to={`/term/${term.prevTerm.id}`} aria-label={L('前のターム', 'Previous term')}>‹</Link> : <span />}
        <div>
          <h1 className="page-title">{term.title}</h1>
          <p className="muted small">
            {shortDate(term.start_date)}〜{shortDate(term.end_date)}{L(`（${info.totalDays}日）`, ` (${info.totalDays} days)`)}
            {info.phase === 'active' && L(` ・ Day ${info.dayNumber} ・ 残り ${info.daysLeft}日`, ` · Day ${info.dayNumber} · ${info.daysLeft} days left`)}
            {info.phase === 'upcoming' && L(` ・ 開始まであと ${info.daysUntilStart}日`, ` · starts in ${info.daysUntilStart} days`)}
            {info.phase === 'ended' && L(' ・ 終了', ' · Ended')}
          </p>
        </div>
        {term.nextTerm ? <Link className="icon-btn" to={`/term/${term.nextTerm.id}`} aria-label={L('次のターム', 'Next term')}>›</Link> : <span />}
      </header>
      <div className="period-toolbar">
        <SubTabs
          items={[
            { to: base, label: L('進捗', 'Progress'), active: tab === 'progress' },
            { to: `${base}/tasks`, label: L('タスク台帳', 'Task ledger'), active: tab === 'tasks' },
            { to: `${base}/review`, label: L('総括', 'Review'), active: tab === 'review' },
            { to: `${base}/goals`, label: L('目標設定', 'Goal setting'), active: tab === 'goals' },
            { to: `${base}/lockin`, label: term.lockin ? L('ロックイン中', 'Locked in') : L('ロックイン', 'Lock-in'), active: tab === 'lockin' },
          ]}
        />
        <span className="spacer" />
        <Link className="btn btn-small btn-ghost" to="/terms">{L('ターム一覧', 'All terms')}</Link>
      </div>
    </>
  );
}
