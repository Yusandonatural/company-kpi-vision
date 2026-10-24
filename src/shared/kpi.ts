// 会社版: KPI の数値の取り込み元と、遅れの信号

/** 自動で取り込める数値。値は1日ごと（その日の分）に kpi_values へ入れ、累計は合計で出す */
export const KPI_SOURCES: Record<string, { id: string; label: string; unit: string }> = {
  'freee:sales': { id: 'freee:sales', label: 'freee：売上高', unit: '円' },
  'shopify:sales': { id: 'shopify:sales', label: 'Shopify：EC売上', unit: '円' },
};

export type Signal = 'ok' | 'warn' | 'bad' | 'none';

/**
 * 数値目標の信号。経過率（0〜100）と達成率を比べる。
 * ジャーナルと同じく「経過率より20ポイント以上遅れ」で赤、10ポイント以上で黄。
 */
export function kpiSignal(start: number | null, current: number | null, target: number | null, elapsedPct: number): { pct: number | null; signal: Signal } {
  if (target == null || current == null) return { pct: null, signal: 'none' };
  const s = start ?? 0;
  const span = target - s;
  if (span === 0) return { pct: current >= target ? 100 : 0, signal: current >= target ? 'ok' : 'bad' };
  const pct = Math.max(0, Math.min(100, Math.round(((current - s) / span) * 100)));
  const gap = elapsedPct - pct;
  return { pct, signal: pct >= 100 || gap < 10 ? 'ok' : gap < 20 ? 'warn' : 'bad' };
}

/** 年の経過率（その年の1/1〜12/31） */
export function yearElapsedPct(year: number, today: string): number {
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  const t = Date.parse(today + 'T00:00:00Z');
  return Math.max(0, Math.min(100, Math.round(((t - start) / (end - start)) * 100)));
}
