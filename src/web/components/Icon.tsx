// 線のアイコン（24px グリッド、currentColor）。filled は塗りの形（選択中のタブ・いいね済み）
const PATHS: Record<string, { line: string; fill?: string }> = {
  home: { line: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z', fill: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z' },
  today: { line: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4M8.5 14.5l2.2 2.2 4.8-4.8' },
  plus: { line: 'M4 4h16v16H4zM12 8v8M8 12h8' },
  target: { line: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z' },
  user: { line: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0', fill: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0z' },
  week: { line: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4M7 13h2M11 13h2M15 13h2M7 16.5h2M11 16.5h2' },
  month: { line: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4M9 9v11M15 9v11M4 14.5h16' },
  vision: { line: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
  settings: { line: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' },
  heart: { line: 'M12 20.5s-8-4.6-8-10.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.1c0 5.8-8 10.4-8 10.4z', fill: 'M12 20.5s-8-4.6-8-10.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.1c0 5.8-8 10.4-8 10.4z' },
  comment: { line: 'M20 12a8 8 0 0 1-11.8 7l-4.2 1 1.1-3.9A8 8 0 1 1 20 12z' },
  check: { line: 'M5 12.5l4.5 4.5L19 7.5' },
  flag: { line: 'M5 21V4M5 4h11l-2 4 2 4H5' },
  chart: { line: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  book: { line: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7' },
  more: { line: 'M5 12h.01M12 12h.01M19 12h.01' },
  close: { line: 'M6 6l12 12M18 6 6 18' },
  send: { line: 'M21 3 10.5 13.5M21 3l-6.5 18-4-7.5-7.5-4z' },
  org: { line: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M17 11a2.5 2.5 0 1 0 0-5M21 20a5 5 0 0 0-4-4.9' },
};

export function Icon({ name, size = 24, filled = false, className }: { name: keyof typeof PATHS | string; size?: number; filled?: boolean; className?: string }) {
  const p = PATHS[name] ?? PATHS.more;
  return (
    <svg className={`icon ${className ?? ''}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {filled && p.fill ? <path d={p.fill} fill="currentColor" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /> : null}
      <path d={p.line} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
