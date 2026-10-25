import { useState } from 'react';
import { Link } from 'react-router-dom';
import { patch, post, del } from '../api';
import { Avatar } from '../components/Avatar';
import { ErrorBox, Loading } from '../components/ui';
import { useApi } from '../hooks';
import { L } from '../i18n';

const ROLE: Record<string, string> = { owner: L('代表', 'CEO'), lead: L('部署長', 'Dept. lead'), member: L('担当', 'Member') };

/** メンバーと部署。役割と部署を変えられるのは代表だけ */
export function OrgPage() {
  const org = useApi<any>('/org');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  if (org.error) return <ErrorBox message={org.error} onRetry={org.reload} />;
  if (!org.data) return <Loading />;
  const { departments, members, me } = org.data;
  const owner = me.role === 'owner';
  const act = async (fn: () => Promise<unknown>) => {
    setErr('');
    try {
      await fn();
      await org.reload();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const byDept = (id: string | null) => members.filter((m: any) => (m.department_id ?? null) === id);
  const groups = [...departments.map((d: any) => ({ id: d.id, name: d.name, lead: d.lead_user_id })), { id: null, name: L('部署なし', 'No department'), lead: null }];

  return (
    <div className="page narrow org">
      <h1 className="page-title">{L('メンバー', 'Members')}</h1>
      <p className="muted">{L('@yusando.com のアカウントでログインした人がここに並びます。', 'Everyone who signs in with an @yusando.com account appears here.')}{owner ? L('役割と部署はあなた（代表）が決めます。', ' You (the CEO) set roles and departments.') : ''}</p>
      {err && <p className="form-error">{err}</p>}
      {groups.map((g) => {
        const ms = byDept(g.id);
        if (!g.id && ms.length === 0) return null;
        return (
          <section key={g.id ?? 'none'} className="org-group">
            <h2>
              {g.name} <span className="muted small">{L(`${ms.length}人`, `${ms.length}`)}</span>
              {owner && g.id && (
                <button className="btn btn-small btn-ghost" onClick={() => act(() => del(`/org/departments/${g.id}`))}>{L('部署を削除', 'Delete department')}</button>
              )}
            </h2>
            <ul className="org-list">
              {ms.map((m: any) => (
                <li key={m.id}>
                  <Link to={`/people/${m.id}`} className="org-who">
                    <Avatar name={m.name} email={m.email} src={m.picture_url} size={44} />
                    <span>
                      <b>{m.name || m.email}</b>
                      <small>{m.email}</small>
                    </span>
                  </Link>
                  {owner ? (
                    <span className="org-controls">
                      <select aria-label={L('役割', 'Role')} id={`role-${m.id}`} value={m.role} onChange={(e) => act(() => patch(`/org/members/${m.id}`, { role: e.target.value }))}>
                        {Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <select aria-label={L('部署', 'Department')} id={`dept-${m.id}`} value={m.department_id ?? ''} onChange={(e) => act(() => patch(`/org/members/${m.id}`, { department_id: e.target.value || null }))}>
                        <option value="">{L('部署なし', 'No department')}</option>
                        {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </span>
                  ) : (
                    <span className="chip">{ROLE[m.role]}{g.lead === m.id ? L('（部署長）', ' (lead)') : ''}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {owner && (
        <form
          className="add-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) act(() => post('/org/departments', { name })).then(() => setName(''));
          }}
        >
          <input id="new-dept" placeholder={L('部署を追加（例：EC、卸、店舗）', 'Add a department (e.g. EC, Wholesale, Store)')} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn" disabled={!name.trim()}>{L('追加', 'Add')}</button>
        </form>
      )}
    </div>
  );
}
