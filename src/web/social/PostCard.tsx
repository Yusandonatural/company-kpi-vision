import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, del, post, put } from '../api';
import { Avatar, timeAgo } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { L } from '../i18n';

const KIND: Record<string, { label: string; icon: string; tone: string }> = {
  task_done: { label: L('できた', 'Done'), icon: 'check', tone: 'ok' },
  milestone: { label: L('マイルストーン達成', 'Milestone reached'), icon: 'flag', tone: 'gold' },
  kpi: { label: L('KPIを更新', 'KPI updated'), icon: 'chart', tone: 'blue' },
  review: { label: L('ふりかえり', 'Review'), icon: 'book', tone: 'violet' },
  improvement: { label: L('改善ポイントを修正', 'Kaizen fixed'), icon: 'check', tone: 'kaizen' },
};

const ROLE: Record<string, string> = { owner: L('代表', 'CEO'), lead: L('部署長', 'Dept. lead'), member: '' };

export function PostCard({ p, meId, isOwner, onDeleted }: { p: any; meId?: string; isOwner?: boolean; onDeleted?: () => void }) {
  const [liked, setLiked] = useState<boolean>(p.liked);
  const [likes, setLikes] = useState<number>(p.like_count);
  const [pop, setPop] = useState(false);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<any[] | null>(null);
  const [count, setCount] = useState<number>(p.comment_count);
  const [draft, setDraft] = useState('');
  const [menu, setMenu] = useState(false);
  const kind = KIND[p.kind];
  const name = p.user_name || p.user_email;

  const like = async (on = !liked) => {
    setLiked(on);
    setLikes((n) => n + (on ? 1 : -1));
    if (on) {
      setPop(true);
      setTimeout(() => setPop(false), 450);
    }
    try {
      const r = await put(`/posts/${p.id}/like`, { on });
      setLikes(r.like_count);
    } catch {
      setLiked(!on);
      setLikes((n) => n + (on ? -1 : 1));
    }
  };
  const toggleComments = async () => {
    setOpen((o) => !o);
    if (!comments) setComments(await api(`/posts/${p.id}/comments`).catch(() => []));
  };
  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    const k = await post(`/posts/${p.id}/comments`, { body });
    setComments((cs) => [...(cs ?? []), k]);
    setCount((n) => n + 1);
  };
  const remove = async () => {
    await del(`/posts/${p.id}`);
    onDeleted?.();
  };

  const lines = String(p.body ?? '').split('\n');
  return (
    <article className="post" aria-label={L(`${name}の投稿`, `Post by ${name}`)}>
      <header className="post-head">
        <Link to={`/people/${p.user_id}`} className="post-who">
          <Avatar name={p.user_name} email={p.user_email} src={p.user_picture} size={40} />
          <span className="post-names">
            <b>{name}</b>
            <span className="post-meta">
              {[ROLE[p.user_role], p.department_name].filter(Boolean).join(L('・', ' · '))}
              {(ROLE[p.user_role] || p.department_name) && ' · '}
              <time dateTime={p.created_at}>{timeAgo(p.created_at)}</time>
            </span>
          </span>
        </Link>
        {(p.user_id === meId || isOwner) && (
          <div className="post-menu">
            <button className="icon-btn" aria-label={L('メニュー', 'Menu')} onClick={() => setMenu((v) => !v)}><Icon name="more" /></button>
            {menu && (
              <div className="post-menu-pop" role="menu">
                <button role="menuitem" className="danger" onClick={remove}>{L('投稿を削除', 'Delete post')}</button>
              </div>
            )}
          </div>
        )}
      </header>

      {kind ? (
        <div className={`post-achieve tone-${kind.tone}`} onDoubleClick={() => !liked && like(true)}>
          <span className="pa-badge"><Icon name={kind.icon} size={18} /> {kind.label}</span>
          <p className="pa-title">{lines[0]}</p>
          {lines.slice(1).filter(Boolean).map((l, i) => <p key={i} className="pa-sub">{l}</p>)}
          {p.goal_title && <span className="pa-goal"><Icon name="target" size={14} /> {p.goal_title}</span>}
          {pop && <span className="heart-pop" aria-hidden="true"><Icon name="heart" filled size={72} /></span>}
        </div>
      ) : (
        <div className="post-body" onDoubleClick={() => !liked && like(true)}>
          {lines.map((l, i) => <p key={i}>{l || ' '}</p>)}
          {p.goal_title && <span className="pa-goal"><Icon name="target" size={14} /> {p.goal_title}</span>}
          {pop && <span className="heart-pop" aria-hidden="true"><Icon name="heart" filled size={72} /></span>}
        </div>
      )}

      <div className="post-actions">
        <button className={`pa-btn ${liked ? 'liked' : ''}`} aria-pressed={liked} onClick={() => like()}>
          <Icon name="heart" filled={liked} /> <span>{L('いいね', 'Like')}</span>
        </button>
        <button className="pa-btn" aria-expanded={open} onClick={toggleComments}>
          <Icon name="comment" /> <span>{L('コメント', 'Comment')}</span>
        </button>
      </div>
      {(likes > 0 || count > 0) && (
        <div className="post-counts">
          {likes > 0 && (
            <span>
              <b>{likes}</b>
              {L(
                `件のいいね${p.likers?.length ? `（${p.likers.slice(0, 2).join('、')}${likes > 2 ? 'ほか' : ''}）` : ''}`,
                ` ${likes === 1 ? 'like' : 'likes'}${p.likers?.length ? ` (${p.likers.slice(0, 2).join(', ')}${likes > 2 ? ' and others' : ''})` : ''}`,
              )}
            </span>
          )}
          {count > 0 && <button className="link" onClick={toggleComments}>{L(`コメント${count}件`, `${count} ${count === 1 ? 'comment' : 'comments'}`)}</button>}
        </div>
      )}

      {open && (
        <div className="comments">
          {(comments ?? []).map((k) => (
            <div key={k.id} className="comment">
              <Avatar name={k.user_name} email={k.user_email} src={k.user_picture} size={28} />
              <div className="comment-bubble">
                <b>{k.user_name || k.user_email}</b>
                <p>{k.body}</p>
                <span className="post-meta">{timeAgo(k.created_at)}</span>
              </div>
            </div>
          ))}
          {comments === null && <p className="muted small">{L('読み込み中…', 'Loading…')}</p>}
          <div className="comment-new">
            <input
              id={`c-${p.id}`}
              aria-label={L('コメント', 'Comment')}
              placeholder={L('コメントを書く…', 'Write a comment…')}
              value={draft}
              maxLength={1000}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && send()}
            />
            <button className="icon-btn" aria-label={L('送信', 'Send')} disabled={!draft.trim()} onClick={send}><Icon name="send" size={20} /></button>
          </div>
        </div>
      )}
    </article>
  );
}

/** 同じ人の同じ日の「できた」が続いたら1枚にまとめる（タイムラインが「できた」で埋まらないように） */
export function groupDone(posts: any[]): (any | { group: any[] })[] {
  const day = (s: string) => new Date(Date.parse(s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z')) + 9 * 3600e3).toISOString().slice(0, 10);
  const out: (any | { group: any[] })[] = [];
  for (const p of posts) {
    const last = out[out.length - 1];
    const head = last && ('group' in last ? last.group[0] : last);
    if (p.kind === 'task_done' && head?.kind === 'task_done' && head.user_id === p.user_id && day(head.created_at) === day(p.created_at)) {
      if ('group' in last) last.group.push(p);
      else out[out.length - 1] = { group: [last, p] };
    } else out.push(p);
  }
  return out;
}

export function DoneGroup({ posts, meId, isOwner, onDeleted }: { posts: any[]; meId?: string; isOwner?: boolean; onDeleted?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const p = posts[0];
  const name = p.user_name || p.user_email;
  if (open) {
    return (
      <div className="done-group-open">
        {posts.map((x) => <PostCard key={x.id} p={x} meId={meId} isOwner={isOwner} onDeleted={() => onDeleted?.(x.id)} />)}
        <button className="btn btn-small btn-ghost done-group-fold" onClick={() => setOpen(false)}>{L('まとめて表示', 'Show as one')}</button>
      </div>
    );
  }
  return (
    <article className="post" aria-label={L(`${name}の「できた」${posts.length}件`, `${posts.length} done by ${name}`)}>
      <header className="post-head">
        <Link to={`/people/${p.user_id}`} className="post-who">
          <Avatar name={p.user_name} email={p.user_email} src={p.user_picture} size={40} />
          <span className="post-names">
            <b>{name}</b>
            <span className="post-meta">
              {[ROLE[p.user_role], p.department_name].filter(Boolean).join(L('・', ' · '))}
              {(ROLE[p.user_role] || p.department_name) && ' · '}
              <time dateTime={p.created_at}>{timeAgo(p.created_at)}</time>
            </span>
          </span>
        </Link>
      </header>
      <div className="post-achieve tone-ok">
        <span className="pa-badge"><Icon name="check" size={18} /> {L(`できた ${posts.length}件`, `Done · ${posts.length}`)}</span>
        <ul className="done-list">
          {posts.map((x) => <DoneRow key={x.id} p={x} />)}
        </ul>
      </div>
      <div className="post-actions">
        <button className="pa-btn" onClick={() => setOpen(true)}>
          <Icon name="comment" /> <span>{L('1件ずつ見る・コメント', 'Open each · Comment')}</span>
        </button>
      </div>
    </article>
  );
}

function DoneRow({ p }: { p: any }) {
  const [liked, setLiked] = useState<boolean>(p.liked);
  const [likes, setLikes] = useState<number>(p.like_count);
  const like = async () => {
    const on = !liked;
    setLiked(on);
    setLikes((n) => n + (on ? 1 : -1));
    try {
      setLikes((await put(`/posts/${p.id}/like`, { on })).like_count);
    } catch {
      setLiked(!on);
      setLikes((n) => n + (on ? -1 : 1));
    }
  };
  const title = String(p.body ?? '').split('\n')[0];
  return (
    <li>
      <span className="done-title">
        <b>{title}</b>
        {p.goal_title && <span className="pa-goal"><Icon name="target" size={14} /> {p.goal_title}</span>}
      </span>
      <button className={`done-like ${liked ? 'liked' : ''}`} aria-pressed={liked} aria-label={L(`「${title}」にいいね`, `Like “${title}”`)} onClick={like}>
        <Icon name="heart" filled={liked} size={18} />{likes > 0 && <span>{likes}</span>}
      </button>
    </li>
  );
}
