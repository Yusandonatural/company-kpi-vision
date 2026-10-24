import { useState } from 'react';

const HUES = [12, 32, 150, 200, 225, 265, 310, 345];

/** 名前（またはメール）から色を決める。写真がなければ頭文字 */
export function Avatar({ name, email, src, size = 40, ring }: { name?: string | null; email?: string | null; src?: string | null; size?: number; ring?: 'story' | 'seen' | 'done' | null }) {
  const [broken, setBroken] = useState(false);
  const label = (name || email || '?').trim();
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  const hue = HUES[h % HUES.length];
  const inner = !src || broken ? (
    <span className="avatar-initial" style={{ background: `hsl(${hue} 55% 46%)`, fontSize: size * 0.42 }} aria-hidden="true">
      {[...label][0]?.toUpperCase()}
    </span>
  ) : (
    <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
  );
  return (
    <span className={`avatar ${ring ? `ring ring-${ring}` : ''}`} style={{ width: size, height: size }} title={label}>
      <span className="avatar-in">{inner}</span>
    </span>
  );
}

/** 進み具合の円（ストーリーズの輪の代わり。0〜100） */
export function RingProgress({ pct, size = 66, tone = 'ok', stroke = 3.5, children }: { pct: number | null; size?: number; tone?: string; stroke?: number; children?: React.ReactNode }) {
  const r = size / 2 - stroke / 2 - 1;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <span className={`ringp tone-${tone}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ringp-track" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} className="ringp-bar" strokeWidth={stroke} strokeDasharray={`${(c * v) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className="ringp-in">{children}</span>
    </span>
  );
}

export function timeAgo(iso: string) {
  const t = Date.parse(iso.endsWith('Z') || iso.includes('+') ? iso : iso.replace(' ', 'T') + 'Z');
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'たった今';
  if (s < 3600) return `${Math.floor(s / 60)}分前`;
  if (s < 86400) return `${Math.floor(s / 3600)}時間前`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}日前`;
  const d = new Date(t);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
