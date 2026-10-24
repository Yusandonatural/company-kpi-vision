/** 画面の言語（この端末だけ）。文言は L('日本語', 'English') のように両方をその場に書く。切り替えたら開き直す */
import { setDateLang } from '../shared/dates';

export type Lang = 'ja' | 'en';
const KEY = 'kpi.lang';

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'ja';
  } catch {
    return 'ja';
  }
}

export const lang: Lang = read();
export const isEn = lang === 'en';

export function applyLang() {
  document.documentElement.lang = lang;
  setDateLang(lang);
}

export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {}
  location.reload();
}

/** 今の言語の文言を返す */
export function L(ja: string, en: string): string {
  return isEn ? en : ja;
}
