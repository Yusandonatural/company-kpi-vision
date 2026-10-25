import { useEffect, useState } from 'react';
import { todayJST } from '../../shared/dates';
import { api, post } from '../api';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/ui';
import { L } from '../i18n';

/** 投稿をつくる。今タームの目標にひもづけられる */
export function Composer({ onClose, onPosted }: { onClose: () => void; onPosted: (p: any) => void }) {
  const [body, setBody] = useState('');
  const [goalId, setGoalId] = useState('');
  const [goals, setGoals] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api('/me').then(setMe).catch(() => {});
    api(`/terms/current?date=${todayJST()}`)
      .then((t) => (t ? api(`/terms/${t.id}`) : null))
      .then((d) => d && setGoals(d.goals.filter((g: any) => g.type === 'project')))
      .catch(() => {});
  }, []);
  const submit = async () => {
    if (!body.trim()) return;
    setBusy(true);
    setErr('');
    try {
      onPosted(await post('/posts', { body, goal_id: goalId || null }));
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  };
  return (
    <Modal title={L('投稿する', 'New post')} onClose={onClose}>
      <div className="composer">
        <div className="composer-who">
          <Avatar name={me?.user?.name} email={me?.user?.email} src={me?.user?.picture_url} size={40} />
          <b>{me?.user?.name ?? ''}</b>
        </div>
        <textarea
          id="composer-body"
          autoFocus
          rows={5}
          maxLength={2000}
          placeholder={L('今日の手応え、気づき、チームへの共有…', 'How today went, insights, updates for the team…')}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && submit()}
        />
        <label className="composer-goal">
          <span>{L('つながる目標', 'Linked goal')}</span>
          <select id="composer-goal" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">{L('なし', 'None')}</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
        </label>
        {err && <p className="form-error">{err}</p>}
        <div className="composer-foot">
          <span className="muted small">{L('全社のタイムラインに出ます', 'Visible on the company timeline')}</span>
          <button className="btn btn-primary" disabled={!body.trim() || busy} onClick={submit}>
            {busy ? L('投稿中…', 'Posting…') : L('投稿', 'Post')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
