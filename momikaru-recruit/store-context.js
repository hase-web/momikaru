/*
 * store-context.js — 店舗軸の差し込み（SPEC.md §4）
 *
 * 読み込み側の指定（<head> 内、support.js より前に同期で読み込む。SPEC.md §13）:
 *   <script src="./data/stores.js"></script>
 *   <script src="./store-context.js" data-attr="osteo"></script>  属性LP（?store={store_id} で店舗条件を表示）
 *   <script src="./store-context.js" data-mode="search"></script> フェイス（#store-search-mount に店舗検索を描画）
 *
 * 店舗情報の元データは data/stores.json。data/stores.js は build-stores.mjs が生成する同じ内容の JS（window.MK_DATA）。
 * React の初回描画より前に店舗・制度（window.MK_BENEFITS）を確定させ、表示のずれ（レイアウトシフト）を防ぐ。
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;
  var BASE = new URL(".", script.src);
  var ATTR = script.getAttribute("data-attr");
  var MODE = script.getAttribute("data-mode") || (ATTR ? "lp" : "");
  var NEAR_KM = 30;
  var NEAR_MAX = 3;

  function url(path) { return new URL(path, BASE).href; }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // 店舗データ（data/stores.js が同期で設定済み）
  var D = window.MK_DATA ? { stores: window.MK_DATA.stores || [], attrs: window.MK_DATA.attributes } : null;
  if (!D) { console.warn("[store-context] window.MK_DATA がありません（data/stores.js の読み込み漏れ）"); return; }

  // <head> 実行時はまだ body がない。body が作られた瞬間（中身のパース前）に fn を実行する
  function whenBody(fn) {
    if (document.body) { fn(); return; }
    var mo = new MutationObserver(function () { if (document.body) { mo.disconnect(); fn(); } });
    mo.observe(document.documentElement, { childList: true });
  }
  function storeUrl(id) { return url("stores/" + encodeURIComponent(id) + "/"); }
  function lpUrl(attrKey, id) { return url(attrKey + (id ? "?store=" + encodeURIComponent(id) : "")); }
  function locText(a) { return a ? [a.region, a.locality].filter(Boolean).join(" ") : ""; }

  function distKm(a, b) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function hasGeo(s) { return s.geo && typeof s.geo.lat === "number" && typeof s.geo.lng === "number"; }

  // 同じ属性を募集中の近隣店舗：NEAR_KM 以内を近い順に最大 NEAR_MAX 件（距離ベース。SPEC.md §10）
  // geo が未入力の店舗は判定できないため候補に含めない（build-stores.mjs の検証で geo を必須にしている）
  function nearbyStores(stores, base, attrKey) {
    if (!hasGeo(base)) return [];
    return stores
      .filter(function (s) { return s.store_id !== base.store_id && s.attributes && s.attributes[attrKey] === true && hasGeo(s); })
      .map(function (s) { return { s: s, d: distKm(base.geo, s.geo) }; })
      .filter(function (x) { return x.d <= NEAR_KM; })
      .sort(function (a, b) { return a.d - b.d; })
      .slice(0, NEAR_MAX)
      .map(function (x) { return x.s; });
  }

  var CSS = [
    ".mk-store{font-family:'Noto Sans JP','Hiragino Kaku Gothic ProN',system-ui,sans-serif;-webkit-font-smoothing:antialiased;font-feature-settings:'palt';color:#1A1A2E;box-sizing:border-box}",
    ".mk-store *{box-sizing:border-box}",
    ".mk-store a{text-decoration:none}",
    ".mk-bar{background:#1A1A2E;color:#FFFFFF}",
    ".mk-bar-in{max-width:1160px;margin:0 auto;padding:10px 16px;display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;font-size:12px;line-height:1.6}",
    ".mk-tag{font-family:Inter,'Roboto Mono',sans-serif;font-weight:700;font-size:9px;letter-spacing:0.22em;color:#F5B800}",
    ".mk-name{font-weight:700;font-size:13px}",
    ".mk-sub{color:rgba(255,255,255,0.72)}",
    ".mk-links{margin-left:auto;display:flex;gap:12px}",
    ".mk-links a{color:#FFFFFF;text-decoration:underline;text-underline-offset:3px;white-space:nowrap}",
    ".mk-links a:hover{color:#F5B800}",
    ".mk-off{background:#FFF8DC;border-bottom:1px solid rgba(26,26,46,0.12)}",
    ".mk-off-in{max-width:1160px;margin:0 auto;padding:8px 12px;display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;font-size:12px;line-height:1.4}",
    ".mk-off-msg{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700}",
    ".mk-off-in .mk-chips{flex:none;flex-wrap:nowrap;gap:6px;align-items:center}",
    ".mk-off-in .mk-chip{min-height:32px;padding:0 12px;font-size:12px;white-space:nowrap}",
    ".mk-off-in .mk-list{font-size:12px;color:#4A4A5E;text-decoration:underline !important;text-underline-offset:3px;white-space:nowrap}",
    ".mk-chips{display:flex;flex-wrap:wrap;gap:8px}",
    ".mk-chip{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 16px;border-radius:999px;background:#1A1A2E;color:#FFFFFF !important;font-size:13px;font-weight:700}",
    ".mk-chip:hover{background:#2C3E50}",
    ".mk-chip.ghost{background:#FFFFFF;color:#1A1A2E !important;border:1.5px solid rgba(26,26,46,0.2)}",
    ".mk-sec{background:#FFFFFF;border-top:1px solid rgba(26,26,46,0.08)}",
    ".mk-sec-in{max-width:1160px;margin:0 auto;padding:56px 16px;display:flex;flex-direction:column;gap:20px}",
    ".mk-eyebrow{display:flex;align-items:center;gap:10px}",
    ".mk-eyebrow i{width:20px;height:2px;background:#F5B800;display:block}",
    ".mk-eyebrow span{font-family:'Roboto Mono',monospace;font-weight:700;font-size:10px;letter-spacing:0.2em;color:#6B6B6B}",
    ".mk-h2{margin:0;font-size:clamp(22px,6cqi,30px);font-weight:700;line-height:1.5}",
    ".mk-lead{margin:0;font-size:14px;line-height:1.85;color:#4A4A5E}",
    ".mk-form{display:flex;flex-direction:column;gap:10px}",
    ".mk-input{width:100%;min-height:48px;padding:0 16px;border:1.5px solid rgba(26,26,46,0.15);border-radius:12px;font-size:16px;font-family:inherit;background:#FFFFFF;color:#1A1A2E}",
    ".mk-input:focus{outline:2px solid #F5B800;outline-offset:1px;border-color:#F5B800}",
    ".mk-filter{display:flex;flex-wrap:wrap;gap:6px}",
    ".mk-filter button{min-height:36px;padding:0 14px;border-radius:999px;border:1.5px solid rgba(26,26,46,0.15);background:#FFFFFF;color:#1A1A2E;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer}",
    ".mk-filter button[aria-pressed=true]{background:#F5B800;border-color:#F5B800}",
    ".mk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:8px}",
    ".mk-card{display:grid;grid-template-columns:minmax(0,1fr) 34px;gap:12px;align-items:center;padding:16px;background:#FFFFFF;border:1.5px solid rgba(26,26,46,0.12);border-radius:12px;box-shadow:0 1px 3px rgba(26,26,46,0.06);color:#1A1A2E !important;transition:transform .25s,box-shadow .25s}",
    ".mk-card:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(26,26,46,0.1)}",
    ".mk-card-t{font-size:16px;font-weight:700;line-height:1.5}",
    ".mk-card-s{font-size:12px;line-height:1.7;color:#4A4A5E}",
    ".mk-card-a{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}",
    ".mk-card-a span{font-size:10px;font-weight:700;padding:1px 8px;border-radius:999px;background:#F2F2EE;color:#4A4A5E}",
    ".mk-arrow{width:34px;height:34px;border-radius:50%;background:#1A1A2E;color:#F5B800;display:flex;align-items:center;justify-content:center;font-size:13px}",
    ".mk-empty{font-size:13px;color:#6B6B6B;padding:8px 0}",
    ".mk-more{font-size:13px;font-weight:700;color:#1A1A2E;text-decoration:underline !important;text-underline-offset:3px;align-self:flex-start}"
  ].join("\n");

  function injectCss() {
    if (document.getElementById("mk-store-css")) return;
    var st = document.createElement("style");
    st.id = "mk-store-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ---------- 属性LP ----------
  // 応募ボタン（IVBooking.open）の jobCategory に店舗を付ける。遷移先（widget）は変えない（SPEC.md T2）
  var bookingLabel = "";
  function wrapBooking() {
    function wrap(obj) {
      if (!obj || typeof obj.open !== "function" || obj.open.__mkStore) return obj;
      var orig = obj.open;
      obj.open = function (opts) {
        opts = Object.assign({}, opts || {});
        if (bookingLabel) opts.jobCategory = opts.jobCategory ? opts.jobCategory + "｜" + bookingLabel : bookingLabel;
        return orig.call(this, opts);
      };
      obj.open.__mkStore = true;
      return obj;
    }
    // booking.js は x-dc の helmet 経由で後から読み込まれるため、代入時にラップする
    var current = wrap(window.IVBooking);
    try {
      Object.defineProperty(window, "IVBooking", {
        configurable: true,
        get: function () { return current; },
        set: function (v) { current = wrap(v); }
      });
    } catch (e) {
      var tries = 0;
      var t = setInterval(function () {
        wrap(window.IVBooking);
        if (++tries > 100 || (window.IVBooking && window.IVBooking.open.__mkStore)) clearInterval(t);
      }, 200);
    }
  }

  // ?store= をサイト内リンクに引き継ぐ。React 管理のリンクも扱えるよう、押された瞬間に href を書き換える。
  // 対象外：owner（店舗展開の対象外）、店舗ページ・データ・画像、外部サイト、同一ページ内アンカー
  var SKIP_PATH = /(^|\/)(owner(\.html)?|stores\/.*|data\/.*|assets\/.*)$/;
  function carryStore(id) {
    function rewrite(e) {
      var a = e.target && e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      var u;
      try { u = new URL(a.getAttribute("href"), location.href); } catch (err) { return; }
      if (u.origin !== BASE.origin || u.pathname.indexOf(BASE.pathname) !== 0) return;
      if (SKIP_PATH.test(u.pathname.slice(BASE.pathname.length))) return;
      if (u.pathname === location.pathname && u.search === location.search && u.hash) return;
      if (u.searchParams.has("store")) return;
      u.searchParams.set("store", id);
      a.setAttribute("href", u.pathname + u.search + u.hash);
    }
    document.addEventListener("pointerdown", rewrite, true);
    document.addEventListener("click", rewrite, true);
  }
  function validStoreFromQuery(stores) {
    var id = new URLSearchParams(location.search).get("store");
    return id ? stores.filter(function (s) { return s.store_id === id; })[0] || null : null;
  }

  function shortName(s) { return String(s.store_name).replace(/^もみかる\s*/, ""); }

  // 店舗の制度（benefits）を LP に知らせる。店舗指定なし・募集なしの属性では何も有効にしない（SPEC.md §12）
  function setBenefits(b) {
    window.MK_BENEFITS = b || {};
    try { window.dispatchEvent(new CustomEvent("mk:benefits", { detail: window.MK_BENEFITS })); } catch (e) {}
  }

  function runLp() {
    var id = new URLSearchParams(location.search).get("store");
    if (!id) return;
    wrapBooking();
    var store = D.stores.filter(function (s) { return s.store_id === id; })[0];
    if (!store) { console.warn("[store-context] unknown store:", id); return; }
    var attr = D.attrs.attributes[ATTR] || { short: ATTR };
    injectCss();
    var wrapEl = document.createElement("div");
    wrapEl.className = "mk-store";

    if (!(store.attributes && store.attributes[ATTR] === true)) {
      // 募集していない属性：店舗帯は出さず、応募ボタン・サイト内リンクにも店舗を付けない。制度も無効。
      // 1行の案内＋近隣店舗ボタンだけを出し、選ばれた近隣店舗の URL で初めて店舗指定になる
      var near = nearbyStores(D.stores, store, ATTR);
      wrapEl.setAttribute("data-store-unavailable", store.store_id);
      setBenefits({});
      wrapEl.innerHTML = '<div class="mk-off"><div class="mk-off-in">' +
        '<span class="mk-off-msg">' + esc(shortName(store)) + 'では「' + esc(attr.short) + '」の募集はありません' + (near.length ? '。近くの店舗：' : '') + '</span>' +
        '<span class="mk-chips">' +
        (near.length
          ? near.map(function (s) { return '<a class="mk-chip" href="' + esc(lpUrl(ATTR, s.store_id)) + '">' + esc(shortName(s)) + ' →</a>'; }).join("") +
            '<a class="mk-list" href="' + esc(url("stores/")) + '">店舗一覧</a>'
          : '<a class="mk-chip" href="' + esc(url("stores/")) + '">店舗一覧から探す →</a>') +
        '</span></div></div>';
    } else {
      bookingLabel = store.store_name + "（store:" + store.store_id + "）";
      carryStore(store.store_id);
      setBenefits(store.benefits);
      wrapEl.setAttribute("data-store-context", store.store_id);
      var subs = (store.sub_locations || []).map(function (s) { return s.name; });
      wrapEl.innerHTML = '<div class="mk-bar"><div class="mk-bar-in">' +
        '<span class="mk-tag">STORE</span>' +
        '<span class="mk-name">' + esc(store.store_name) + '</span>' +
        '<span class="mk-sub">' + esc(locText(store.address)) + (subs.length ? '／勤務地：' + esc([store.store_name].concat(subs).join("・")) : "") + '</span>' +
        '<span class="mk-links"><a href="' + esc(storeUrl(store.store_id)) + '">店舗ページ</a><a href="' + esc(url("stores/")) + '">店舗を変える</a></span>' +
        '</div></div>';
    }
    // body の先頭に、ページ本体より先に入れる（後から押し下げない）
    whenBody(function () { document.body.insertBefore(wrapEl, document.body.firstChild); });
  }

  // ---------- フェイス：店舗検索 ----------
  function renderSearch(mount, d) {
    var regions = [];
    d.stores.forEach(function (s) { var r = s.address && s.address.region; if (r && regions.indexOf(r) < 0) regions.push(r); });
    var state = { q: "", region: "", attr: "" };

    mount.innerHTML =
      '<section class="mk-store mk-sec"><div class="mk-sec-in">' +
      '<div style="display:flex;flex-direction:column;gap:12px">' +
      '<div class="mk-eyebrow"><i></i><span>FIND_A_STORE [' + d.stores.length + ']</span></div>' +
      '<h2 class="mk-h2">お近くの店舗から探す。</h2>' +
      '<p class="mk-lead">店舗ごとに、募集中の働き方と勤務地を確認できます。</p>' +
      '</div>' +
      '<div class="mk-form">' +
      '<input class="mk-input" type="search" placeholder="店舗名・地域で検索（例：静岡、富山）" aria-label="店舗名・地域で検索">' +
      '<div class="mk-filter" data-k="region" role="group" aria-label="地域で絞り込む"><button type="button" data-v="" aria-pressed="true">すべての地域</button>' +
      regions.map(function (r) { return '<button type="button" data-v="' + esc(r) + '" aria-pressed="false">' + esc(r) + '</button>'; }).join("") + '</div>' +
      '<div class="mk-filter" data-k="attr" role="group" aria-label="働き方で絞り込む"><button type="button" data-v="" aria-pressed="true">すべての働き方</button>' +
      d.attrs.order.map(function (k) { return '<button type="button" data-v="' + esc(k) + '" aria-pressed="false">' + esc(d.attrs.attributes[k].short) + '</button>'; }).join("") + '</div>' +
      '</div>' +
      '<div class="mk-grid" aria-live="polite"></div>' +
      '<a class="mk-more" href="' + esc(url("stores/")) + '">店舗一覧を見る →</a>' +
      '</div></section>';

    var grid = mount.querySelector(".mk-grid");
    function draw() {
      var q = state.q.trim().toLowerCase();
      var list = d.stores.filter(function (s) {
        if (state.region && (!s.address || s.address.region !== state.region)) return false;
        if (state.attr && !(s.attributes && s.attributes[state.attr] === true)) return false;
        if (!q) return true;
        var hay = [s.store_name, s.store_id, locText(s.address), s.address && s.address.street]
          .concat((s.sub_locations || []).map(function (x) { return x.name + " " + locText(x.address); }))
          .join(" ").toLowerCase();
        return hay.indexOf(q) >= 0;
      });
      grid.innerHTML = list.length ? list.map(function (s) {
        var on = d.attrs.order.filter(function (k) { return s.attributes && s.attributes[k] === true; });
        return '<a class="mk-card" href="' + esc(storeUrl(s.store_id)) + '"><span style="display:flex;flex-direction:column;gap:2px;min-width:0">' +
          '<span class="mk-card-t">' + esc(s.store_name) + '</span>' +
          '<span class="mk-card-s">' + esc(locText(s.address)) + ((s.sub_locations || []).length ? '（勤務地 ' + (s.sub_locations.length + 1) + 'か所）' : '') + '</span>' +
          '<span class="mk-card-a">' + on.map(function (k) { return '<span>' + esc(d.attrs.attributes[k].short) + '</span>'; }).join("") + '</span>' +
          '</span><span class="mk-arrow">→</span></a>';
      }).join("") : '<p class="mk-empty">条件に合う店舗が見つかりませんでした。</p>';
    }
    mount.querySelector(".mk-input").addEventListener("input", function (e) { state.q = e.target.value; draw(); });
    Array.prototype.forEach.call(mount.querySelectorAll(".mk-filter"), function (g) {
      g.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        state[g.getAttribute("data-k")] = b.getAttribute("data-v");
        Array.prototype.forEach.call(g.querySelectorAll("button"), function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        draw();
      });
    });
    draw();
  }

  function runSearch() {
    injectCss();
    var store = validStoreFromQuery(D.stores);
    if (store) carryStore(store.store_id);
    // マウント要素は dc-runtime の描画時に現れる。描画の直後（画面に出る前）に中身を入れ、再マウントにも追従する
    function tryMount() {
      var m = document.getElementById("store-search-mount");
      if (m && !m.firstChild) renderSearch(m, D);
    }
    tryMount();
    new MutationObserver(tryMount).observe(document.documentElement, { childList: true, subtree: true });
  }

  if (MODE === "lp") runLp();
  else if (MODE === "search") runSearch();
})();
