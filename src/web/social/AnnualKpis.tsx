import { useState } from 'react';
import { todayJST } from '../../shared/dates';
import { del, patch, post, put } from '../api';
import { RingProgress } from '../components/Avatar';
import { useApi } from '../hooks';

const SIGNAL: Record<string, string> = { ok: '順調', warn: '注意', bad: '遅れ', none: '未入力' };
const fmt = (n: number | null | undefined) => (n == null ? '—' : Number(n).toLocaleString('ja-JP', { maximumFractionDigits: 1 }));

/** 年間の10倍KPI（1年に3つまで）。代表だけが作り・直し・数値を入れる */
export function AnnualKpis({ owner }: { owner: boolean }) {
  const year = Number(todayJST().slice(0, 4));
  const { data, reload } = useApi<any>(`/kpis/annual?year=${year}`);
  const [title, setTitle] = useState('');
  const [err, setErr] = useState('');
  const act = async (fn: () => Promise<unknown>) => {
    setErr('');
    try {
      await fn();
      await reload();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  if (!data) return <section className="card"><h2 className="card-title">{year}年の10倍KPI</h2></section>;
  return (
    <section className="card kpi-card">
      <div className="card-head">
        <h2 className="card-title">{year}年の10倍KPI</h2>
        <span className="muted small">年の経過 {data.elapsedPct}%</span>
      </div>
      {data.kpis.length === 0 && <p className="muted">{owner ? '会社全体で追う数字を1〜3つに絞って決めましょう。' : 'まだ決まっていません。'}</p>}
      <ul className="kpi-list">
        {data.kpis.map((k: any) => (
          <KpiRow key={k.id} k={k} owner={owner} sources={data.sources} act={act} />
        ))}
      </ul>
      {err && <p className="form-error">{err}</p>}
      {owner && data.kpis.length < 3 && (
        <form className="add-row" onSubmit={(e) => { e.preventDefault(); if (title.trim()) act(() => post('/kpis/annual', { title, year })).then(() => setTitle('')); }}>
          <input id="new-kpi" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: 年間売上" aria-label="新しい10倍KPI" />
          <button className="btn btn-primary" disabled={!title.trim()}>追加</button>
        </form>
      )}
    </section>
  );
}

function KpiRow({ k, owner, sources, act }: { k: any; owner: boolean; sources: any[]; act: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: k.title, metric_unit: k.metric_unit ?? '', metric_start: k.metric_start ?? '', metric_target: k.metric_target ?? '', link_source: k.link_source ?? '' });
  const [value, setValue] = useState('');
  const src = sources.find((s) => s.id === k.link_source);
  return (
    <li className="kpi-row">
      <div className="kpi-main">
        <RingProgress pct={k.pct} tone={k.signal} size={56}>
          <span className="story-pct">{k.pct == null ? '—' : `${k.pct}%`}</span>
        </RingProgress>
        <div className="kpi-text">
          <b>{k.title}</b>
          <span className="muted small">
            {fmt(k.metric_current)} / {fmt(k.metric_target)}{k.metric_unit ?? ''}
            {src ? `・${src.label}から取り込み` : '・手入力'}
          </span>
        </div>
        <span className={`sig-pill sig-${k.signal}`}>{SIGNAL[k.signal]}</span>
        {owner && <button className="btn btn-small btn-ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '閉じる' : '編集'}</button>}
      </div>
      {open && owner && (
        <div className="form kpi-edit">
          <div className="form-row">
            <label>名前<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
            <label>単位<input value={f.metric_unit} placeholder="万円" onChange={(e) => setF({ ...f, metric_unit: e.target.value })} /></label>
          </div>
          <div className="form-row">
            <label>年初<input type="number" inputMode="decimal" value={f.metric_start} onChange={(e) => setF({ ...f, metric_start: e.target.value })} /></label>
            <label>年間の目標<input type="number" inputMode="decimal" value={f.metric_target} onChange={(e) => setF({ ...f, metric_target: e.target.value })} /></label>
            <label>
              取り込み元
              <select value={f.link_source} onChange={(e) => setF({ ...f, link_source: e.target.value })}>
                <option value="">手入力</option>
                {sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
          </div>
          <div className="form-row kpi-actions">
            <button className="btn btn-primary" onClick={() => act(() => patch(`/kpis/annual/${k.id}`, f)).then(() => setOpen(false))}>保存</button>
            <button className="btn btn-danger" onClick={() => act(() => del(`/kpis/annual/${k.id}`))}>削除</button>
          </div>
        </div>
      )}
      {owner && (
        <form className="add-row small kpi-value" onSubmit={(e) => { e.preventDefault(); if (value !== '') act(() => put(`/kpis/annual/${k.id}/values/${todayJST()}`, { value })).then(() => setValue('')); }}>
          <input type="number" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={`今日の時点の値（${k.metric_unit || '数値'}）`} aria-label={`${k.title}の今日の値`} />
          <button className="btn btn-small" disabled={value === ''}>記録</button>
        </form>
      )}
    </li>
  );
}
