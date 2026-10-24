import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { mondayOf, monthStart, todayJST } from '../../shared/dates';
import { api, put } from '../api';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { ErrorBox, Loading } from '../components/ui';
import { useApi } from '../hooks';
import { L } from '../i18n';
import { PostCard } from '../social/PostCard';

const ROLE: Record<string, string> = { owner: L('代表', 'CEO'), lead: L('部署長', 'Dept. lead'), member: L('担当', 'Member') };

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
            <span className="chip">{ROLE[p.role] ?? L('担当', 'Member')}</span>
            {p.department_name && <span className="chip soft">{p.department_name}</span>}
          </p>
          <ul className="prof-stats">
            <li><b>{stats.posts}</b><span>{L('投稿', 'Posts')}</span></li>
            <li><b>{t.done}</b><span>{L('今期できた', 'Done this term')}</span></li>
            <li><b>{stats.likes}</b><span>{L('いいね', 'Likes')}</span></li>
            <li><b>{t.rate == null ? '—' : `${t.rate}%`}</b><span>{L('達成率', 'Completion')}</span></li>
          </ul>
        </div>
      </header>

      {p.me && (
        <nav className="prof-links" aria-label={L('自分のページ', 'My pages')}>
          <Link to="/today"><Icon name="today" /><span>{L('今日', 'Today')}</span></Link>
          <Link to={`/week/${mondayOf(today)}`}><Icon name="week" /><span>{L('週間', 'Week')}</span></Link>
          <Link to={`/month/${monthStart(today)}`}><Icon name="month" /><span>{L('月間', 'Month')}</span></Link>
          {term && <Link to={`/term/${term.id}/review`}><Icon name="book" /><span>{L('今期の総括', 'Term review')}</span></Link>}
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
            {L('「できた」をタイムラインに自動で流す', 'Post my wins to the timeline automatically')}
            <small>{L('今日のタスク・マイルストーン・ふりかえりを全員に共有します', 'Shares today’s tasks, milestones and reviews with everyone')}</small>
          </span>
        </label>
      )}

      {goals.length > 0 && (
        <section className="prof-goals">
          <h2>{L('担当している目標', 'Goals I own')}</h2>
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
        <h2 className="tabline"><span>{L('投稿', 'Posts')}</span></h2>
        {!posts && <Loading />}
        {posts?.length === 0 && <p className="muted center">{L('まだ投稿はありません', 'No posts yet')}</p>}
        {posts?.map((x) => (
          <PostCard key={x.id} p={x} meId={me.data?.user?.id} isOwner={me.data?.member?.role === 'owner'} onDeleted={load} />
        ))}
      </section>
    </div>
  );
}
