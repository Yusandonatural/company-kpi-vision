import { useEffect, useState } from 'react';
import { api, post, put } from '../api';
import { ErrorBox, Loading } from '../components/ui';
import { useApi } from '../hooks';
import { L, lang, setLang, type Lang } from '../i18n';
import { getUiMode, setUiMode, type UiMode } from '../uiMode';

export function SettingsPage() {
  const demo = !!(window as any).__FJ_DEMO;
  const me = useApi<any>('/me');
  const notion = useApi<any>('/notion/status');
  const langs = useApi<any>('/langs/status');
  const [langMsg, setLangMsg] = useState<string | null>(null);
  const [langBusy, setLangBusy] = useState(false);
  const [cals, setCals] = useState<any[] | null>(null);
  const [calErr, setCalErr] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    api('/calendar/calendars').then(setCals).catch((e) => setCalErr(e.message));
  }, []);

  if (me.error) return <ErrorBox message={me.error} onRetry={me.reload} />;
  if (!me.data) return <Loading />;
  const s = me.data.settings;
  const primaryId = cals?.find((c) => c.primary)?.id;
  const selected = (id: string) => s.calendarIds.includes(id) || (id === primaryId && s.calendarIds.includes('primary'));

  async function toggleCal(id: string, on: boolean) {
    const cur = s.calendarIds.map((x: string) => (x === 'primary' && primaryId ? primaryId : x));
    const next = on ? [...new Set([...cur, id])] : cur.filter((x: string) => x !== id);
    await put('/settings', { calendarIds: next });
    me.reload();
  }

  async function sync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await post('/notion/sync');
      setSyncMsg(
        L(
          `送信 ${r.pushed}件・取り込み 更新${r.updated}件／新規${r.created}件${r.errors ? `・エラー ${r.errors}件` : ''}${r.pullError ? `（取り込みでエラー: ${r.pullError}）` : ''}`,
          `Sent ${r.pushed} · Imported: ${r.updated} updated / ${r.created} new${r.errors ? ` · ${r.errors} errors` : ''}${r.pullError ? ` (import error: ${r.pullError})` : ''}`,
        ),
      );
    } catch (e: any) {
      setSyncMsg(e.message);
    }
    setSyncing(false);
    notion.reload();
  }

  async function syncLangs() {
    setLangBusy(true);
    setLangMsg(null);
    try {
      const r = await post('/langs/sync');
      setLangMsg(r.errors.length ? r.errors.join('\n') : L(`反映しました（目標 ${r.goals}件・学習した日 ${r.checked}日）`, `Synced (${r.goals} goals · ${r.checked} study days)`));
    } catch (e: any) {
      setLangMsg(e.message);
    }
    setLangBusy(false);
    langs.reload();
  }

  return (
    <div className="page narrow-wide">
      <h1 className="page-title">{L('設定', 'Settings')}</h1>

      <UiModeCard />
      <LangCard />

      <section className="card">
        <h2 className="card-title">{L('アカウント', 'Account')}</h2>
        <p>{me.data.user.name} <span className="muted">{L('（', '(')}{me.data.user.email}{L('）', ')')}</span></p>
        {demo ? <p className="muted small">{L('デモ版のためログアウトはありません。', 'Logout is not available in the demo.')}</p> : <button className="btn" onClick={async () => { await post('/logout'); location.href = '/login'; }}>{L('ログアウト', 'Log out')}</button>}
      </section>

      <section className="card">
        <h2 className="card-title">{L('Googleカレンダー', 'Google Calendar')}</h2>
        {calErr === 'google_reconnect' || !me.data.googleConnected ? (
          <div className="notice">
            {L('Googleカレンダーに接続されていません。', 'Google Calendar is not connected.')}
            <a className="btn btn-small btn-primary" href="/auth/google">{L('Googleに接続', 'Connect Google')}</a>
          </div>
        ) : calErr ? (
          <p className="form-error">{calErr}</p>
        ) : !cals ? (
          <Loading />
        ) : (
          <>
            <p className="muted small">{L('ジャーナルに表示するカレンダーを選びます。', 'Choose the calendars to show in the journal.')}</p>
            <ul className="plain-list">
              {cals.map((c) => (
                <li key={c.id}>
                  <label className="check">
                    <input type="checkbox" checked={selected(c.id)} onChange={(e) => toggleCal(c.id, e.target.checked)} />
                    <span><span className="event-dot" style={{ background: c.color }} /> {c.summary}{c.primary && L('（メイン）', ' (main)')}{!c.writable && <span className="muted small">{L(' 閲覧のみ', ' read-only')}</span>}</span>
                  </label>
                </li>
              ))}
            </ul>
            {!demo && <a className="btn btn-small btn-ghost" href="/auth/google">{L('Googleに再接続', 'Reconnect Google')}</a>}
          </>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">{L('「できなかった」の判定', 'When a task counts as missed')}</h2>
        <p className="muted small">{L('未完了のタスクを、いつ「できなかった」にするか。', 'When an unfinished task is marked as missed.')}</p>
        {[
          ['midnight', L('日付が変わった時点（0時）', 'At midnight')],
          ['noon', L('翌日の正午（朝にチェックする人向け）', 'Noon the next day (for morning check-ins)')],
        ].map(([v, label]) => (
          <label key={v} className="check">
            <input type="radio" name="cutoff" checked={s.missedCutoff === v} onChange={async () => { await put('/settings', { missedCutoff: v }); me.reload(); }} />
            <span>{label}</span>
          </label>
        ))}
      </section>

      <section className="card">
        <h2 className="card-title">{L('語学アプリとの連動', 'Language app link')}</h2>
        <p className="small">
          {L(
            '90日フランス語・中国語（90日外国語会話）の学習記録を、目標に自動で反映します。目標の「詳細」で連動させる語学アプリを選んでください。',
            'Study records from the 90-day French / Chinese apps are reflected in your goals automatically. Pick the app to link under a goal’s “Details”.',
          )}
          <br />
          {L(
            '習慣目標 → その日に学習した（XP が付いた）日に ✓ ／ プロジェクト目標 → クリアした Day 数 ÷ 90 を進捗に',
            'Habit goals → ✓ on days you studied (earned XP) / Project goals → progress = cleared days ÷ 90',
          )}
        </p>
        {langs.error ? (
          <div className="notice">{demo ? L('デモ版では語学アプリとの連動は動きません。', 'The language app link does not work in the demo.') : langs.error}</div>
        ) : !langs.data ? (
          <Loading />
        ) : !langs.data.enabled ? (
          <div className="notice">{L('語学アプリとの連動が未設定です。サーバーに FIREBASE_SERVICE_ACCOUNT（Firebase のサービスアカウントの鍵）を登録してください（README の手順）。', 'The language app link is not set up. Register FIREBASE_SERVICE_ACCOUNT (the Firebase service account key) on the server (see README).')}</div>
        ) : (
          <>
            <p className="muted small">
              {L('語学アプリには、このアカウントと同じ Google アカウント（', 'Sign in to the language app with the same Google account (')}{me.data.user.email}{L('）でログインしてください。15分ごとに自動で反映します。', '). It syncs automatically every 15 minutes.')}<br />
              {L('最終反映: ', 'Last sync: ')}{langs.data.lastSync ? new Date(langs.data.lastSync).toLocaleString(L('ja-JP', 'en-US')) : L('まだ', 'not yet')}{L(' ・ 連動中の目標 ', ' · Linked goals: ')}{langs.data.linked.length}{L('件', '')}
            </p>
            {langs.data.error && <p className="error-text small" style={{ whiteSpace: 'pre-line' }}>{langs.data.error}</p>}
            <button className="btn btn-primary" onClick={syncLangs} disabled={langBusy}>{langBusy ? L('反映中…', 'Syncing…') : L('今すぐ反映', 'Sync now')}</button>
            {langMsg && <p className="muted small" style={{ whiteSpace: 'pre-line' }}>{langMsg}</p>}
          </>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">{L('Notion 連携', 'Notion sync')}</h2>
        {!notion.data ? (
          <Loading />
        ) : !notion.data.enabled ? (
          <div className="notice">
            {demo
              ? L('デモ版では Notion 連携は動きません。本番では「🎒 Todo リスト」と同期します。', 'Notion sync does not work in the demo. In production it syncs with “🎒 Todo list”.')
              : L('Notion が未接続です。サーバーに NOTION_TOKEN を設定し、Notion の「MY LIFE OS」ページにインテグレーションを追加してください（README の手順）。', 'Notion is not connected. Set NOTION_TOKEN on the server and add the integration to the “MY LIFE OS” page in Notion (see README).')}
          </div>
        ) : (
          <>
            <p>
              {L('同期先: 🎒 Todo リスト（タグ「', 'Syncs with: 🎒 Todo list (only rows tagged “')}{notion.data.tag}{L('」の行のみ）', '”)')}<br />
              <span className="small">{L('アプリで作ったタスクは「できた」にしたものだけ送ります。Notion から選んだタスクは状態を同期します。', 'Tasks made in the app are sent only once done. Tasks picked from Notion keep their status in sync.')}</span><br />
              <span className="muted small">
                {L('最終取り込み: ', 'Last import: ')}{notion.data.lastPull ? new Date(notion.data.lastPull).toLocaleString(L('ja-JP', 'en-US')) : L('まだ', 'not yet')}{L(' ・ 未同期 ', ' · Unsynced: ')}{notion.data.dirty}{L('件 ・ エラー ', ' · Errors: ')}{notion.data.errors}{L('件', '')}
              </span>
            </p>
            <button className="btn btn-primary" onClick={sync} disabled={syncing}>{syncing ? L('同期中…', 'Syncing…') : L('今すぐ同期', 'Sync now')}</button>
            {syncMsg && <p className="muted small">{syncMsg}</p>}
            {notion.data.logs.length > 0 && (
              <details className="group">
                <summary>{L('同期ログ', 'Sync log')}</summary>
                <ul className="plain-list small">
                  {notion.data.logs.map((l: any) => (
                    <li key={l.id} className={l.result === 'error' ? 'error-text' : ''}>
                      <span className="muted">{l.created_at}</span> {l.direction === 'push' ? L('送信', 'Sent') : L('取り込み', 'Imported')}: {l.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/** 画面の形（この端末だけ）。どちらでも、タイムライン・ジャーナルの機能はすべて使える */
function UiModeCard() {
  const [mode, setMode] = useState<UiMode>(getUiMode());
  const choose = (m: UiMode) => {
    setMode(m);
    setUiMode(m);
    // ナビゲーションを入れ替えるため、最初の画面から開き直す
    location.href = m === 'classic' ? '/today' : '/home';
  };
  const OPTIONS: { v: UiMode; title: string; desc: string }[] = [
    {
      v: 'sns',
      title: L('タイムラインの形', 'Timeline layout'),
      desc: L('ホームにチームの「できた」とストーリーズ。左のメニュー／スマホは下のアイコン（Instagram・Facebook 風）', 'Home shows the team’s wins and stories. Side menu, or icons at the bottom on phones (Instagram / Facebook style)'),
    },
    {
      v: 'classic',
      title: L('ジャーナルの形（今までの使い方）', 'Journal layout (the original)'),
      desc: L('「今日」のページから始まり、上のタブで 今日・週間・月間・3ヶ月・ビジョン。タイムラインもタブから開けます', 'Starts on “Today”, with tabs for Today, Week, Month, 90 days and Vision. The timeline is a tab too'),
    },
  ];
  return (
    <section className="card">
      <h2 className="card-title">{L('画面の形', 'Layout')}</h2>
      <p className="muted small">{L('この端末だけの設定です。どちらを選んでも、記録や目標は同じものが出ます。', 'This device only. Your records and goals are the same either way.')}</p>
      <div className="ui-mode">
        {OPTIONS.map((o) => (
          <label key={o.v} className={`ui-mode-opt ${mode === o.v ? 'on' : ''}`}>
            <input type="radio" name="ui-mode" checked={mode === o.v} onChange={() => choose(o.v)} />
            <span>
              <b>{o.title}</b>
              <small>{o.desc}</small>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

/** 画面の言語（この端末だけ）。選び直すと開き直す */
function LangCard() {
  const OPTIONS: { v: Lang; title: string }[] = [
    { v: 'ja', title: '日本語' },
    { v: 'en', title: 'English' },
  ];
  return (
    <section className="card">
      <h2 className="card-title">{L('言語', 'Language')}</h2>
      <p className="muted small">{L('この端末だけの設定です。入力した内容（ビジョンやプロジェクト名など）は翻訳されません。', 'This device only. What people write (vision, project names, posts) is not translated.')}</p>
      <div className="ui-mode">
        {OPTIONS.map((o) => (
          <label key={o.v} className={`ui-mode-opt ${lang === o.v ? 'on' : ''}`}>
            <input type="radio" name="lang" checked={lang === o.v} onChange={() => setLang(o.v)} />
            <span>
              <b>{o.title}</b>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
