import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { mondayOf, monthStart, todayJST } from '../../shared/dates';
import { useApi } from '../hooks';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { Composer } from '../social/Composer';

/** Instagram / Facebook のような形: 画面が広いときは左のメニュー、スマホは下のタブ */
export function Layout() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const me = useApi<any>('/me');
  const [composing, setComposing] = useState(false);
  // 見ている日付を基準に切り替える（11月の週を見ていれば「月間」は11月を開く）
  const m = pathname.match(/^\/(day|week|month)\/(\d{4}-\d{2}-\d{2})/);
  const anchor = m ? m[2] : todayJST();
  const myId = me.data?.user?.id;
  const ITEMS = [
    { to: '/home', match: ['/home'], label: 'ホーム', icon: 'home' },
    { to: '/today', match: ['/day'], label: '今日', icon: 'today' },
    { to: `/week/${mondayOf(anchor)}`, match: ['/week'], label: '週間', icon: 'week', wide: true },
    { to: `/month/${monthStart(anchor)}`, match: ['/month'], label: '月間', icon: 'month', wide: true },
    { to: `/term?date=${anchor}`, match: ['/term'], label: '目標', icon: 'target' },
    { to: '/life', match: ['/life'], label: 'ビジョン', icon: 'vision', wide: true },
    { to: '/org', match: ['/org'], label: 'メンバー', icon: 'org', wide: true },
  ];
  const active = (ms: string[]) => ms.some((x) => pathname.startsWith(x));
  const meActive = myId && pathname === `/people/${myId}`;

  // 上のバーの高さを CSS に渡す（目標の帯をその下に貼り付けるため）
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--topbar-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const meAvatar = <Avatar name={me.data?.user?.name} email={me.data?.user?.email} src={me.data?.user?.picture_url} size={26} />;

  return (
    <div className="app sns">
      <aside className="sidenav" aria-label="メイン">
        <NavLink to="/home" className="sn-brand">
          <img src="/icon.svg" alt="" width="30" height="30" />
          <span>悠三堂 <b>KPI</b></span>
        </NavLink>
        <nav className="sn-items">
          {ITEMS.map((t) => (
            <NavLink key={t.label} to={t.to} className={active(t.match) ? 'active' : ''}>
              <Icon name={t.icon} filled={active(t.match)} />
              <span>{t.label}</span>
            </NavLink>
          ))}
          <button type="button" onClick={() => setComposing(true)}>
            <Icon name="plus" />
            <span>投稿する</span>
          </button>
          {myId && (
            <NavLink to={`/people/${myId}`} className={meActive ? 'active' : ''}>
              {meAvatar}
              <span>プロフィール</span>
            </NavLink>
          )}
        </nav>
        <NavLink to="/settings" className={`sn-foot ${pathname.startsWith('/settings') ? 'active' : ''}`}>
          <Icon name="settings" />
          <span>設定</span>
        </NavLink>
      </aside>

      <header className="topbar" ref={bar}>
        <NavLink to="/home" className="brand">
          <img className="brand-mark" src="/icon.svg" alt="" width="26" height="26" />
          <span className="brand-name">悠三堂 <b>KPI</b></span>
        </NavLink>
        <div className="topbar-actions">
          <NavLink to={`/week/${mondayOf(anchor)}`} aria-label="週間" className={active(['/week']) ? 'active' : ''}><Icon name="week" /></NavLink>
          <NavLink to="/org" aria-label="メンバー" className={active(['/org']) ? 'active' : ''}><Icon name="org" /></NavLink>
          <NavLink to="/settings" aria-label="設定" className={pathname.startsWith('/settings') ? 'active' : ''}><Icon name="settings" /></NavLink>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <nav className="bottombar" aria-label="メイン">
        {ITEMS.filter((t) => !t.wide).slice(0, 2).map((t) => (
          <NavLink key={t.label} to={t.to} className={active(t.match) ? 'active' : ''} aria-label={t.label}>
            <Icon name={t.icon} filled={active(t.match)} />
          </NavLink>
        ))}
        <button type="button" onClick={() => setComposing(true)} aria-label="投稿する">
          <Icon name="plus" />
        </button>
        <NavLink to={`/term?date=${anchor}`} className={active(['/term']) ? 'active' : ''} aria-label="目標">
          <Icon name="target" />
        </NavLink>
        <NavLink to={myId ? `/people/${myId}` : '/settings'} className={meActive ? 'active me' : 'me'} aria-label="プロフィール">
          {meAvatar}
        </NavLink>
      </nav>

      {composing && (
        <Composer
          onClose={() => setComposing(false)}
          onPosted={() => {
            setComposing(false);
            if (pathname !== '/home') nav('/home');
            window.dispatchEvent(new Event('kpi:posted'));
          }}
        />
      )}
    </div>
  );
}
