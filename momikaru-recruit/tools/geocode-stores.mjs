#!/usr/bin/env node
/*
 * 国土地理院 住所検索API で店舗・sub_locations の緯度経度を取得し、data/stores.json の geo に書き込む（SPEC.md §10）
 *   node tools/geocode-stores.mjs            geo が未入力のものだけ取得して書き込む
 *   node tools/geocode-stores.mjs --force    すべて取り直す
 *   node tools/geocode-stores.mjs --dry-run  取得結果を表示するだけ（書き込まない）
 *
 * API: https://msearch.gsi.go.jp/address-search/AddressSearch?q=住所
 * 応答は [{ geometry: { coordinates: [lng, lat] }, properties: { title } }, ...]。先頭の候補を採用する。
 * 番地より後ろ（建物名・階数）は検索に使わない（street の最初の空白以降を除く）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'data/stores.json');
const API = 'https://msearch.gsi.go.jp/address-search/AddressSearch?q=';
const FORCE = process.argv.includes('--force');
const DRY = process.argv.includes('--dry-run');

const doc = JSON.parse(readFileSync(FILE, 'utf8'));
const query = a => [a.region, a.locality, String(a.street || '').trim().split(/\s+/)[0]].filter(Boolean).join('');
const hasGeo = g => g && typeof g.lat === 'number' && typeof g.lng === 'number';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const targets = [];
for (const s of doc.stores) {
  targets.push({ label: s.store_name, obj: s });
  for (const sub of s.sub_locations || []) targets.push({ label: sub.name, obj: sub });
}

let failed = 0;
for (const t of targets) {
  if (hasGeo(t.obj.geo) && !FORCE) { console.log(`skip  ${t.label}（geo 入力済み）`); continue; }
  const q = query(t.obj.address);
  const res = await fetch(API + encodeURIComponent(q));
  const list = res.ok ? await res.json() : [];
  const hit = list[0];
  if (!hit) { console.error(`NG    ${t.label}  q=${q}  候補なし`); failed++; continue; }
  const [lng, lat] = hit.geometry.coordinates;
  console.log(`OK    ${t.label}  q=${q}  → ${hit.properties.title}  lat=${lat} lng=${lng}  （候補${list.length}件）`);
  t.obj.geo = { lat, lng };
  await sleep(300);
}

if (!DRY) {
  writeFileSync(FILE, JSON.stringify(doc, null, 2) + '\n');
  console.log('data/stores.json を更新しました');
}
process.exit(failed ? 1 : 0);
