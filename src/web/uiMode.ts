/** 画面の形。sns = タイムライン中心（Instagram / Facebook 風）、classic = ジャーナルの形（今日・週間・月間・3ヶ月のタブ） */
export type UiMode = 'sns' | 'classic';
const KEY = 'kpi.ui';

export function getUiMode(): UiMode {
  try {
    return localStorage.getItem(KEY) === 'classic' ? 'classic' : 'sns';
  } catch {
    return 'sns';
  }
}

export function applyUiMode(mode: UiMode = getUiMode()) {
  if (mode === 'classic') document.documentElement.dataset.ui = 'classic';
  else delete document.documentElement.dataset.ui;
}

/** 端末ごとに覚える。切り替えたら最初の画面から開き直す */
export function setUiMode(mode: UiMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {}
  applyUiMode(mode);
}

export const homePath = () => (getUiMode() === 'classic' ? '/today' : '/home');
