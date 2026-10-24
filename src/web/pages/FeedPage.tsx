import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Avatar, RingProgress } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { ErrorBox, Loading } from '../components/ui';
import { useApi } from '../hooks';
import { Composer } from '../social/Composer';
import { PostCard } from '../social/PostCard';
import { Stories } from '../social/Stories';

const SIGNAL: Record<string, string> = { ok: '順調', warn: '注意', bad: '遅れ', none: '未入力' };

/** ホーム: ストーリーズ・投稿・タイムライン。広い画面では右に全社の信号 */
export function FeedPage() {
  const me = useApi<any>('/me');
  const stories = useApi<any>('/stories');
  const [posts, setPosts] = useState<any[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [more, setMore] = useState(false);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api('/feed');
      setPosts(r.posts);
      setNext(r.next);
      setError('');
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    load();
    const on = () => {
      load();
      stories.reload();
    };
    window.addEventListener('kpi:posted', on);
    return () => window.removeEventListener('kpi:posted', on);
  }, [load]);

  const loadMore = async () => {
    if (!next) return;
    setMore(true);
    const r = await api(`/feed?before=${encodeURIComponent(next)}`).catch(() => null);
    if (r) {
      setPosts((ps) => [...(ps ?? []), ...r.posts]);
      setNext(r.next);
    }
    setMore(false);
  };

  const user = me.data?.user;
  const isOwner = me.data?.member?.role === 'owner';
  const s = stories.data;
  const mine = s?.people.find((p: any) => p.me);

  return (
    <div className="feed-layout">
      <div className="feed">
        {s ? <Stories s={s} /> : <div className="stories skeleton" aria-hidden="true" />}

        <button className="composer-open" onClick={() => setComposing(true)}>
          <Avatar name={user?.name} email={user?.email} src={user?.picture_url} size={40} />
          <span>今日の手応えを共有しよう</span>
          <Icon name="plus" />
        </button>

        {error && <ErrorBox message={error} onRetry={load} />}
        {!posts && !error && <Loading />}
        {posts && posts.length === 0 && (
          <div className="feed-empty">
            <Icon name="home" size={40} />
            <h2>タイムラインはまだ空です</h2>
            <p>今日の「やるべきこと」をできたにすると、ここに流れます。チームへの共有も投稿できます。</p>
            <Link className="btn btn-primary" to="/today">今日のページへ</Link>
          </div>
        )}
        {posts?.map((p) => (
          <PostCard key={p.id} p={p} meId={user?.id} isOwner={isOwner} onDeleted={() => setPosts((ps) => ps!.filter((x) => x.id !== p.id))} />
        ))}
        {next && (
          <button className="btn feed-more" disabled={more} onClick={loadMore}>
            {more ? '読み込み中…' : 'もっと見る'}
          </button>
        )}
      </div>

      <aside className="feed-side" aria-label="全社の状況">
        {user && (
          <Link to={`/people/${user.id}`} className="side-me">
            <Avatar name={user.name} email={user.email} src={user.picture_url} size={48} />
            <span>
              <b>{user.name || user.email}</b>
              <small>{mine ? `今日 ${mine.done}/${mine.total} できた` : '今日のページで3つ決めよう'}</small>
            </span>
          </Link>
        )}
        {s?.term && (
          <section className="side-card">
            <h3>{s.term.title}</h3>
            <div className="side-term">
              <RingProgress pct={s.term.info.elapsedPct} size={56} tone="story">
                <span className="story-pct">{s.term.info.elapsedPct}%</span>
              </RingProgress>
              <p>
                {s.term.info.phase === 'active' ? <>Day <b>{s.term.info.dayNumber}</b> / {s.term.info.totalDays}</> : s.term.info.phase === 'upcoming' ? 'まだ始まっていません' : '終わりました'}
                <br />
                <Link to={`/term/${s.term.id}`}>今期の目標を見る</Link>
              </p>
            </div>
          </section>
        )}
        <section className="side-card">
          <h3>{s?.year ?? ''}年 10倍KPI</h3>
          {s?.kpis.length ? (
            <ul className="side-kpis">
              {s.kpis.map((k: any) => (
                <li key={k.id}>
                  <span className={`sig sig-${k.signal}`} aria-label={SIGNAL[k.signal]} />
                  <span className="side-kpi-name">{k.title}</span>
                  <b>{k.pct == null ? '—' : `${k.pct}%`}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">まだ決まっていません。代表がビジョンのページで決めます。</p>
          )}
        </section>
        {s && s.people.length > 1 && (
          <section className="side-card">
            <h3>メンバーの今日</h3>
            <ul className="side-people">
              {s.people.filter((p: any) => !p.me).slice(0, 8).map((p: any) => (
                <li key={p.id}>
                  <Link to={`/people/${p.id}`}>
                    <Avatar name={p.name} email={p.email} src={p.picture_url} size={32} />
                    <span>{p.name || p.email}<small>{p.department_name ?? ''}</small></span>
                    <em>{p.total ? `${p.done}/${p.total}` : '—'}</em>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>

      {composing && (
        <Composer
          onClose={() => setComposing(false)}
          onPosted={(p) => {
            setComposing(false);
            setPosts((ps) => [p, ...(ps ?? [])]);
          }}
        />
      )}
    </div>
  );
}
