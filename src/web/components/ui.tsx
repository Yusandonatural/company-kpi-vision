import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { SaveState } from '../hooks';
import type { TaskStats } from '../../shared/progress';
import { L } from '../i18n';

export function Progress({ value, tone }: { value: number; tone?: 'warn' | 'gold' }) {
  return (
    <div className={`progress ${tone ?? ''}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function SaveBadge({ state }: { state: SaveState }) {
  const label = { idle: '', saving: L('保存中…', 'Saving…'), saved: L('保存しました', 'Saved'), error: L('保存できませんでした', 'Couldn\'t save') }[state];
  return <span className={`save-badge ${state}`} aria-live="polite">{label}</span>;
}

export function Loading() {
  return <div className="loading">{L('読み込み中…', 'Loading…')}</div>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-box">
      <p>{message}</p>
      {onRetry && <button className="btn" onClick={onRetry}>{L('もう一度', 'Retry')}</button>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={L('閉じる', 'Close')}>×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'warn' | 'good' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

const fmtNum = (n: number) => (Number.isInteger(n) ? n.toLocaleString('ja-JP') : n.toLocaleString('ja-JP', { maximumFractionDigits: 2 }));

/** 数値目標の「現在 / 目標 単位」。目標値がなければ null */
export function metricText(g: { metric_target?: number | null; metric_current?: number | null; metric_start?: number | null; metric_unit?: string | null }) {
  if (g.metric_target == null) return null;
  const cur = g.metric_current ?? g.metric_start ?? 0;
  return `${fmtNum(cur)} / ${fmtNum(g.metric_target)}${g.metric_unit ?? ''}`;
}

export function pct(v: number | null | undefined) {
  return v == null ? '—' : `${v}%`;
}

export function TaskStatsLine({ s }: { s: TaskStats }) {
  return (
    <span className="muted">
      {L('できた', 'Done')} {s.done} ／ {L('できなかった', 'Missed')} {s.missed + s.carried} ／ {L('未着手', 'Not started')} {s.todo}
    </span>
  );
}

export function SubTabs({ items }: { items: { to: string; label: string; active: boolean }[] }) {
  return (
    <nav className="subtabs" aria-label={L('表示の切り替え', 'Switch view')}>
      {items.map((i) => (
        <Link key={i.to} to={i.to} className={i.active ? 'active' : ''} aria-current={i.active ? 'page' : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export function Stars({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="stars" role="radiogroup" aria-label={L('自己評価', 'Self-rating')}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className={value != null && n <= value ? 'on' : ''}
          onClick={() => onChange(value === n ? null : n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}
