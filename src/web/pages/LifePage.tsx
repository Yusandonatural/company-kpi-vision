import { useState } from 'react';
import { put } from '../api';
import { ErrorBox, Loading, SaveBadge } from '../components/ui';
import { useApi, useAutosave } from '../hooks';
import { L } from '../i18n';
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
        <p className="life-eyebrow">{L('ミッション → ビジョン → 90日のプロジェクト＋改善', 'Mission → Vision → 90-day projects + Kaizen')}</p>
        <h1 className="page-title">{L('悠三堂はどこへ向かうか', 'Where Yusando is heading')}</h1>
        <p className="muted">
          {L('ミッション（なぜ存在するか）から、ビジョン（どこへ行くか）を決め、90日ごとのプロジェクトと改善でやりきります。', 'From the mission (why we exist) we set the vision (where we are going), then deliver it through 90-day projects and kaizen.')}
          {owner ? '' : L('書き換えられるのは代表だけです。', ' Only the CEO can edit this.')}
        </p>
      </header>

      <section className="card vision-card mission-card">
        <div className="card-head">
          <h2 className="card-title"><span className="step-no">1</span>{L('ミッション', 'Mission')}</h2>
          <SaveBadge state={save.state} />
        </div>
        <textarea
          className="vision-input"
          rows={2}
          value={mission}
          readOnly={!owner}
          aria-label={L('ミッション', 'Mission')}
          placeholder={L('例: 自然の恵みを、まっすぐ人に届ける。', 'e.g. Bring nature’s gifts straight to people.')}
          onChange={(e) => {
            setMission(e.target.value);
            save.schedule({ mission: e.target.value });
          }}
        />
      </section>

      <section className="card vision-card">
        <div className="card-head">
          <h2 className="card-title"><span className="step-no">2</span>{L('ビジョン', 'Vision')}</h2>
          <SaveBadge state={save.state} />
        </div>
        <textarea
          className="vision-input"
          rows={2}
          value={vision}
          readOnly={!owner}
          aria-label={L('会社のビジョン', 'Company vision')}
          placeholder={L('例: 自然茶を、世界20か国の食卓へ。', 'e.g. Natural tea on tables in 20 countries.')}
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
