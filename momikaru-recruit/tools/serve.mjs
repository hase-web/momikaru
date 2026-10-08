#!/usr/bin/env node
/*
 * ローカル確認用の簡易サーバー（SPEC.md §4.7）
 *   node tools/serve.mjs [port]   → http://localhost:8080/
 *
 * Netlify の Pretty URLs を再現する：/osteo → osteo.html、/stores/x/ → stores/x/index.html
 * _headers の X-Robots-Tag も付ける。_redirects の 404 ルール（例：/tools/*  /404.html  404!）も再現する。
 * 存在しないパスは Netlify と同じく 404.html を返す。_headers・_redirects 自体は配信しない（Netlify と同じ）。
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8',
};

// _redirects のうち 404 を返すルールだけを読む（このサイトで使うのはそれだけ）
async function load404Rules() {
  let txt = '';
  try { txt = await readFile(join(ROOT, '_redirects'), 'utf8'); } catch { return []; }
  return txt.split('\n').map(l => l.replace(/#.*/, '').trim()).filter(Boolean)
    .map(l => l.split(/\s+/)).filter(([, , st]) => st && st.startsWith('404'))
    .map(([from, to]) => ({ to, test: from.endsWith('/*') ? p => p.startsWith(from.slice(0, -1)) : p => p === from }));
}

async function isFile(p) { try { return (await stat(p)).isFile(); } catch { return false; } }

async function resolve(pathname) {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  const abs = join(ROOT, rel);
  if (abs !== ROOT && !abs.startsWith(ROOT + sep)) return null;
  const candidates = pathname.endsWith('/') ? [join(abs, 'index.html')] : [abs, abs + '.html', join(abs, 'index.html')];
  for (const c of candidates) if (await isFile(c)) return c;
  return null;
}

async function send404(res, to = '/404.html') {
  const f = join(ROOT, to);
  const body = (await isFile(f)) ? await readFile(f) : '404 Not Found';
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' });
  res.end(body);
}

createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const rule = (await load404Rules()).find(r => r.test(decodeURIComponent(u.pathname)));
  if (rule || /^\/_(headers|redirects)$/.test(u.pathname)) { await send404(res, rule?.to); console.log(req.method, u.pathname, '→ 404（_redirects）'); return; }
  // ディレクトリに末尾スラッシュなしで来たらリダイレクト（相対パスを正しく解決させるため）
  if (!u.pathname.endsWith('/') && !extname(u.pathname) && !(await isFile(join(ROOT, u.pathname + '.html'))) && (await isFile(join(ROOT, u.pathname, 'index.html')))) {
    res.writeHead(301, { Location: u.pathname + '/' + u.search }); res.end(); return;
  }
  const file = await resolve(u.pathname);
  if (!file) { await send404(res); return; }
  const body = await readFile(file);
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-cache' });
  res.end(body);
  console.log(req.method, u.pathname + u.search, '→', file.slice(ROOT.length + 1));
}).listen(PORT, () => console.log(`momikaru-recruit: http://localhost:${PORT}/`));
