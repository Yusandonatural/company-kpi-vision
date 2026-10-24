// 画面のファイル（dist/client）を Worker 本体に埋め込んでデプロイする。
// Cloudflare の静的アセットのアップロードが使えない環境（認証ヘッダーを差し替えるプロキシの内側など）向け。
// 使い方: npm run deploy:inline
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const client = join(root, 'dist/client');
const out = join(root, 'dist/inline');
mkdirSync(out, { recursive: true });

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.ico': 'image/x-icon',
};
const files = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files['/' + relative(client, p)] = { type: TYPES[extname(p)] ?? 'application/octet-stream', b64: readFileSync(p).toString('base64') };
  }
};
walk(client);
writeFileSync(join(out, 'assets.js'), `export default ${JSON.stringify(files)};\n`);

// wrangler.toml から [assets] を外し、入口を埋め込み版に差し替えた設定を作る
const toml = readFileSync(join(root, 'wrangler.toml'), 'utf8')
  .replace(/\n\[assets\][\s\S]*?(?=\n\[)/, '\n')
  .replace(/^main = .*$/m, 'main = "../../src/worker/inline-entry.ts"')
  .replace(/^migrations_dir = .*$/m, 'migrations_dir = "../../migrations"');
writeFileSync(join(out, 'wrangler.toml'), toml);
console.log(`埋め込んだファイル: ${Object.keys(files).length}件`);
execSync(`npx wrangler deploy -c ${join(out, 'wrangler.toml')}`, { stdio: 'inherit', cwd: root });
