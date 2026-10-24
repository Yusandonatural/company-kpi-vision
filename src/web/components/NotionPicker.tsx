import { useEffect, useMemo, useState } from 'react';
import { api, post } from '../api';
import { Loading, Modal } from './ui';
import { L } from '../i18n';

interface Candidate {
  pageId: string;
  title: string;
  status: string | null;
  priority: string | null;
  tags: string[];
  places: string[];
  url: string;
}

export function NotionPicker({ date, onClose, onPicked }: { date: string; onClose: () => void; onPicked: () => void }) {
  const [items, setItems] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api<Candidate[]>('/notion/candidates').then(setItems).catch((e) => setError(e.message));
  }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (items ?? []).filter((i) => !s || [i.title, ...i.tags, ...i.places, i.status ?? ''].join(' ').toLowerCase().includes(s));
  }, [items, q]);

  async function pick(c: Candidate) {
    setBusy(c.pageId);
    try {
      await post(`/days/${date}/tasks/from-notion`, { page_id: c.pageId });
      onPicked();
      onClose();
    } catch (e: any) {
      setError(e.message);
      setBusy(null);
    }
  }

  return (
    <Modal title={L('Notion の Todo リストから選ぶ', 'Pick from Notion to-do list')} onClose={onClose} wide>
      <p className="muted small">{L('Inbox・今週の対応事項・今月対応予定・未着手 の行から選べます。選んだ行には今日の日付とタグ「目標達成ジャーナル」が付きます。', 'Choose from rows in Inbox, this week, this month or not started. Picked rows get today\'s date and the tag 「目標達成ジャーナル」.')}</p>
      <input className="search" placeholder={L('キーワード・タグ・場所で絞り込み', 'Filter by keyword, tag or place')} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      {error && <p className="form-error">{error}</p>}
      {!items && !error && <Loading />}
      <ul className="picker-list">
        {shown.map((c) => (
          <li key={c.pageId}>
            <button type="button" onClick={() => pick(c)} disabled={!!busy}>
              <span className="picker-title">{c.title}</span>
              <span className="picker-meta">
                {c.priority && <span className={`chip ${c.priority.startsWith('高') ? 'chip-warn' : ''}`}>{c.priority}</span>}
                {c.status && <span className="chip">{c.status}</span>}
                {[...c.tags, ...c.places].slice(0, 4).map((t) => (
                  <span key={t} className="chip chip-soft">{t}</span>
                ))}
              </span>
              {busy === c.pageId && <span className="muted small">{L('追加中…', 'Adding…')}</span>}
            </button>
          </li>
        ))}
        {items && shown.length === 0 && <li className="muted">{L('該当する行がありません', 'No matching rows')}</li>}
      </ul>
    </Modal>
  );
}
