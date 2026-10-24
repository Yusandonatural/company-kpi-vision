import { describe, expect, it } from 'vitest';
import { kpiSignal, yearElapsedPct } from './kpi';

describe('kpiSignal', () => {
  it('経過率に追いついていれば ok', () => {
    expect(kpiSignal(0, 50, 100, 55)).toEqual({ pct: 50, signal: 'ok' });
  });
  it('10ポイント以上の遅れは warn、20ポイント以上は bad', () => {
    expect(kpiSignal(0, 40, 100, 55).signal).toBe('warn');
    expect(kpiSignal(0, 30, 100, 55).signal).toBe('bad');
  });
  it('達成していれば経過率に関係なく ok', () => {
    expect(kpiSignal(0, 120, 100, 10)).toEqual({ pct: 100, signal: 'ok' });
  });
  it('目標か現在値がなければ none', () => {
    expect(kpiSignal(0, null, 100, 50).signal).toBe('none');
  });
  it('小さいほど良い目標（開始 > 目標）も扱える', () => {
    expect(kpiSignal(40, 35, 30, 50)).toEqual({ pct: 50, signal: 'ok' });
  });
});

describe('yearElapsedPct', () => {
  it('年の途中の経過率', () => {
    expect(yearElapsedPct(2026, '2026-01-01')).toBe(0);
    expect(yearElapsedPct(2026, '2026-07-02')).toBe(50);
  });
});
