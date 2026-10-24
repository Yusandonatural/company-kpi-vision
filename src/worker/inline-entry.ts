// 画面のファイルを Worker に埋め込んで配る入口（npm run deploy:inline 用）。
// 普段の入口（index.ts）と同じ API を使い、/api と /auth 以外は埋め込んだファイルを返す。
import worker from './index';
import type { Env } from './env';
// @ts-ignore 生成物（scripts/deploy-inline.mjs が作る）
import files from '../../dist/inline/assets.js';

type File = { type: string; b64: string };
const table = files as Record<string, File>;
const cache = new Map<string, Uint8Array<ArrayBuffer>>();
const bytes = (path: string) => {
  let b = cache.get(path);
  if (!b) {
    b = Uint8Array.from(atob(table[path].b64), (c) => c.charCodeAt(0));
    cache.set(path, b);
  }
  return b;
};

function serve(path: string, status = 200) {
  const f = table[path];
  const immutable = path.startsWith('/assets/');
  return new Response(bytes(path), {
    status,
    headers: { 'content-type': f.type, 'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' },
  });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(req.url);
    const p = url.pathname;
    if (p.startsWith('/api/') || p.startsWith('/auth/')) return worker.fetch(req, env, ctx);
    if (table[p] && p !== '/index.html') return serve(p);
    if (table[`${p}.html`]) return serve(`${p}.html`);
    // 拡張子のあるパスで見つからなければ 404、それ以外は画面（SPA）を返す
    if (/\.[a-z0-9]+$/i.test(p)) return new Response('Not found', { status: 404 });
    return serve('/index.html');
  },
  scheduled: worker.scheduled,
} satisfies ExportedHandler<Env>;
