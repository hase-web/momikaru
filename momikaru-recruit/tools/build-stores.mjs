#!/usr/bin/env node
/*
 * 店舗別ページの静的生成（SPEC.md §4.1）
 *   node tools/build-stores.mjs
 *
 * 入力: data/stores.json（店舗情報の唯一のデータ源）, data/attributes.json（属性LPの表示用メタ）
 * 出力: stores.html（店舗一覧 → /stores）, stores/{store_id}.html（店舗別ページ → /stores/{store_id}）。URL は末尾スラッシュなし（SPEC.md §15）
 *       既存7ページ（index と属性LP）の <link rel="canonical"> の href だけを書き換える
 *       _redirects の自動生成部分（.html 付きURL → 拡張子なしへ 301。SPEC.md §16）
 *       data/stores.js（stores.json と attributes.json を window.MK_DATA として同期読み込みできる形にしたもの）
 * 設定: tools/site.config.json の siteBase（canonical と JobPosting の基準。ここだけで切り替える）
 *
 * 依存パッケージなし。生成物は手で編集しないこと（再生成で上書きされる）。
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// canonical / JobPosting の基準は tools/site.config.json だけで管理する（SPEC.md §10）
const SITE = JSON.parse(readFileSync(join(ROOT, 'tools/site.config.json'), 'utf8'));
const SITE_BASE = String(SITE.siteBase).replace(/\/$/, '');
// 正規URLは末尾スラッシュなしに統一（SPEC.md §15）。フェイスだけはディレクトリの入口なので {base}/（例：https://www.momikaru.com/recruit/）
const ROOT_PAGES = ['index', 'osteo', 'mom', 'relax', 'esthe', 'side-job', 'owner'];
const pageUrl = page => page === 'index' ? `${SITE_BASE}/` : `${SITE_BASE}/${page}`;
const storeUrl = id => `${SITE_BASE}/stores/${id}`;
const storesUrl = `${SITE_BASE}/stores`;
// 予約ウィジェット（既存LPと同じもの・同じ版）
const BOOKING = 'https://interview-booking-api.netlify.app/widget';
const BOOKING_VER = '7';
// 正規の求人用連絡先（SPEC.md D3）。店舗ページは各店舗の apply_to を優先する
const CONTACT = { line: 'https://lin.ee/XzuQHup', tel: '080-4152-5665' };
// 電話の受付時間（既存LPの表記と同じ。SPEC.md §13）
const TEL_HOURS = '平日 10:00〜18:00';

const storesDoc = JSON.parse(readFileSync(join(ROOT, 'data/stores.json'), 'utf8'));
const attrsDoc = JSON.parse(readFileSync(join(ROOT, 'data/attributes.json'), 'utf8'));
const stores = storesDoc.stores;
const ATTRS = attrsDoc.attributes;
const ORDER = attrsDoc.order;

// ---------- helpers ----------
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// "TODO"・空文字・null は未入力扱い（SPEC.md D1）
const has = v => v != null && String(v).trim() !== '' && String(v).trim().toUpperCase() !== 'TODO';
const telHref = t => 'tel:' + String(t).replace(/[^0-9+]/g, '');
const addrText = a => a ? (has(a.postal_code) ? '〒' + a.postal_code + ' ' : '') + addrPlain(a) : '';
const addrPlain = a => a ? [a.region, a.locality, a.street].filter(has).join('') : '';
const mapUrl = a => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addrPlain(a));
const onAttrs = s => ORDER.filter(k => s.attributes && s.attributes[k] === true);
// 属性の特徴。{ text, benefit } の要素は、その店舗の benefits[benefit] が true のときだけ出す（SPEC.md §12）
const pointsFor = (s, a) => a.points.filter(p => typeof p === 'string' || s.benefits?.[p.benefit] === true).map(p => typeof p === 'string' ? p : p.text);
const jsonLd = obj => '<script type="application/ld+json">' + JSON.stringify(obj, null, 2).replace(/</g, '\\u003c') + '</script>';
const contactOf = s => ({ line: (s && has(s.apply_to?.line)) ? s.apply_to.line : CONTACT.line, tel: (s && has(s.apply_to?.tel)) ? s.apply_to.tel : CONTACT.tel });

function postalAddress(a) {
  const o = { '@type': 'PostalAddress', addressCountry: 'JP' };
  if (has(a.postal_code)) o.postalCode = a.postal_code;
  if (has(a.region)) o.addressRegion = a.region;
  if (has(a.locality)) o.addressLocality = a.locality;
  if (has(a.street)) o.streetAddress = a.street;
  return o;
}

// 近隣の募集中店舗（いずれかの属性が true）：store-context.js と同じ基準（30km 以内、近い順、最大3件。SPEC.md §10・§16）
const NEAR_KM = 30, NEAR_MAX = 3;
function distKm(a, b) {
  const R = 6371, rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const nearbyRecruiting = s => stores
  .filter(x => x.store_id !== s.store_id && onAttrs(x).length)
  .map(x => ({ x, d: distKm(s.geo, x.geo) })).filter(o => o.d <= NEAR_KM)
  .sort((a, b) => a.d - b.d).slice(0, NEAR_MAX).map(o => o.x);

// JobPosting：1ページ1件（SPEC.md §15）。募集中の属性は description 本文に含める。
// 雇用形態は CONTRACTOR、勤務地は sub_locations を含める。baseSalary は出さない（D6）
const shortStoreName = s => String(s.store_name).replace(/^もみかる\s*/, '');
function jobPosting(s) {
  const locs = [{ name: s.store_name, address: s.address, geo: s.geo }, ...(s.sub_locations || [])];
  const on = onAttrs(s);
  const desc = [
    `<p>${esc(s.store_name)}で、業務委託のセラピストを募集しています。</p>`,
    `<p>募集中の働き方：${on.map(k => esc(ATTRS[k].short)).join('、')}</p>`,
    ...on.map(k => {
      const a = ATTRS[k];
      return `<h3>${esc(a.title)}</h3><p>${esc(a.tagline)}</p><ul>` + pointsFor(s, a).map(p => `<li>${esc(p)}</li>`).join('') + '</ul>';
    }),
    `<p>契約形態：${esc(s.contract_type)}。${has(s.shift) ? esc(s.shift) + '。' : ''}</p>`,
    '<p>勤務地：' + locs.map(l => `${esc(l.name)}（${esc(addrPlain(l.address))}）`).join('、') + '</p>',
  ].join('');
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: `セラピスト（業務委託）｜もみかる ${shortStoreName(s)}`,
    description: desc,
    identifier: { '@type': 'PropertyValue', name: s.operator.company_name, value: s.store_id },
    datePosted: s.updated_at,
    employmentType: 'CONTRACTOR',
    hiringOrganization: { '@type': 'Organization', name: s.operator.company_name, sameAs: s.operator.company_url, logo: `${SITE_BASE}/assets/logo-momikaru.png` },
    jobLocation: locs.map(l => ({ '@type': 'Place', name: l.name, address: postalAddress(l.address), ...(l.geo ? { geo: { '@type': 'GeoCoordinates', latitude: l.geo.lat, longitude: l.geo.lng } } : {}) })),
    directApply: false,
    url: storeUrl(s.store_id),
  };
}

// Google 求人構造化データの必須項目（title, description, datePosted, hiringOrganization, jobLocation）の不足と、
// 推奨項目のうち未設定のものを返す
function checkJobPosting(j) {
  const req = [];
  if (!has(j.title)) req.push('title');
  if (!has(j.description)) req.push('description');
  if (!/^\d{4}-\d{2}-\d{2}/.test(j.datePosted || '')) req.push('datePosted');
  if (!has(j.hiringOrganization?.name)) req.push('hiringOrganization.name');
  if (!Array.isArray(j.jobLocation) || !j.jobLocation.length || j.jobLocation.some(l => !has(l.address?.addressCountry) || !has(l.address?.addressRegion) || !has(l.address?.addressLocality))) req.push('jobLocation.address');
  const rec = [];
  if (!j.validThrough) rec.push('validThrough');
  if (!j.baseSalary) rec.push('baseSalary（D6 で非表示）');
  j.jobLocation.forEach(l => { if (!l.address.postalCode) rec.push(`postalCode（${l.name}）`); if (!l.address.streetAddress) rec.push(`streetAddress（${l.name}）`); });
  return { req, rec };
}

// ---------- 共通パーツ ----------
const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#FFFFFF;color:#1A1A2E;font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN",system-ui,sans-serif;-webkit-font-smoothing:antialiased;font-feature-settings:"palt"}
a{color:#1A1A2E;text-decoration:none}
button{font-family:inherit}
:focus-visible{outline:2px solid #F5B800;outline-offset:2px}
.page{min-height:100vh;display:flex;flex-direction:column;container-type:inline-size}
.wrap{max-width:1160px;margin:0 auto;padding-left:16px;padding-right:16px;width:100%}
.hd{position:sticky;top:0;z-index:50;background:rgba(255,255,255,0.92);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid rgba(26,26,46,0.08)}
.hd-in{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:10px;padding-bottom:10px}
.brand{display:flex;align-items:center;gap:10px;min-width:0}
.brand img{height:28px;width:auto;display:block}
.brand .sep{width:1px;height:22px;background:rgba(26,26,46,0.15)}
.brand .lbl{display:flex;flex-direction:column;line-height:1.25;min-width:0}
.brand .en{font-family:Inter,sans-serif;font-weight:700;font-size:9px;letter-spacing:0.22em;color:#A87A00}
.brand .ja{font-size:10px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hd-act{display:flex;align-items:center;gap:8px}
.pill{display:flex;align-items:center;justify-content:center;gap:7px;height:40px;padding:0 14px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap;flex:none}
.pill.line{background:#1A1A2E;color:#FFFFFF}
.pill.line:hover{background:#2C3E50}
.pill.tel{border:1px solid rgba(26,26,46,0.15)}
.pill.tel:hover{border-color:#1A1A2E}
.dot{width:7px;height:7px;border-radius:50%;background:#06C755;display:inline-block}
.eyebrow{display:flex;align-items:center;gap:10px}
.eyebrow i{width:20px;height:2px;background:#F5B800;display:block}
.eyebrow span{font-family:"Roboto Mono",monospace;font-weight:700;font-size:10px;letter-spacing:0.2em;color:#6B6B6B}
h1,h2,h3{margin:0}
.hero{background-color:#F8F8F5;background-image:radial-gradient(rgba(26,26,46,0.07) 1px,transparent 1.2px);background-size:18px 18px;border-bottom:1px solid rgba(26,26,46,0.08)}
.hero-in{padding-top:32px;padding-bottom:44px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:28px 56px;align-items:start}
.hero h1{font-family:"Noto Serif JP",serif;font-weight:700;font-size:clamp(28px,7.4cqi,44px);line-height:1.4}
.hero .sub{font-size:15px;font-weight:700;color:#4A4A5E;margin:0}
.hero-l{display:flex;flex-direction:column;gap:16px}
.badges{display:flex;flex-wrap:wrap;gap:6px}
.badge{font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;background:#FFFFFF;border:1px solid rgba(26,26,46,0.12)}
.badge.y{background:#F5B800;border-color:#F5B800}
.info{margin:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px 16px;font-size:14px;line-height:1.7;background:#FFFFFF;border:1px solid rgba(26,26,46,0.1);border-radius:12px;padding:18px}
.info dt{font-size:12px;font-weight:700;color:#6B6B6B;padding-top:2px;white-space:nowrap}
.info dd{margin:0}
.info a{text-decoration:underline;text-underline-offset:3px}
.cta{display:flex;align-items:center;justify-content:center;gap:10px;min-height:56px;padding:0 24px;border:none;border-radius:999px;background:#F5B800;color:#1A1A2E;font-size:15px;font-weight:700;cursor:pointer;width:100%;max-width:420px}
.cta:hover{background:#FFC933}
.cta.dark{background:#1A1A2E;color:#FFFFFF}
.cta.dark:hover{background:#2C3E50}
.cta.ghost{background:transparent;border:1.5px solid rgba(26,26,46,0.2);color:#1A1A2E;min-height:48px;font-size:14px}
.cta.ghost:hover{border-color:#1A1A2E}
.gallery{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(240px,1fr);gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;border-radius:12px}
.gallery img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;display:block;scroll-snap-align:start;background:#EEE}
.sec{padding-top:56px;padding-bottom:56px;display:flex;flex-direction:column;gap:24px}
.sec h2{font-size:clamp(22px,6cqi,30px);font-weight:700;line-height:1.5}
.lead{margin:0;font-size:14px;line-height:1.85;color:#4A4A5E}
.locs{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:8px}
.loc{padding:16px;border:1.5px solid rgba(26,26,46,0.12);border-radius:12px;display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:1.7}
.loc b{font-size:15px}
.loc a{text-decoration:underline;text-underline-offset:3px;color:#4A4A5E}
.paths{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:12px}
.path{display:flex;flex-direction:column;gap:12px;padding:20px;background:#FFFFFF;border:1.5px solid rgba(26,26,46,0.12);border-radius:16px;box-shadow:0 1px 3px rgba(26,26,46,0.06)}
.path .no{font-family:"Roboto Mono",monospace;font-weight:700;font-size:10px;letter-spacing:0.08em;color:#6B6B6B}
.path h3{font-size:18px;font-weight:700;line-height:1.5}
.path .tg{margin:0;font-size:13px;line-height:1.8;color:#4A4A5E}
.path ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:1.6}
.path li{display:flex;gap:8px}
.path li::before{content:"✓";color:#A87A00;font-weight:700}
.path .acts{display:flex;flex-direction:column;gap:8px;margin-top:auto}
.path .acts .cta{max-width:none;min-height:48px;font-size:14px}
.note{padding:18px;border-left:3px solid #F5B800;background:#F8F8F5;border-radius:0 12px 12px 0;font-size:13px;line-height:1.85;color:#4A4A5E}
.alt{background:#F8F8F5;border-top:1px solid rgba(26,26,46,0.08)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:8px}
.card{display:grid;grid-template-columns:minmax(0,1fr) 34px;gap:12px;align-items:center;padding:16px;background:#FFFFFF;border:1.5px solid rgba(26,26,46,0.12);border-radius:12px;box-shadow:0 1px 3px rgba(26,26,46,0.06);transition:transform .25s,box-shadow .25s}
.card:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(26,26,46,0.1)}
.card .t{font-size:16px;font-weight:700;line-height:1.5}
.card .s{font-size:12px;line-height:1.7;color:#4A4A5E}
.card .a{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.card .a span{font-size:10px;font-weight:700;padding:1px 8px;border-radius:999px;background:#F2F2EE;color:#4A4A5E}
.arrow{width:34px;height:34px;border-radius:50%;background:#1A1A2E;color:#F5B800;display:flex;align-items:center;justify-content:center;font-size:13px}
.dark{background-color:#1A1A2E;background-image:radial-gradient(rgba(255,255,255,0.06) 1px,transparent 1.2px);background-size:18px 18px;color:#FFFFFF}
.dark-in{max-width:720px;margin:0 auto;padding:64px 16px 72px;display:flex;flex-direction:column;gap:20px;text-align:center;align-items:center}
.dark h2{font-size:clamp(22px,6cqi,30px);font-weight:700;line-height:1.55}
.dark p{margin:0;font-size:14px;line-height:1.95;color:rgba(255,255,255,0.8)}
.dark .btns{display:flex;flex-direction:column;gap:10px;width:100%;max-width:420px}
.dark .ln{display:flex;align-items:center;justify-content:center;gap:8px;min-height:50px;border:1.5px solid rgba(255,255,255,0.3);border-radius:999px;font-size:14px;font-weight:700;color:#FFFFFF}
.dark .ln:hover{border-color:#FFFFFF}
.dark .tl{display:flex;align-items:center;justify-content:center;gap:8px;padding:8px;font-size:13px;color:rgba(255,255,255,0.85)}
.dark .tl:hover{color:#F5B800}
.ft{background:#FFFFFF;border-top:1px solid rgba(26,26,46,0.08)}
.ft-in{padding-top:24px;padding-bottom:32px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.ft img{height:24px;width:auto;display:block}
.ft span{font-size:11px;color:#6B6B6B}
.ft a{font-size:12px;color:#4A4A5E;text-decoration:underline;text-underline-offset:3px}
.sticky{position:sticky;bottom:0;z-index:40;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,0.94);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-top:1px solid rgba(26,26,46,0.08)}
.sticky-in{max-width:560px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
.sticky button{min-height:48px;background:#F5B800;color:#1A1A2E;border:none;border-radius:999px;font-size:14px;font-weight:700;cursor:pointer;padding:0 16px}
.sticky a{display:flex;align-items:center;gap:6px;min-height:48px;padding:0 16px;background:#1A1A2E;color:#FFFFFF;border-radius:999px;font-size:13px;font-weight:700}
.crumb{font-size:12px;color:#6B6B6B;display:flex;gap:6px;flex-wrap:wrap}
.crumb a{color:#6B6B6B;text-decoration:underline;text-underline-offset:3px}
@media (prefers-reduced-motion: reduce){*{transition-duration:0.01ms !important;animation:none !important}}
`;

function head({ title, description, canonical, rel, ld = [] }) {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&family=Noto+Serif+JP:wght@600;700&family=Inter:wght@500;700;800&family=Roboto+Mono:wght@500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${BOOKING}/booking.css?v=${BOOKING_VER}">
<script src="${BOOKING}/config.js?v=${BOOKING_VER}"></script>
<script src="${BOOKING}/booking.js?v=${BOOKING_VER}"></script>
<style>${CSS}</style>
${ld.join('\n')}
</head>`;
}

function header(rel, label, c) {
  return `<header class="hd"><div class="wrap hd-in">
  <a class="brand" href="${rel}">
    <img src="${rel}assets/logo-momikaru.png" alt="もみかる">
    <span class="sep"></span>
    <span class="lbl"><span class="en">RECRUIT</span><span class="ja">${esc(label)}</span></span>
  </a>
  <div class="hd-act">
    <a class="pill tel" href="${telHref(c.tel)}" aria-label="電話で相談する ${esc(c.tel)}">電話</a>
    <a class="pill line" href="${esc(c.line)}"><span class="dot"></span>LINE</a>
  </div>
</div></header>`;
}

function footer(rel, company) {
  return `<footer class="ft"><div class="wrap ft-in">
  <img src="${rel}assets/logo-momikaru.png" alt="もみかる">
  <a href="${rel}stores">店舗一覧</a>
  <span>© ${esc(company)}</span>
</div></footer>`;
}

// 応募ボタン：既存LPと同じ widget を開き、jobCategory に属性と store_id を保持する（遷移先は現状維持。widget がなければ LINE）
function bookingScript(line) {
  return `<script>
function mkBook(btn){
  var job = btn.getAttribute('data-job') || '';
  if (window.IVBooking && window.IVBooking.open) window.IVBooking.open({ eventType:'interview_online', jobCategory: job });
  else window.location.href = ${JSON.stringify(line)};
}
</script>`;
}

const bookBtn = (job, text, cls = 'cta') => `<button type="button" class="${cls}" data-job="${esc(job)}" onclick="mkBook(this)">${esc(text)}</button>`;

function closing(c, job) {
  return `<section class="dark"><div class="dark-in">
  <span style="font-family:'Roboto Mono',monospace;font-weight:700;font-size:10px;letter-spacing:0.2em;color:#F5B800">LET'S_TALK</span>
  <h2>迷ったら、話を聞くだけでも。</h2>
  <p>どの働き方が合うか決めきれない方も、お気軽にご相談ください。スマホでのWEB面談も、お店での対面も選べます。</p>
  <div class="btns">
    ${bookBtn(job, '面談の日時を選ぶ（WEB・来店）→')}
    <a class="ln" href="${esc(c.line)}"><span class="dot" style="width:8px;height:8px"></span>LINEで相談する</a>
    <a class="tl" href="${telHref(c.tel)}">電話 <span style="font-family:Inter,sans-serif;font-weight:700">${esc(c.tel)}</span>（${TEL_HOURS}）</a>
  </div>
</div></section>`;
}

function sticky(c, job) {
  return `<div class="sticky"><div class="sticky-in">
  <button type="button" data-job="${esc(job)}" onclick="mkBook(this)">面談を予約（WEB・来店OK）</button>
  <a href="${esc(c.line)}"><span class="dot"></span>LINE</a>
</div></div>`;
}

const storeCard = (s, rel) => {
  const on = onAttrs(s);
  const subs = (s.sub_locations || []).length;
  return `<a class="card" href="${rel}stores/${esc(s.store_id)}"><span style="display:flex;flex-direction:column;gap:2px;min-width:0">
  <span class="t">${esc(s.store_name)}</span>
  <span class="s">${esc([s.address.region, s.address.locality].filter(has).join(' '))}${subs ? `（勤務地 ${subs + 1}か所）` : ''}</span>
  <span class="a">${on.length ? on.map(k => `<span>${esc(ATTRS[k].short)}</span>`).join('') : '<span>現在募集なし</span>'}</span>
</span><span class="arrow">→</span></a>`;
};

// 募集中の働き方（attributes が true の属性ごと）
function positionsSection(s, on, rel, tag, multi) {
  return `<section class="${multi ? 'alt' : ''}"><div class="wrap sec">
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="eyebrow"><i></i><span>OPEN_POSITIONS [${on.length}]</span></div>
    <h2>${esc(s.store_name)}で募集中の働き方</h2>
    <p class="lead">いずれも業務委託契約です。${has(s.shift) ? esc(s.shift) + '。' : ''}</p>
  </div>
  <div class="paths">
${on.map((k, i) => {
  const a = ATTRS[k];
  return `    <article class="path" id="${esc(k)}">
      <span class="no">PATH_${String(i + 1).padStart(2, '0')} — ${esc(a.en)}</span>
      <h3>${esc(a.title)}</h3>
      <p class="tg">${esc(a.tagline)}</p>
      <ul>${pointsFor(s, a).map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      <div class="acts">
        <a class="cta ghost" href="${rel}${esc(a.page)}?store=${esc(s.store_id)}">この働き方を詳しく見る →</a>
        ${bookBtn(`${a.jobCategory}｜${tag}`, 'この働き方で面談を予約', 'cta dark')}
      </div>
    </article>`;
}).join('\n')}
  </div>
  <div class="note">もみかるとは雇用契約ではなく、個人事業主として業務委託契約を結びます。働く日や時間はご自身で決められ、施術した分が報酬になります。確定申告などはじめての方にも、面談で流れをご説明します。</div>
</div></section>`;
}

// 募集なしの店舗：「現在募集を行っていません」＋近隣の募集中店舗（なければ店舗一覧）へ案内（SPEC.md §16）
function closedSection(s, near, rel, multi) {
  return `<section id="nearby" class="${multi ? 'alt' : ''}"><div class="wrap sec">
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="eyebrow"><i></i><span>NOT_RECRUITING</span></div>
    <h2>${esc(s.store_name)}は、現在募集を行っていません</h2>
    <p class="lead">${near.length ? '近くで募集中の店舗をご案内します。' : '近くに募集中の店舗がありません。店舗一覧からお探しください。'}</p>
  </div>
  ${near.length ? `<div class="cards">${near.map(x => storeCard(x, rel)).join('')}</div>` : ''}
  <a class="cta ghost" href="${rel}stores" style="max-width:420px">店舗一覧から探す →</a>
</div></section>`;
}

// ---------- 店舗別ページ ----------
function storePage(s) {
  const rel = '../';  // /stores/{id} から見た相対の基点
  const c = contactOf(s);
  const on = onAttrs(s);
  const open = on.length > 0;  // attributes がすべて false なら募集なし（JobPosting を出さない。SPEC.md §16）
  const tag = open ? `${s.store_name}（store:${s.store_id}）` : '店舗ページから相談';
  const near = open ? [] : nearbyRecruiting(s);
  const locs = [{ name: s.store_name, address: s.address, official_url: s.official_url, main: true }, ...(s.sub_locations || [])];
  const multi = locs.length > 1;
  const others = stores.filter(x => x.store_id !== s.store_id);

  const info = [
    ['所在地', `${esc(addrText(s.address))}<br><a href="${esc(mapUrl(s.address))}" target="_blank" rel="noopener">地図を開く</a>`],
    has(s.access) && ['アクセス', esc(s.access)],
    has(s.business_hours) && ['営業時間', esc(s.business_hours)],
    multi && ['勤務地', locs.map(l => esc(l.name)).join('<br>')],
    ['契約形態', esc(s.contract_type)],
    has(s.shift) && ['稼働日時', esc(s.shift)],
  ].filter(Boolean);

  const photos = (s.photos || []).filter(has);

  return `${head({
    title: open ? `${s.store_name}のセラピスト募集（業務委託）｜もみかる` : `${s.store_name}（現在募集を行っていません）｜もみかる`,
    description: open
      ? `${s.store_name}（${[s.address.region, s.address.locality].filter(has).join('')}）で業務委託のセラピストを募集しています。募集中の働き方：${on.map(k => ATTRS[k].short).join('・')}。${has(s.shift) ? s.shift + '。' : ''}`
      : `${s.store_name}（${[s.address.region, s.address.locality].filter(has).join('')}）は、現在セラピストの募集を行っていません。近くの募集中の店舗をご案内しています。`,
    canonical: storeUrl(s.store_id),
    rel,
    ld: open ? [jsonLd(jobPosting(s))] : [],
  })}
<body>
<div class="page">
${header(rel, s.store_name, c)}

<section class="hero"><div class="wrap hero-in">
  <div class="hero-l">
    <nav class="crumb" aria-label="パンくず"><a href="${rel}">もみかるで働く</a><span>›</span><a href="${rel}stores">店舗一覧</a><span>›</span><span>${esc(s.store_name)}</span></nav>
    <div class="eyebrow"><i></i><span>STORE_${esc(s.store_id.toUpperCase())}</span></div>
    <h1>${esc(s.store_name)}</h1>
    ${open ? `<p class="sub">業務委託のセラピストを募集しています。</p>
    <div class="badges">${on.map(k => `<span class="badge y">${esc(ATTRS[k].short)}</span>`).join('')}<span class="badge">${esc(s.contract_type)}</span></div>
    ${bookBtn(tag, '面談を予約する（WEB・来店OK）')}` : `<p class="sub">現在募集を行っていません。</p>
    <a class="cta" href="#nearby">${near.length ? '近くの募集中の店舗を見る ↓' : 'ほかの店舗を探す ↓'}</a>`}
  </div>
  <div style="display:flex;flex-direction:column;gap:12px">
    ${photos.length ? `<div class="gallery">${photos.map((p, i) => `<img src="${esc(p)}" alt="${esc(s.store_name)}の店内 ${i + 1}" loading="${i ? 'lazy' : 'eager'}" width="640" height="480">`).join('')}</div>` : ''}
    <dl class="info">${info.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
  </div>
</div></section>

${multi ? `<section><div class="wrap sec">
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="eyebrow"><i></i><span>WORK_LOCATIONS [${locs.length}]</span></div>
    <h2>勤務地</h2>
    <p class="lead">${esc(s.store_name)}の募集では、次の${locs.length}か所が勤務地になります。</p>
  </div>
  <div class="locs">${locs.map(l => `<div class="loc"><b>${esc(l.name)}</b><span>${esc(addrText(l.address))}</span><span><a href="${esc(mapUrl(l.address))}" target="_blank" rel="noopener">地図</a>${has(l.official_url) ? ` ／ <a href="${esc(l.official_url)}" target="_blank" rel="noopener">店舗ページ</a>` : ''}</span></div>`).join('')}</div>
</div></section>` : ''}

${open ? positionsSection(s, on, rel, tag, multi) : closedSection(s, near, rel, multi)}

${others.length ? `<section class="alt"><div class="wrap sec">
  <div style="display:flex;flex-direction:column;gap:12px">
    <div class="eyebrow"><i></i><span>OTHER_STORES [${others.length}]</span></div>
    <h2>ほかの店舗</h2>
  </div>
  <div class="cards">${others.map(x => storeCard(x, rel)).join('')}</div>
  ${has(s.official_url) ? `<a href="${esc(s.official_url)}" target="_blank" rel="noopener" style="font-size:13px;font-weight:700;text-decoration:underline;text-underline-offset:3px">${esc(s.store_name)}の店舗ページ（momikaru.com）→</a>` : ''}
</div></section>` : ''}

${closing(c, tag)}
${footer(rel, s.operator.company_name)}
${sticky(c, tag)}
</div>
${bookingScript(c.line)}
</body>
</html>
`;
}

// ---------- 店舗一覧 ----------
function indexPage() {
  const rel = '';  // /stores（ルート直下）から見た相対の基点
  const c = CONTACT;
  const regions = [...new Set(stores.map(s => s.address.region).filter(has))];
  const company = stores[0]?.operator?.company_name || '株式会社ドラミカンパニー';
  return `${head({
    title: '店舗一覧｜もみかるのセラピスト募集（業務委託）',
    description: 'もみかるの店舗ごとに、募集中の働き方と勤務地を確認できます。',
    canonical: storesUrl,
    rel,
  })}
<body>
<div class="page">
${header(rel, '店舗一覧', c)}
<section class="hero"><div class="wrap" style="padding-top:32px;padding-bottom:40px;display:flex;flex-direction:column;gap:14px">
  <nav class="crumb" aria-label="パンくず"><a href="${rel}">もみかるで働く</a><span>›</span><span>店舗一覧</span></nav>
  <div class="eyebrow"><i></i><span>ALL_STORES [${stores.length}]</span></div>
  <h1 style="font-family:'Noto Serif JP',serif;font-weight:700;font-size:clamp(26px,7cqi,40px);line-height:1.4">店舗から探す</h1>
  <p class="lead">店舗ごとに、募集中の働き方と勤務地を確認できます。</p>
</div></section>
${regions.map((r, i) => `<section class="${i % 2 ? 'alt' : ''}"><div class="wrap sec">
  <h2>${esc(r)}</h2>
  <div class="cards">${stores.filter(s => s.address.region === r).map(s => storeCard(s, rel)).join('')}</div>
</div></section>`).join('\n')}
${closing(c, '店舗一覧から相談')}
${footer(rel, company)}
${sticky(c, '店舗一覧から相談')}
</div>
${bookingScript(c.line)}
</body>
</html>
`;
}

// ---------- 検証と書き出し ----------
const errors = [];
const ids = new Set();
for (const s of stores) {
  if (!/^[a-z0-9-]+$/.test(s.store_id || '')) errors.push(`store_id が不正: ${s.store_id}`);
  if (ids.has(s.store_id)) errors.push(`store_id が重複: ${s.store_id}`);
  ids.add(s.store_id);
  for (const k of ORDER) if (typeof s.attributes?.[k] !== 'boolean') errors.push(`${s.store_id}: attributes.${k} が true/false ではない`);
  if (!has(s.updated_at)) errors.push(`${s.store_id}: updated_at が空（JobPosting の datePosted に使う）`);
  for (const k of Object.keys(storesDoc._meta?.benefit_keys || {})) if (typeof s.benefits?.[k] !== 'boolean') errors.push(`${s.store_id}: benefits.${k} が true/false ではない`);
  if (typeof s.geo?.lat !== 'number' || typeof s.geo?.lng !== 'number') errors.push(`${s.store_id}: geo が未入力（近隣判定に必要。node tools/geocode-stores.mjs で取得）`);
}
if (errors.length) { console.error('stores.json の検証エラー:\n  ' + errors.join('\n  ')); process.exit(1); }

const OUT = join(ROOT, 'stores');
// 旧レイアウト（stores/index.html、stores/{id}/index.html）と、stores.json から消えた店舗のファイルを掃除
if (existsSync(OUT)) for (const d of readdirSync(OUT, { withFileTypes: true })) {
  if (d.isDirectory() || d.name === 'index.html' || (d.name.endsWith('.html') && !ids.has(d.name.slice(0, -5)))) rmSync(join(OUT, d.name), { recursive: true });
}
mkdirSync(OUT, { recursive: true });
writeFileSync(join(ROOT, 'stores.html'), indexPage());
const jpProblems = [];
for (const s of stores) {
  writeFileSync(join(OUT, s.store_id + '.html'), storePage(s));
  if (!onAttrs(s).length) {
    console.log(`stores/${s.store_id}.html  募集なし（JobPosting なし）  近隣の募集中: ${nearbyRecruiting(s).map(x => x.store_id).join(', ') || 'なし → 店舗一覧'}`);
    continue;
  }
  const { req, rec } = checkJobPosting(jobPosting(s));
  if (req.length) jpProblems.push(`${s.store_id}: 必須項目の不足 ${req.join(', ')}`);
  console.log(`stores/${s.store_id}.html  属性: ${onAttrs(s).join(', ')}  JobPosting: 1件  必須: ${req.length ? 'NG ' + req.join(',') : 'OK'}  推奨の未設定: ${rec.join(', ') || 'なし'}`);
}
console.log(`stores.html  ${stores.length}店舗`);
if (jpProblems.length) { console.error('JobPosting の検証エラー:\n  ' + jpProblems.join('\n  ')); process.exit(1); }

// 各ページが <head> で同期読み込みする店舗データ（SPEC.md §13）。中身は stores.json / attributes.json と同じ
writeFileSync(join(ROOT, 'data/stores.js'),
  '/* GENERATED by tools/build-stores.mjs from data/stores.json + data/attributes.json — 手で編集しない（再生成で上書き） */\n' +
  'window.MK_DATA = ' + JSON.stringify({ stores, attributes: { order: ORDER, attributes: ATTRS } }) + ';\n');
console.log('data/stores.js');

// 既存7ページの canonical を site.config.json に合わせる（href 以外は触らない）
for (const page of ROOT_PAGES) {
  const file = join(ROOT, page + '.html');
  const src = readFileSync(file, 'utf8');
  const re = /<link rel="canonical" href="[^"]*">/;
  if (!re.test(src)) { console.error(`${page}.html に canonical がありません`); process.exit(1); }
  const out = src.replace(re, `<link rel="canonical" href="${esc(pageUrl(page))}">`);
  if (out !== src) writeFileSync(file, out);
  console.log(`${page}.html  canonical: ${pageUrl(page)}${out !== src ? '（更新）' : ''}`);
}

// _redirects：.html 付きURLを拡張子なしへ 301（SPEC.md §16）。マーカーの間だけを書き換え、手書きのルール（404 など）は残す
{
  const BEGIN = '# BEGIN generated by tools/build-stores.mjs（手で編集しない）';
  const END = '# END generated by tools/build-stores.mjs';
  const rules = [
    ['/index.html', '/'],
    ...ROOT_PAGES.filter(p => p !== 'index').map(p => [`/${p}.html`, `/${p}`]),
    ['/stores.html', '/stores'],
    ...stores.map(s => [`/stores/${s.store_id}.html`, `/stores/${s.store_id}`]),
  ];
  const w = Math.max(...rules.map(r => r[0].length)) + 2;
  const block = [BEGIN, '# .html 付きURL → 拡張子なしURLへ 301（ファイルが存在しても転送するため 301!）', ...rules.map(([f, t]) => f.padEnd(w) + t.padEnd(w) + '301!'), END].join('\n');
  const file = join(ROOT, '_redirects');
  const cur = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const re = new RegExp(BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const next = re.test(cur) ? cur.replace(re, block) : cur.replace(/\s*$/, '\n\n') + block + '\n';
  if (next !== cur) writeFileSync(file, next);
  console.log(`_redirects  .html → 拡張子なし ${rules.length}件`);
}
