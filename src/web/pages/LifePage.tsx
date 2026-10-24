import { useState } from 'react';
import { put } from '../api';
import { ErrorBox, Loading, SaveBadge } from '../components/ui';
import { useApi, useAutosave } from '../hooks';
import { AnnualKpis } from '../social/AnnualKpis';
import { VisionBoard } from '../social/VisionBoard';


export function LifePage() {
  const { data, error, reload } = useApi<any>('/life');
  const me = useApi<any>('/me');
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data || !me.data) return <Loading />;
  return <LifeView data={data} reload={reload} owner={me.data.member?.role === 'owner'} />;
}

function LifeView({ data, reload, owner }: { data: any; reload: () => void; owner: boolean }) {
  const [vision, setVision] = useState<string>(data.vision);
  const [mission, setMission] = useState<string>(data.mission ?? '');
  const save = useAutosave((v: { vision?: string; mission?: string }) => put('/life', v), 800, '/api/life', 'fj.draft.life');

  return (
    <div className="page narrow-wide life-page">
      <header className="life-hero">
        <p className="life-eyebrow">ミッション → ビジョン → 90日のプロジェクト＋改善</p>
        <h1 className="page-title">悠三堂はどこへ向かうか</h1>
        <p className="muted">ミッション（なぜ存在するか）から、ビジョン（どこへ行くか）を決め、90日ごとのプロジェクトと改善でやりきります。{owner ? '' : '書き換えられるのは代表だけです。'}</p>
      </header>

      <section className="card vision-card mission-card">
        <div className="card-head">
          <h2 className="card-title"><span className="step-no">1</span>ミッション</h2>
          <SaveBadge state={save.state} />
        </div>
        <textarea
          className="vision-input"
          rows={2}
          value={mission}
          readOnly={!owner}
          aria-label="ミッション"
          placeholder="例: 自然の恵みを、まっすぐ人に届ける。"
          onChange={(e) => {
            setMission(e.target.value);
            save.schedule({ mission: e.target.value });
          }}
        />
      </section>

      <section className="card vision-card">
        <div className="card-head">
          <h2 className="card-title"><span className="step-no">2</span>ビジョン</h2>
          <SaveBadge state={save.state} />
        </div>
        <textarea
          className="vision-input"
          rows={2}
          value={vision}
          readOnly={!owner}
          aria-label="会社のビジョン"
          placeholder="例: 自然茶を、世界20か国の食卓へ。"
          onChange={(e) => {
            setVision(e.target.value);
            save.schedule({ vision: e.target.value });
          }}
        />
      </section>

      <VisionBoard goals={data.goals} owner={owner} onChange={reload} />

      <AnnualKpis owner={owner} />
    </div>
  );
}
