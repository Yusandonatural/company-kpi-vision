import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { mondayOf, monthStart, todayJST } from '../../shared/dates';
import { api, put } from '../api';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { ErrorBox, Loading } from '../components/ui';
import { useApi } from '../hooks';
import { PostCard } from '../social/PostCard';

const ROLE: Record<string, string> = { owner: '代表', lead: '部署長', member: '担当' };

export function ProfilePage() {
  const { id } = useParams();
  const prof = useApi<any>(`/people/${id}`);
  const me = useApi<any>('/me');
  const [posts, setPosts] = useState<any[] | null>(null);
  const [share, setShare] = useState<boolean | null>(null);
  const load = useCallback(() => {
    setPosts(null);
    api(`/feed?user=${id}&limit=30`).then((r) => setPosts(r.posts)).catch(() => setPosts([]));
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => {
    if (me.data) setShare(me.data.settings?.shareDone ?? true);
  }, [me.data]);

  if (prof.error) return <ErrorBox message={prof.error} onRetry={prof.reload} />;
  if (!prof.data) return <Loading />;
  const { person: p, stats, goals, term } = prof.data;
  const t = stats.term;
  const today = todayJST();

  return (
    <div className="profile">
      <header className="prof-head">
        <Avatar name={p.name} email={p.email} src={p.picture_url} size={96} ring="story" />
        <div className="prof-info">
          <h1>{p.name || p.email}</h1>
          <p className="prof-role">
            <span className="chip">{ROLE[p.role] ?? '担当'}</span>
            {p.department_name && <span className="chip soft">{p.department_name}</span>}
          </p>
          <ul className="prof-stats">
            <li><b>{stats.posts}</b><span>投稿</span></li>
            <li><b>{t.done}</b><span>今期できた</span></li>
            <li><b>{stats.likes}</b><span>いいね</span></li>
            <li><b>{t.rate == null ? '—' : `${t.rate}%`}</b><span>達成率</span></li>
          </ul>
        </div>
      </header>

      {p.me && (
        <nav className="prof-links" aria-label="自分のページ">
          <Link to="/today"><Icon name="today" /><span>今日</span></Link>
          <Link to={`/week/${mondayOf(today)}`}><Icon name="week" /><span>週間</span></Link>
          <Link to={`/month/${monthStart(today)}`}><Icon name="month" /><span>月間</span></Link>
          {term && <Link to={`/term/${term.id}/review`}><Icon name="book" /><span>今期の総括</span></Link>}
        </nav>
      )}

      {p.me && share != null && (
        <label className="prof-share">
          <input
            type="checkbox"
            checked={share}
            onChange={async (e) => {
              setShare(e.target.checked);
              await put('/settings/share', { on: e.target.checked }).catch(() => setShare(!e.target.checked));
            }}
          />
          <span>
            「できた」をタイムラインに自動で流す
            <small>今日のタスク・マイルストーン・ふりかえりを全員に共有します</small>
          </span>
        </label>
      )}

      {goals.length > 0 && (
        <section className="prof-goals">
          <h2>担当している目標</h2>
          <ul>
            {goals.map((g: any) => (
              <li key={g.id}>
                <Link to={`/term/${term.id}`}><Icon name="target" size={18} /> {g.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="prof-posts">
        <h2 className="tabline"><span>投稿</span></h2>
        {!posts && <Loading />}
        {posts?.length === 0 && <p className="muted center">まだ投稿はありません</p>}
        {posts?.map((x) => (
          <PostCard key={x.id} p={x} meId={me.data?.user?.id} isOwner={me.data?.member?.role === 'owner'} onDeleted={load} />
        ))}
      </section>
    </div>
  );
}
