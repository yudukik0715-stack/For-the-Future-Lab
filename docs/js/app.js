// For the Future Lab — 空っぽから自分で育てる知識の部屋
import { Store, uid, now } from "./store.js";

/* ================= 小道具 ================= */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = u => /^https?:\/\//i.test(u || "") ? u : "";
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fmtDate = iso => { if (!iso) return ""; const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const prefs = { get(k, d) { try { return localStorage.getItem("fl-pref-" + k) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem("fl-pref-" + k, v); } catch {} } };

const COLORS = { gray: "#8a8d96", red: "#d9534f", orange: "#e8833a", yellow: "#d4a514", green: "#3aa76d", teal: "#1f9e9a", blue: "#3b7ddd", purple: "#8a5cd6", pink: "#d9579b" };
const FIELD_KINDS = {
  text: "テキスト", number: "数値", date: "日付", select: "選択（1つ）", multi: "選択（複数）・タグ",
  checkbox: "チェック", url: "リンク（URL）", rating: "評価（★）", relation: "別の項目とつなぐ",
};

/* ================= データの読み書き ================= */
const types = () => Store.list("type").sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0) || a.data.name.localeCompare(b.data.name));
const items = () => Store.list("item");
const itemsOf = typeId => items().filter(i => (i.data.type || null) === typeId);
const typeName = id => Store.get(id)?.data.name || "ページ";
const wsName = () => Store.get("setting-ws")?.data.name || "For the Future Lab";
const titleOf = r => r?.data.title?.trim() || "無題";
const findByTitle = t => items().find(i => (i.data.title || "").trim().toLowerCase() === t.trim().toLowerCase());

function newType(data) {
  const id = uid("t-");
  Store.put("type", id, { name: "新しい種類", icon: "📁", color: "blue", fields: [], views: [{ id: uid("v-"), name: "表", kind: "table" }], order: types().length, ...data });
  return id;
}
function newItem(typeId = null, title = "", props = {}) {
  const id = uid("i-");
  Store.put("item", id, { title, type: typeId, props, body: "", created: now() });
  return id;
}
const saveItem = (rec, patch) => Store.put("item", rec.id, { ...rec.data, ...patch });
const saveType = (rec, patch) => Store.put("type", rec.id, { ...rec.data, ...patch });

/* ================= テンプレート（任意。中身は空、項目の形だけ） ================= */
const TEMPLATES = [
  { name: "研究テーマ", icon: "🔬", color: "blue", desc: "仮説から結論まで追いかける", fields: [["段階", "select", ["仮説", "調査", "実験", "結論"]], ["分野", "multi", []], ["始めた日", "date"]], body: "## 問い\n\n## 仮説\n\n## 調査\n\n## 実験\n\n## 結論\n" },
  { name: "論文・本", icon: "📚", color: "purple", desc: "読んだもの、読みたいもの", fields: [["著者", "text"], ["年", "number"], ["状態", "select", ["あとで読む", "読書中", "読了"]], ["評価", "rating"], ["リンク", "url"], ["タグ", "multi", []]], body: "## 要約\n\n## 大事なところ\n\n## 自分の考え\n" },
  { name: "統計・データ", icon: "📈", color: "teal", desc: "世界の数字を記録する", fields: [["値", "number"], ["単位", "text"], ["年", "number"], ["出典", "url"], ["指標", "select", []]], body: "" },
  { name: "学習ログ", icon: "✏️", color: "green", desc: "何をどれだけ学んだか", fields: [["日付", "date"], ["分", "number"], ["科目", "select", ["数学", "英語", "国語", "理科", "社会"]], ["手応え", "rating"]], body: "" },
  { name: "アイデア", icon: "💡", color: "yellow", desc: "思いつきを逃さない", fields: [["状態", "select", ["種", "育て中", "形になった"]], ["タグ", "multi", []]], body: "" },
  { name: "未来の構想", icon: "🧭", color: "orange", desc: "なりたい自分と計画", fields: [["いつ", "select", ["1年後", "3年後", "5年後", "10年後"]], ["達成", "checkbox"]], body: "" },
];
function createFromTemplate(t) {
  const fields = t.fields.map(([name, kind, options]) => ({ id: uid("f-"), name, kind, options: options || [] }));
  const views = [{ id: uid("v-"), name: "ギャラリー", kind: "gallery" }, { id: uid("v-"), name: "表", kind: "table" }];
  const sel = fields.find(f => f.kind === "select");
  if (sel) views.push({ id: uid("v-"), name: "ボード", kind: "board", group: sel.id });
  return newType({ name: t.name, icon: t.icon, color: t.color, fields, views, template: t.body || "" });
}

/* ================= Markdown（最小限・先にエスケープ） ================= */
function md(src) {
  const lines = esc(src || "").split("\n");
  let html = "", list = null, inCode = false, code = "";
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  const inline = s => s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<i>$2</i>")
    .replace(/==(.+?)==/g, "<mark>$1</mark>")
    .replace(/\[\[([^\]]+)\]\]/g, (_, t) => { const r = findByTitle(t.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")); return `<a class="wl${r ? "" : " missing"}" href="#item/${r ? r.id : ""}" data-wl="${t}">${t}</a>`; })
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, ref) => okRef(ref) ? `<figure>${imgTag(ref, "", alt)}${alt ? `<figcaption>${alt}</figcaption>` : ""}</figure>` : _)
    .replace(/(^|[^!])\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1<a href="$3" target="_blank" rel="noopener">$2</a>');
  for (const raw of lines) {
    if (raw.startsWith("```")) { if (inCode) { html += `<pre><code>${code}</code></pre>`; code = ""; inCode = false; } else { close(); inCode = true; } continue; }
    if (inCode) { code += raw + "\n"; continue; }
    const l = raw.trimEnd();
    let m;
    if ((m = l.match(/^(#{1,3})\s+(.*)/))) { close(); html += `<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`; continue; }
    if ((m = l.match(/^\s*[-*]\s+\[( |x)\]\s+(.*)/))) { if (list !== "ul") { close(); html += "<ul>"; list = "ul"; } html += `<li style="list-style:none;margin-left:-18px">${m[1] === "x" ? "☑" : "☐"} ${inline(m[2])}</li>`; continue; }
    if ((m = l.match(/^\s*[-*]\s+(.*)/))) { if (list !== "ul") { close(); html += "<ul>"; list = "ul"; } html += `<li>${inline(m[1])}</li>`; continue; }
    if ((m = l.match(/^\s*\d+\.\s+(.*)/))) { if (list !== "ol") { close(); html += "<ol>"; list = "ol"; } html += `<li>${inline(m[1])}</li>`; continue; }
    close();
    if ((m = l.match(/^&gt;\s?(.*)/))) { html += `<blockquote>${inline(m[1])}</blockquote>`; continue; }
    if (/^---+$/.test(l)) { html += "<hr>"; continue; }
    if (l) html += `<p>${inline(l)}</p>`;
  }
  if (inCode) html += `<pre><code>${code}</code></pre>`;
  close();
  return html;
}

/* ================= 画像 ================= */
const okRef = r => /^(sb:[\w\-./]+|https:\/\/[^\s"'<>]+|data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+)$/.test(r || "");
// 画像は data-ref に入れておき、描いたあとで本物のURLに差し替える
function imgTag(ref, cls = "", alt = "") {
  if (!okRef(ref)) return "";
  return `<img class="${cls}" alt="${esc(alt)}" loading="lazy" decoding="async" data-ref="${esc(ref)}"${ref.startsWith("sb:") ? "" : ` src="${esc(ref)}"`}>`;
}
async function hydrate(el = document) {
  const imgs = [...el.querySelectorAll("img[data-ref^='sb:']:not([src])")];
  if (!imgs.length) return;
  const urls = await Store.resolveImages(imgs.map(i => i.dataset.ref));
  imgs.forEach((im, k) => { if (urls[k]) im.src = urls[k]; else im.classList.add("broken"); });
}
// 写真を小さくしてから送る（長い辺1600px）
async function shrink(file) {
  if (!/^image\//.test(file.type) || file.type === "image/gif") return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const webp = await new Promise(r => c.toBlob(r, "image/webp", .85));
  if (webp && webp.type === "image/webp") return webp;
  return await new Promise(r => c.toBlob(r, "image/jpeg", .85));
}
async function uploadFile(file) {
  toast("画像を送っています…");
  const ref = await Store.uploadImage(await shrink(file));
  toast("画像を入れました");
  return ref;
}
// 写真を選ぶ／URLを貼る ダイアログ。選んだ画像の参照を返す（やめたら null）
function pickImage(title = "画像を選ぶ", allowRemove = false) {
  return new Promise(resolve => {
    let done = false; const finish = v => { if (!done) { done = true; resolve(v); } };
    dialog(title, `
      <label class="btn" for="pickFile" style="width:100%;justify-content:center;cursor:pointer">📷 写真やファイルから選ぶ</label>
      <input type="file" id="pickFile" accept="image/*" hidden>
      <div class="muted" style="margin:14px 0 6px">または、画像のURLを貼る</div>
      <form class="row" id="pickUrlF" style="flex-wrap:nowrap"><input id="pickUrl" type="url" inputmode="url" placeholder="https://…"><button class="btn ghost">使う</button></form>
      ${allowRemove ? `<button class="btn danger sm" id="pickRemove" style="margin-top:16px">画像を外す</button>` : ""}
      <p class="muted" id="pickMsg" role="status"></p>`, (o, close) => {
      const end = v => { finish(v); close(); };
      o.addEventListener("click", e => { if (e.target === o || e.target.closest("[data-close]")) finish(null); });
      $("#pickFile", o).onchange = async e => { const f = e.target.files[0]; if (!f) return; $("#pickMsg", o).textContent = "送っています…"; try { end(await uploadFile(f)); } catch (err) { $("#pickMsg", o).textContent = "入れられませんでした：" + (err.message || err); } };
      $("#pickUrlF", o).onsubmit = e => { e.preventDefault(); const u = $("#pickUrl", o).value.trim(); if (!/^https:\/\//.test(u)) { $("#pickMsg", o).textContent = "https:// で始まるURLを貼ってね"; return; } end(u); };
      const rm = $("#pickRemove", o); if (rm) rm.onclick = () => end("");
    });
  });
}
const firstImage = body => { const m = (body || "").match(/!\[[^\]]*\]\(([^)\s]+)\)/); return m && okRef(m[1]) ? m[1] : ""; };
const coverOf = i => i.data.cover || firstImage(i.data.body);
const plain = b => (b || "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/[#*>\-\[\]=`]/g, "");

/* ================= 題名の色 ================= */
const GRADS = {
  silver: { label: "シルバー", css: "linear-gradient(180deg,#f7f7fa 0%,#b8bcc6 45%,#6e737d 100%)" },
  chrome: { label: "クローム", css: "linear-gradient(180deg,#1d1d1f 0%,#8a8f99 50%,#1d1d1f 100%)" },
  gold: { label: "ゴールド", css: "linear-gradient(180deg,#fff3c4 0%,#d9a93b 50%,#8a5a12 100%)" },
  rose: { label: "ローズ", css: "linear-gradient(120deg,#ffb6c9,#e86a92 60%,#b23a66)" },
  sky: { label: "空", css: "linear-gradient(120deg,#7cc6ff,#3b7ddd 60%,#6a5ae0)" },
  mint: { label: "ミント", css: "linear-gradient(120deg,#a8f0d1,#2fb38a 60%,#1f7a8c)" },
  sunset: { label: "夕焼け", css: "linear-gradient(120deg,#ffcf6b,#ff7a59 55%,#c2417a)" },
};
const SOLIDS = ["#1d1d1f", "#6e6e73", "#ffffff", "#0071e3", "#5e5ce6", "#bf5af2", "#ff375f", "#ff9f0a", "#30b158", "#00a3bf"];
// 題名の色を style 属性用の文字列にする（グラデーションは文字の形に切り抜く）
function titleStyle(v) {
  if (!v) return "";
  if (v.startsWith("grad:") && GRADS[v.slice(5)]) return `background-image:${GRADS[v.slice(5)].css};-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;caret-color:var(--ink)`;
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return `color:${v};-webkit-text-fill-color:${v}`;
  return "";
}
function pickColor(title, current) {
  return new Promise(resolve => {
    let done = false; const fin = v => { if (!done) { done = true; resolve(v); } };
    const sw = (v, label, bg) => `<button class="swatch ${current === v ? "on" : ""}" data-c="${v}" title="${label}" aria-label="${label}" style="background:${bg}"></button>`;
    dialog(title, `
      <div class="muted">グラデーション</div>
      <div class="swatches">${Object.entries(GRADS).map(([k, g]) => sw("grad:" + k, g.label, g.css)).join("")}</div>
      <div class="muted" style="margin-top:12px">ふつうの色</div>
      <div class="swatches">${SOLIDS.map(c => sw(c, c, c)).join("")}<label class="swatch custom" title="好きな色を選ぶ"><input type="color" id="cc" value="${/^#/.test(current || "") ? current : "#5e5ce6"}" aria-label="好きな色を選ぶ"></label></div>
      <div class="preview-title" id="pv" style="${titleStyle(current)}">知識の部屋</div>
      <div class="row" style="margin-top:14px"><button class="btn ghost sm" id="cReset">もとの色に戻す</button><span class="sp"></span><button class="btn" id="cOk">決める</button></div>`, (o, close) => {
      let val = current || "";
      const show = () => { $("#pv", o).setAttribute("style", titleStyle(val)); o.querySelectorAll(".swatch[data-c]").forEach(b => b.classList.toggle("on", b.dataset.c === val)); };
      o.querySelectorAll(".swatch[data-c]").forEach(b => b.onclick = () => { val = b.dataset.c; show(); });
      $("#cc", o).oninput = e => { val = e.target.value; show(); };
      $("#cReset", o).onclick = () => { fin(""); close(); };
      $("#cOk", o).onclick = () => { fin(val); close(); };
      o.addEventListener("click", e => { if (e.target === o || e.target.closest("[data-close]")) fin(null); });
    });
  });
}
const miniTools = (coverId, colorId, hasCover) => `<span class="minitools"><button class="mini" id="${coverId}" title="${hasCover ? "カバーを変える" : "カバーをつける"}" aria-label="${hasCover ? "カバーを変える" : "カバーをつける"}">🖼</button><button class="mini" id="${colorId}" title="題名の色" aria-label="題名の色を変える"><span class="aa">Aa</span></button></span>`;

/* ================= 画面の骨組み ================= */
const root = $("#root");
let toastT;
function toast(msg) {
  let el = $(".toast"); if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 2200);
}
function shell() {
  root.innerHTML = `<div class="app">
    <aside class="side" id="side" aria-label="ワークスペース"></aside>
    <main class="main" id="main">
      <div class="topbar"><button class="iconbtn menu-btn" id="menuBtn" aria-label="メニューをひらく">☰</button><div class="crumbs" id="crumbs"></div>
        <button class="iconbtn" id="searchBtn" aria-label="検索（⌘K）" title="検索（⌘K）">🔍</button>
        <button class="iconbtn" id="newBtn" aria-label="新しいページ" title="新しいページ">＋</button></div>
      <div class="page" id="view"></div>
    </main></div>`;
  $("#menuBtn").onclick = () => toggleSide(true);
  $("#searchBtn").onclick = openPalette;
  $("#newBtn").onclick = () => { const r = route(); const id = newItem(r.name === "type" ? r.id : null); go("item/" + id, { focusTitle: true }); };
}
function toggleSide(open) {
  $("#side").classList.toggle("open", open);
  let s = $(".scrim"); if (open && !s) { s = document.createElement("div"); s.className = "scrim"; s.onclick = () => toggleSide(false); document.body.appendChild(s); }
  if (!open && s) s.remove();
}

function renderSide() {
  const r = route(), t = types();
  const status = Store.adapter?.name === "cloud" ? ["ok", "同期オン"] : ["", "この端末に保存"];
  $("#side").innerHTML = `
    <div class="side-head"><span class="ws">${esc(wsName())}</span><button class="iconbtn" id="sideClose" aria-label="閉じる" style="display:${innerWidth <= 820 ? "grid" : "none"}">✕</button></div>
    <div class="side-scroll">
      <a class="nav-item ${r.name === "home" ? "on" : ""}" href="#"><span class="ic">🏠</span>ホーム</a>
      <button class="nav-item" id="sideSearch"><span class="ic">🔍</span>検索</button>
      <a class="nav-item ${r.name === "pages" ? "on" : ""}" href="#pages"><span class="ic">📄</span>ページ<span class="count">${itemsOf(null).length}</span></a>
      <div class="side-label"><span>部屋</span><button id="addType" aria-label="新しい部屋（種類）をつくる" title="新しい部屋をつくる">＋</button></div>
      ${t.map(x => `<a class="nav-item ${r.id === x.id ? "on" : ""}" href="#type/${x.id}"><span class="ic">${esc(x.data.icon || "📁")}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.data.name)}</span><span class="count">${itemsOf(x.id).length}</span></a>`).join("") || `<div class="muted" style="padding:4px 8px">まだ部屋はありません。＋で作れるよ。</div>`}
      <div class="side-label"><span>その他</span></div>
      <a class="nav-item ${r.name === "settings" ? "on" : ""}" href="#settings"><span class="ic">⚙️</span>設定</a>
    </div>
    <div class="side-foot"><span class="dot ${status[0]}" id="syncDot"></span><span id="syncText">${status[1]}</span></div>`;
  $("#addType").onclick = () => { const id = newType({}); go("type/" + id); setTimeout(() => editTypeDialog(id, true), 50); };
  $("#sideSearch").onclick = openPalette;
  const c = $("#sideClose"); if (c) c.onclick = () => toggleSide(false);
}

/* ================= ルーティング ================= */
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  const [name, id] = h.split("/");
  if (name === "type" && Store.get(id)) return { name, id };
  if (name === "item" && Store.get(id)) return { name, id };
  if (["pages", "settings"].includes(name)) return { name };
  return { name: "home" };
}
let navOpts = {};
function go(path, opts = {}) { navOpts = opts; if (location.hash === "#" + path) render(); else location.hash = path; }
function render() {
  if (Store.status !== "ready") return;
  const r = route();
  renderSide();
  toggleSide(false);
  const v = $("#view");
  v.className = "page" + (r.name === "type" ? " wide" : "");
  const views = { home: viewHome, pages: viewPages, settings: viewSettings, type: viewType, item: viewItem };
  views[r.name](v, r.id);
  hydrate(v);
  $("#main").scrollTo(0, 0);
  navOpts = {};
}

/* ================= ホーム ================= */
const ws = () => Store.get("setting-ws")?.data || {};
const saveWs = patch => Store.put("setting", "setting-ws", { ...ws(), ...patch });
function viewHome(v) {
  $("#crumbs").textContent = "";
  const hr = new Date().getHours();
  const greet = hr < 5 ? "夜ふかしだね" : hr < 11 ? "おはよう" : hr < 18 ? "こんにちは" : "おつかれさま";
  const recent = items().sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 8);
  const pinned = items().filter(i => i.data.pinned);
  const t = types(), cover = ws().cover;
  v.innerHTML = `
    <section class="hero ${cover ? "has-img" : ""}">
      ${cover ? imgTag(cover, "hero-img") : ""}
      <div class="hero-in">
        <div class="eyebrow">${new Date().toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "long" })}</div>
        <h1 style="${titleStyle(ws().titleColor)}">${greet}。</h1>
        <form class="capture" id="capture"><input id="capIn" placeholder="思いついたことを書いて Enter" autocomplete="off" enterkeyhint="done" aria-label="新しいページのタイトル"><button class="btn">追加</button></form>
      </div>
      <span class="hero-edit">${miniTools("heroCover", "heroColor", Boolean(cover))}</span>
    </section>

    ${pinned.length ? `<h2>ピン留め</h2><div class="gallery">${pinned.map(galleryCard).join("")}</div>` : ""}

    <h2>部屋</h2>
    ${t.length ? `<div class="rooms">${t.map(x => `<a class="room" href="#type/${x.id}">
        <div class="room-cover">${x.data.cover ? imgTag(x.data.cover) : `<span class="room-emoji">${esc(x.data.icon)}</span>`}</div>
        <div class="room-meta"><b>${x.data.cover ? esc(x.data.icon) + " " : ""}${esc(x.data.name)}</b><span class="muted">${itemsOf(x.id).length} 件</span></div></a>`).join("")}
        <button class="room add" id="homeAddType"><div class="room-cover"><span class="room-emoji">＋</span></div><div class="room-meta"><b>新しい部屋</b><span class="muted">なんでも作れる</span></div></button></div>`
      : `<div class="empty">まだ空っぽ。ここから自分の部屋を作っていこう。<div style="margin-top:12px"><button class="btn" id="homeAddType">＋ 空の部屋をつくる</button></div></div>`}

    <h2>最近ひらいたもの</h2>
    ${recent.length ? `<div class="gallery">${recent.map(galleryCard).join("")}</div>` : `<div class="muted">まだページはありません。上の入力欄に書いてみてね。</div>`}

    <h2>ひな形から始める <span class="muted" style="font-weight:400">（使わなくてもOK）</span></h2>
    <p class="muted" style="margin-top:-4px">項目の形だけ用意した部屋ができるよ。中身は空っぽで、あとから自由に変えられる。</p>
    <div class="tplgrid">${TEMPLATES.map((x, i) => `<button class="tpl" data-tpl="${i}"><b>${x.icon} ${esc(x.name)}</b><span class="muted">${esc(x.desc)}</span></button>`).join("")}</div>`;
  $("#capture").onsubmit = e => { e.preventDefault(); const t = $("#capIn").value.trim(); if (!t) return; const id = newItem(null, t); $("#capIn").value = ""; toast("ページを作りました"); go("item/" + id); };
  $("#heroColor").onclick = async () => { const c = await pickColor("あいさつの文字の色", ws().titleColor); if (c === null) return; saveWs({ titleColor: c }); render(); };
  $("#heroCover").onclick = async () => { const r = await pickImage("ホームのカバー画像", Boolean(cover)); if (r === null) return; saveWs({ cover: r }); render(); };
  const ha = $("#homeAddType"); if (ha) ha.onclick = () => { const id = newType({}); go("type/" + id); setTimeout(() => editTypeDialog(id, true), 50); };
  v.querySelectorAll("[data-tpl]").forEach(b => b.onclick = () => { const id = createFromTemplate(TEMPLATES[+b.dataset.tpl]); toast("部屋を作りました"); go("type/" + id); });
}
function rowHtml(i) {
  const t = i.data.type ? Store.get(i.data.type) : null;
  return `<a class="list-row" href="#item/${i.id}"><span>${esc(i.data.icon || t?.data.icon || "📄")}</span><span class="t">${esc(titleOf(i))}</span><span class="muted">${esc(t?.data.name || "ページ")}・${fmtDate(i.updated_at)}</span></a>`;
}
function galleryCard(i, fields = []) {
  const t = i.data.type ? Store.get(i.data.type) : null, c = coverOf(i);
  return `<a class="gcard" href="#item/${i.id}">
    <div class="gcover">${c ? imgTag(c) : `<span class="room-emoji">${esc(i.data.icon || t?.data.icon || "📄")}</span>`}</div>
    <div class="gbody"><b>${c && (i.data.icon || t) ? esc(i.data.icon || t.data.icon) + " " : ""}${esc(titleOf(i))}</b>
      ${fields.length ? `<div class="row" style="gap:4px">${fields.slice(0, 3).map(f => propChip(f, i.data.props?.[f.id])).join("")}</div>` : `<span class="muted">${esc(t?.data.name || "ページ")}・${fmtDate(i.updated_at)}</span>`}
      ${c ? "" : `<div class="excerpt">${esc(plain(i.data.body).slice(0, 90))}</div>`}</div></a>`;
}
const cardHtml = i => galleryCard(i);

/* ================= ページ一覧（種類なし） ================= */
function viewPages(v) {
  $("#crumbs").innerHTML = `<a href="#">ホーム</a> / ページ`;
  const list = itemsOf(null).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  v.innerHTML = `<div class="row"><h1 class="sp">📄 ページ</h1><button class="btn" id="np">＋ 新しいページ</button></div>
    <p class="lead">どの部屋にも入れていない、自由なページ。あとから部屋に移せるよ。</p>
    ${list.length ? list.map(rowHtml).join("") : `<div class="empty">ページはまだありません。</div>`}`;
  $("#np").onclick = () => go("item/" + newItem(null), { focusTitle: true });
}

/* ================= 部屋（種類）の画面 ================= */
const typeUI = {}; // typeId -> {view, q, sort}
function viewType(v, id) {
  const t = Store.get(id), d = t.data;
  const st = typeUI[id] ||= { view: d.views?.[0]?.id, q: "", sort: null };
  if (!d.views?.length) d.views = [{ id: uid("v-"), name: "表", kind: "table" }];
  const view = d.views.find(x => x.id === st.view) || d.views[0];
  st.view = view.id;
  $("#crumbs").innerHTML = `<a href="#">ホーム</a> / ${esc(d.name)}`;
  v.innerHTML = `
    ${d.cover ? `<div class="cover">${imgTag(d.cover)}</div>` : ""}
    <div class="row" style="${d.cover ? "margin-top:-34px;position:relative" : ""}"><h1 class="sp" style="min-width:0"><span class="page-icon">${esc(d.icon)}</span> <span style="${titleStyle(d.titleColor)}">${esc(d.name)}</span></h1>${miniTools("typeCover", "typeColor", Boolean(d.cover))}</div>
    <div class="row" style="margin-top:6px"><span class="sp"></span><button class="btn ghost sm" id="editType">項目と見た目を編集</button><button class="btn" id="addItem">＋ 新規</button></div>
    <div class="tabs" role="tablist">${d.views.map(x => `<button role="tab" class="${x.id === view.id ? "on" : ""}" data-view="${x.id}">${{ table: "▦", cards: "▤", board: "▥", gallery: "▣" }[x.kind] || ""} ${esc(x.name)}</button>`).join("")}<button data-addview="1" title="見え方を追加" aria-label="見え方を追加">＋</button></div>
    <div class="toolbar"><input type="search" id="q" placeholder="この部屋を絞り込む" value="${esc(st.q)}">
      ${view.kind === "board" ? `<label class="muted">分ける項目 <select id="groupBy">${d.fields.filter(f => f.kind === "select").map(f => `<option value="${f.id}" ${f.id === view.group ? "selected" : ""}>${esc(f.name)}</option>`).join("") || `<option value="">（「選択（1つ）」の項目が必要）</option>`}</select></label>` : ""}
      <span class="sp"></span><span class="muted" id="cnt"></span></div>
    <div id="viewBody"></div>`;
  const draw = () => {
    let list = itemsOf(id);
    if (st.q) { const q = st.q.toLowerCase(); list = list.filter(i => (titleOf(i) + " " + JSON.stringify(i.data.props || {}) + " " + (i.data.body || "")).toLowerCase().includes(q)); }
    const s = st.sort || { f: "_updated", dir: -1 };
    const val = i => s.f === "_title" ? titleOf(i) : s.f === "_updated" ? i.updated_at : propText(d.fields.find(f => f.id === s.f), i.data.props?.[s.f]);
    list.sort((a, b) => { const x = val(a), y = val(b); return (typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), "ja", { numeric: true })) * s.dir; });
    $("#cnt").textContent = `${list.length} 件`;
    const body = $("#viewBody");
    if (!itemsOf(id).length) { body.innerHTML = `<div class="empty">まだ何もありません。「＋ 新規」で最初の1件を作ろう。${d.fields.length ? "" : "<br>先に「項目と見た目を編集」で、記録したい項目（著者、年、状態など）を決めておくと便利だよ。"}</div>`; return; }
    if (view.kind === "gallery") { body.innerHTML = `<div class="gallery big">${list.map(i => galleryCard(i, d.fields)).join("")}</div>`; hydrate(body); }
    else if (view.kind === "cards") body.innerHTML = `<div class="cards">${list.map(i => `<a class="card" href="#item/${i.id}"><b>${esc(i.data.icon ? i.data.icon + " " : "")}${esc(titleOf(i))}</b><div class="row">${d.fields.slice(0, 3).map(f => propChip(f, i.data.props?.[f.id])).join("")}</div><div class="excerpt">${esc(plain(i.data.body).slice(0, 140))}</div></a>`).join("")}</div>`;
    else if (view.kind === "board") {
      const g = d.fields.find(f => f.id === view.group && f.kind === "select");
      if (!g) { body.innerHTML = `<div class="empty">ボードで分けるには「選択（1つ）」の項目が必要だよ。「項目と見た目を編集」から追加してね。</div>`; return; }
      const cols = [...(g.options || []), ""];
      body.innerHTML = `<div class="board">${cols.map(o => { const its = list.filter(i => (i.data.props?.[g.id] || "") === o); return `<div class="col"><h3><span class="chip" style="--c:${COLORS[colorOfOption(o)]}">${esc(o || "未設定")}</span><span class="muted">${its.length}</span></h3>${its.map(i => `<a class="card" href="#item/${i.id}">${esc(titleOf(i))}</a>`).join("")}<button class="btn ghost sm" data-newin="${esc(o)}" style="width:100%">＋ 追加</button></div>`; }).join("")}</div>`;
      body.querySelectorAll("[data-newin]").forEach(b => b.onclick = () => go("item/" + newItem(id, "", b.dataset.newin ? { [g.id]: b.dataset.newin } : {}), { focusTitle: true }));
    } else {
      const arrow = f => s.f === f ? (s.dir > 0 ? " ↑" : " ↓") : "";
      body.innerHTML = `<div class="tablewrap"><table class="db"><thead><tr><th data-sort="_title">タイトル${arrow("_title")}</th>${d.fields.map(f => `<th data-sort="${f.id}">${esc(f.name)}${arrow(f.id)}</th>`).join("")}<th data-sort="_updated">更新${arrow("_updated")}</th></tr></thead>
        <tbody>${list.map(i => `<tr><td class="title"><a href="#item/${i.id}">${esc(titleOf(i))}</a></td>${d.fields.map(f => `<td>${propCell(f, i.data.props?.[f.id])}</td>`).join("")}<td class="muted">${fmtDate(i.updated_at)}</td></tr>`).join("")}</tbody></table></div>`;
      body.querySelectorAll("th[data-sort]").forEach(th => th.onclick = () => { const f = th.dataset.sort; st.sort = { f, dir: s.f === f ? -s.dir : 1 }; draw(); });
    }
  };
  draw();
  $("#q").oninput = e => { st.q = e.target.value; draw(); };
  const gb = $("#groupBy"); if (gb) gb.onchange = e => { view.group = e.target.value; saveType(t, { views: d.views }); draw(); };
  $("#addItem").onclick = () => go("item/" + newItem(id, "", {}), { focusTitle: true });
  $("#editType").onclick = () => editTypeDialog(id);
  $("#typeColor").onclick = async () => { const c = await pickColor("部屋の名前の色", d.titleColor); if (c === null) return; saveType(Store.get(id), { titleColor: c }); render(); };
  $("#typeCover").onclick = async () => { const r = await pickImage("部屋のカバー画像", Boolean(d.cover)); if (r === null) return; saveType(Store.get(id), { cover: r }); render(); };
  v.querySelectorAll("[data-view]").forEach(b => b.onclick = () => { st.view = b.dataset.view; viewType(v, id); });
  v.querySelector("[data-addview]").onclick = () => addViewDialog(id);
}
function colorOfOption(o) { const keys = Object.keys(COLORS); let h = 0; for (const c of String(o)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return o ? keys[1 + (h % (keys.length - 1))] : "gray"; }
function propText(f, v) {
  if (!f || v == null || v === "") return "";
  if (f.kind === "number" || f.kind === "rating") return +v;
  if (f.kind === "multi") return (v || []).join(", ");
  if (f.kind === "checkbox") return v ? "✓" : "";
  if (f.kind === "relation") return titleOf(Store.get(v));
  return String(v);
}
function propChip(f, v) {
  if (v == null || v === "" || (Array.isArray(v) && !v.length)) return "";
  if (f.kind === "select") return `<span class="chip" style="--c:${COLORS[colorOfOption(v)]}">${esc(v)}</span>`;
  if (f.kind === "multi") return v.map(x => `<span class="chip" style="--c:${COLORS[colorOfOption(x)]}">${esc(x)}</span>`).join("");
  if (f.kind === "rating") return `<span class="chip">${"★".repeat(+v)}</span>`;
  if (f.kind === "checkbox") return v ? `<span class="chip" style="--c:${COLORS.green}">✓ ${esc(f.name)}</span>` : "";
  return `<span class="chip">${esc(propText(f, v))}</span>`;
}
function propCell(f, v) {
  if (v == null || v === "") return "";
  if (["select", "multi", "rating", "checkbox"].includes(f.kind)) return propChip(f, v);
  if (f.kind === "url") { const u = safeUrl(v); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//, "").slice(0, 32))}</a>` : esc(v); }
  if (f.kind === "relation") { const r = Store.get(v); return r ? `<a href="#item/${r.id}">${esc(titleOf(r))}</a>` : ""; }
  if (f.kind === "number") return `<span style="font-variant-numeric:tabular-nums">${esc(v)}</span>`;
  return esc(v);
}

/* ---------- 部屋の編集ダイアログ ---------- */
function dialog(title, inner, onMount) {
  const o = document.createElement("div"); o.className = "overlay";
  o.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button class="iconbtn" data-close aria-label="閉じる">✕</button></header><div class="body-pad">${inner}</div></div>`;
  const close = () => { o.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") close(); };
  o.addEventListener("click", e => { if (e.target === o || e.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", onKey);
  document.body.appendChild(o);
  onMount?.(o, close);
  return close;
}
function editTypeDialog(id, isNew = false) {
  const t = Store.get(id); const d = structuredClone(t.data);
  const draw = (o) => {
    o.querySelector(".body-pad").innerHTML = `
      <div class="row" style="align-items:flex-end">
        <label style="width:72px"><span class="muted">アイコン</span><input id="tIcon" value="${esc(d.icon)}" maxlength="4" style="font-size:20px;text-align:center"></label>
        <label class="sp"><span class="muted">部屋の名前</span><input id="tName" value="${esc(d.name)}" placeholder="例：論文、研究テーマ、統計"></label>
      </div>
      <h2 style="margin-top:18px">記録する項目</h2>
      <p class="muted" style="margin-top:-6px">この部屋のページが持つ項目。タイトルと本文はどの部屋にも最初からあるよ。</p>
      <div id="fields">${d.fields.map((f, i) => `<div class="field-row" data-i="${i}">
          <input data-k="name" value="${esc(f.name)}" aria-label="項目名">
          <select data-k="kind" aria-label="種類">${Object.entries(FIELD_KINDS).map(([k, n]) => `<option value="${k}" ${k === f.kind ? "selected" : ""}>${n}</option>`).join("")}</select>
          <button class="iconbtn" data-del="${i}" aria-label="この項目を削除">🗑</button>
          ${["select", "multi"].includes(f.kind) ? `<input data-k="options" style="grid-column:1/-1" value="${esc((f.options || []).join(", "))}" placeholder="選択肢をカンマ区切りで（例：あとで読む, 読書中, 読了）">` : ""}
          ${f.kind === "relation" ? `<select data-k="target" style="grid-column:1/-1">${[`<option value="">つなぐ先の部屋を選ぶ</option>`, ...types().map(x => `<option value="${x.id}" ${x.id === f.target ? "selected" : ""}>${esc(x.data.icon)} ${esc(x.data.name)}</option>`)].join("")}</select>` : ""}
        </div>`).join("") || `<div class="muted" style="padding:6px 0">項目はまだありません。</div>`}</div>
      <button class="btn ghost sm" id="addField" style="margin-top:8px">＋ 項目を追加</button>
      <h2>新しいページの下書き <span class="muted" style="font-weight:400">（任意）</span></h2>
      <textarea id="tTpl" rows="4" placeholder="例：## 要約&#10;## 自分の考え">${esc(d.template || "")}</textarea>
      <div class="row" style="margin-top:18px"><button class="btn danger sm" id="delType">${isNew ? "作るのをやめる" : "この部屋を削除"}</button><span class="sp"></span><button class="btn" id="saveType">保存</button></div>`;
    const sync = () => {
      d.icon = $("#tIcon", o).value.trim() || "📁"; d.name = $("#tName", o).value.trim() || "新しい部屋"; d.template = $("#tTpl", o).value;
      o.querySelectorAll(".field-row").forEach(row => { const f = d.fields[+row.dataset.i];
        row.querySelectorAll("[data-k]").forEach(el => { const k = el.dataset.k; f[k] = k === "options" ? el.value.split(/[,、]/).map(s => s.trim()).filter(Boolean) : el.value; }); });
    };
    o.querySelectorAll("[data-k=kind]").forEach(s => s.onchange = () => { sync(); draw(o); });
    o.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { sync(); d.fields.splice(+b.dataset.del, 1); draw(o); });
    $("#addField", o).onclick = () => { sync(); d.fields.push({ id: uid("f-"), name: "", kind: "text", options: [] }); draw(o); o.querySelector(`.field-row[data-i="${d.fields.length - 1}"] input`).focus(); };
    $("#saveType", o).onclick = () => { sync(); d.fields = d.fields.filter(f => f.name.trim()); saveType(t, d); o.remove(); toast("保存しました"); render(); };
    const del = $("#delType", o);
    del.onclick = () => {
      const n = itemsOf(id).length;
      if (!del.dataset.arm && n) { del.dataset.arm = 1; del.textContent = `中の ${n} 件はページに移して削除する（もう一度押す）`; return; }
      itemsOf(id).forEach(i => saveItem(i, { type: null }));
      Store.remove(id); o.remove(); toast("部屋を削除しました"); go("");
    };
    if (isNew) setTimeout(() => $("#tName", o).select(), 30);
  };
  dialog(isNew ? "新しい部屋" : "項目と見た目を編集", "", o => draw(o));
}
function addViewDialog(id) {
  const t = Store.get(id);
  dialog("見え方を追加", `<div class="tplgrid">${[["gallery", "▣ ギャラリー", "画像つきの大きなカード"], ["table", "▦ 表", "表計算のように一覧"], ["cards", "▤ カード", "本文の一部も見える"], ["board", "▥ ボード", "状態ごとに列で並べる"]].map(([k, n, s]) => `<button class="tpl" data-k="${k}"><b>${n}</b><span class="muted">${s}</span></button>`).join("")}</div>`,
    (o, close) => o.querySelectorAll("[data-k]").forEach(b => b.onclick = () => {
      const k = b.dataset.k, vw = { id: uid("v-"), name: { table: "表", cards: "カード", board: "ボード", gallery: "ギャラリー" }[k], kind: k };
      if (k === "board") vw.group = t.data.fields.find(f => f.kind === "select")?.id || "";
      saveType(t, { views: [...t.data.views, vw] }); (typeUI[id] ||= {}).view = vw.id; close(); render();
    }));
}

/* ================= ページ（項目）の画面 ================= */
function viewItem(v, id) {
  const rec = Store.get(id), d = rec.data, t = d.type ? Store.get(d.type) : null;
  const fields = t?.data.fields || [];
  if (!d.body && t?.data.template && !d.created_tpl) { d.body = t.data.template; d.created_tpl = true; saveItem(rec, { body: d.body, created_tpl: true }); }
  const untouched = !d.body || d.body === t?.data.template;
  const mode = navOpts.focusTitle ? "write" : prefs.get("mode-" + id, untouched ? "write" : "read");
  $("#crumbs").innerHTML = `<a href="#">ホーム</a> / ${t ? `<a href="#type/${t.id}">${esc(t.data.name)}</a>` : `<a href="#pages">ページ</a>`} / ${esc(titleOf(rec))}`;
  v.innerHTML = `
    ${d.cover ? `<div class="cover">${imgTag(d.cover)}</div>` : ""}
    <div class="row muted" style="font-size:13px;${d.cover ? "margin-top:-30px;position:relative" : ""}">
      <button class="page-icon big" id="iconBtn" aria-label="アイコンを変える" title="アイコンを変える">${esc(d.icon || t?.data.icon || "📄")}</button>
      <span class="sp"></span>
      ${miniTools("coverBtn", "colorBtn", Boolean(d.cover))}</div>
    <div class="row muted" style="font-size:13px">
      <select id="moveType" style="width:auto;border:0;padding:2px 4px;color:var(--sub)" aria-label="入れる部屋">${[`<option value="">📄 ページ（部屋なし）</option>`, ...types().map(x => `<option value="${x.id}" ${x.id === d.type ? "selected" : ""}>${esc(x.data.icon)} ${esc(x.data.name)}</option>`)].join("")}</select>
      <span class="sp"></span><button class="btn ghost sm" id="pin">${d.pinned ? "📌 ピン留め中" : "📌 ピン留め"}</button></div>
    <input class="title-input" id="title" value="${esc(d.title)}" placeholder="無題" aria-label="タイトル" style="${titleStyle(d.titleColor)}">
    ${fields.length ? `<div class="props">${fields.map(f => `<div class="k" title="${esc(f.name)}">${esc(f.name)}</div><div>${propEditor(f, d.props?.[f.id])}</div>`).join("")}</div>` : t ? `<div class="hint" style="margin:6px 0 14px">この部屋にはまだ項目がありません。<a href="#type/${t.id}">部屋の画面</a>の「項目と見た目を編集」で追加できるよ。</div>` : `<div style="height:12px"></div>`}
    <div class="editor-tabs"><button data-mode="write" class="${mode === "write" ? "on" : ""}">書く</button><button data-mode="read" class="${mode === "read" ? "on" : ""}">読む</button><button id="insImg" title="本文に画像を入れる">🖼 画像を入れる</button><span class="sp"></span><span class="muted" id="saveState"></span></div>
    <textarea class="body" id="body" placeholder="ここに書く。&#10;# 見出し　- 箇条書き　**太字**　==マーカー==　[[ほかのページ]]" ${mode === "write" ? "" : "hidden"}>${esc(d.body)}</textarea>
    <div class="md" id="preview" ${mode === "read" ? "" : "hidden"}>${md(d.body) || `<p class="muted">まだ本文はありません。「書く」から書けるよ。</p>`}</div>
    <div class="backlinks" id="backlinks"></div>
    <div class="row" style="margin-top:30px"><span class="sp"></span><button class="btn danger sm" id="delItem">このページを削除</button></div>`;

  const cur = () => Store.get(id);
  const saveState = (s) => { const el = $("#saveState"); if (el) el.textContent = s; };
  const insertAtCursor = text => {
    const ta = $("#body"); const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a;
    ta.value = ta.value.slice(0, a) + text + ta.value.slice(b); ta.selectionStart = ta.selectionEnd = a + text.length;
    saveItem(cur(), { body: ta.value }); saveState("保存しました");
  };
  const typed = () => ({ title: $("#title").value, body: $("#body").value }); // 入力中の文字を先に保存してから描き直す
  $("#colorBtn").onclick = async () => { const c = await pickColor("タイトルの色", cur().data.titleColor); if (c === null) return; saveItem(cur(), { ...typed(), titleColor: c }); render(); };
  $("#coverBtn").onclick = async () => { const r = await pickImage("カバー画像", Boolean(cur().data.cover)); if (r === null) return; saveItem(cur(), { ...typed(), cover: r }); render(); };
  $("#iconBtn").onclick = () => dialog("アイコン", `<p class="muted">絵文字を1つ入れてね（iPad の絵文字キーボードが使えるよ）</p><form class="row" id="icF" style="flex-wrap:nowrap"><input id="icIn" value="${esc(cur().data.icon || "")}" maxlength="4" style="font-size:28px;text-align:center;width:90px"><button class="btn">決める</button><button type="button" class="btn ghost" id="icClr">外す</button></form>`, (o, close) => {
    $("#icF", o).onsubmit = e => { e.preventDefault(); saveItem(cur(), { ...typed(), icon: $("#icIn", o).value.trim() }); close(); render(); };
    $("#icClr", o).onclick = () => { saveItem(cur(), { ...typed(), icon: "" }); close(); render(); };
    setTimeout(() => $("#icIn", o).select(), 30);
  });
  $("#insImg").onclick = async () => {
    const ta = $("#body"), pos = [ta.selectionStart, ta.selectionEnd];
    const r = await pickImage("本文に画像を入れる"); if (!r) return;
    if ($("#body").hidden) setMode("write");
    ta.selectionStart = pos[0] ?? ta.value.length; ta.selectionEnd = pos[1] ?? ta.value.length;
    insertAtCursor(`\n![](${r})\n`); if (prefs.get("mode-" + id) === "read") setMode("read");
  };
  $("#body").addEventListener("paste", async e => {
    const f = [...(e.clipboardData?.files || [])].find(x => x.type.startsWith("image/")); if (!f) return;
    e.preventDefault(); try { insertAtCursor(`\n![](${await uploadFile(f)})\n`); } catch (err) { toast("画像を入れられませんでした：" + (err.message || err)); }
  });
  const saveBody = debounce(() => { saveItem(cur(), { body: $("#body").value }); saveState("保存しました"); }, 600);
  const saveTitle = debounce(() => { saveItem(cur(), { title: $("#title").value }); saveState("保存しました"); renderSide(); $("#crumbs").lastChild.textContent = " / " + ($("#title").value.trim() || "無題"); }, 500);
  $("#title").oninput = () => { saveState("…"); saveTitle(); };
  $("#title").onkeydown = e => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); setMode("write"); $("#body").focus(); } };
  $("#body").oninput = () => { saveState("…"); saveBody(); };
  const setMode = m => {
    prefs.set("mode-" + id, m);
    $("#body").hidden = m !== "write"; $("#preview").hidden = m !== "read";
    v.querySelectorAll("[data-mode]").forEach(b => b.classList.toggle("on", b.dataset.mode === m));
    if (m === "read") { $("#preview").innerHTML = md($("#body").value) || `<p class="muted">まだ本文はありません。「書く」から書けるよ。</p>`; hydrate($("#preview")); }
  };
  v.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => setMode(b.dataset.mode));
  $("#preview").addEventListener("click", e => {
    const a = e.target.closest("a.wl.missing"); if (!a) return;
    e.preventDefault(); const nid = newItem(null, a.dataset.wl); toast("新しいページを作りました"); go("item/" + nid);
  });
  bindPropEditors(v, fields, () => cur(), saveState);
  $("#moveType").onchange = e => { saveItem(cur(), { ...typed(), type: e.target.value || null }); toast("移しました"); render(); };
  $("#pin").onclick = () => { saveItem(cur(), { ...typed(), pinned: !cur().data.pinned }); render(); };
  const del = $("#delItem");
  del.onclick = () => { if (!del.dataset.arm) { del.dataset.arm = 1; del.textContent = "もう一度押すと削除"; return; } Store.remove(id); toast("削除しました"); go(t ? "type/" + t.id : "pages"); };
  drawBacklinks(id);
  if (navOpts.focusTitle) setTimeout(() => $("#title").focus(), 30);
}
function drawBacklinks(id) {
  const me = Store.get(id), title = (me.data.title || "").trim().toLowerCase();
  const refs = items().filter(i => i.id !== id && (
    (title && (i.data.body || "").toLowerCase().includes("[[" + title + "]]")) ||
    Object.values(i.data.props || {}).includes(id)));
  const outs = [...(me.data.body || "").matchAll(/\[\[([^\]]+)\]\]/g)].map(m => findByTitle(m[1])).filter(Boolean);
  const el = $("#backlinks");
  el.innerHTML = refs.length || outs.length
    ? `${refs.length ? `<div class="muted" style="margin-bottom:4px">このページを参照しているページ（${refs.length}）</div>${refs.map(rowHtml).join("")}` : ""}
       ${outs.length ? `<div class="muted" style="margin:12px 0 4px">このページからのリンク（${outs.length}）</div>${[...new Set(outs)].map(rowHtml).join("")}` : ""}`
    : `<div class="muted">まだつながりはありません。本文に [[ページ名]] と書くとつながるよ。</div>`;
}
function propEditor(f, v) {
  const a = `data-prop="${f.id}" aria-label="${esc(f.name)}"`;
  switch (f.kind) {
    case "number": return `<input type="number" step="any" inputmode="decimal" ${a} value="${esc(v ?? "")}">`;
    case "date": return `<input type="date" ${a} value="${esc(v ?? "")}">`;
    case "url": return `<div class="row" style="flex-wrap:nowrap"><input type="url" inputmode="url" ${a} value="${esc(v ?? "")}" placeholder="https://">${safeUrl(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener" class="iconbtn" aria-label="ひらく">↗</a>` : ""}</div>`;
    case "checkbox": return `<input type="checkbox" ${a} ${v ? "checked" : ""} style="width:20px;height:20px;margin-top:8px">`;
    case "select": return `<select ${a}><option value="">—</option>${(f.options || []).map(o => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    case "multi": return `<div class="multi" ${a}>${(f.options || []).concat((v || []).filter(x => !(f.options || []).includes(x))).map(o => `<label><input type="checkbox" value="${esc(o)}" ${(v || []).includes(o) ? "checked" : ""}>${esc(o)}</label>`).join("")}<input class="newtag" placeholder="＋ 追加" style="width:90px;padding:2px 8px;border-radius:99px" aria-label="${esc(f.name)}を追加"></div>`;
    case "rating": return `<div class="stars" ${a}>${[1, 2, 3, 4, 5].map(n => `<button type="button" data-n="${n}" class="${n <= (+v || 0) ? "on" : ""}" aria-label="${n}">★</button>`).join("")}</div>`;
    case "relation": { const opts = f.target ? itemsOf(f.target) : items(); return `<select ${a}><option value="">—</option>${opts.map(i => `<option value="${i.id}" ${i.id === v ? "selected" : ""}>${esc(titleOf(i))}</option>`).join("")}</select>`; }
    default: return `<input ${a} value="${esc(v ?? "")}">`;
  }
}
function bindPropEditors(v, fields, cur, saveState) {
  const set = (fid, val) => { const r = cur(); saveItem(r, { props: { ...(r.data.props || {}), [fid]: val } }); saveState("保存しました"); };
  fields.forEach(f => {
    const el = v.querySelector(`[data-prop="${f.id}"]`); if (!el) return;
    if (f.kind === "multi") {
      const read = () => [...el.querySelectorAll("input[type=checkbox]:checked")].map(x => x.value);
      el.querySelectorAll("input[type=checkbox]").forEach(c => c.onchange = () => set(f.id, read()));
      const nt = el.querySelector(".newtag");
      nt.onkeydown = e => {
        if (e.key !== "Enter" || e.isComposing) return; e.preventDefault(); const val = nt.value.trim(); if (!val) return;
        const t = Store.get(cur().data.type); const tf = t.data.fields.find(x => x.id === f.id);
        if (!(tf.options || []).includes(val)) { tf.options = [...(tf.options || []), val]; saveType(t, { fields: t.data.fields }); }
        set(f.id, [...new Set([...read(), val])]); render();
      };
    } else if (f.kind === "rating") {
      el.querySelectorAll("button").forEach(b => b.onclick = () => { const n = +b.dataset.n, curV = +(cur().data.props?.[f.id] || 0); const val = n === curV ? 0 : n; set(f.id, val); el.querySelectorAll("button").forEach(x => x.classList.toggle("on", +x.dataset.n <= val)); });
    } else if (f.kind === "checkbox") el.onchange = () => set(f.id, el.checked);
    else if (f.kind === "number") el.onchange = () => set(f.id, el.value === "" ? "" : +el.value);
    else if (["select", "date", "relation"].includes(f.kind)) el.onchange = () => set(f.id, el.value);
    else { const s = debounce(() => set(f.id, el.value), 500); el.oninput = () => { saveState("…"); s(); }; }
  });
}

/* ================= 検索パレット ================= */
function openPalette() {
  toggleSide(false);
  dialog("検索", `<div class="palette"><input id="pq" placeholder="ページや部屋を探す・新しく作る" autocomplete="off"><div class="res" id="pres"></div></div>`, (o, close) => {
    o.querySelector(".dialog").classList.add("palette"); o.querySelector("header").hidden = true; o.querySelector(".body-pad").style.padding = "0";
    const inp = $("#pq", o), res = $("#pres", o); let sel = 0, hits = [];
    const draw = () => {
      const q = inp.value.trim().toLowerCase();
      const ts = types().filter(t => !q || t.data.name.toLowerCase().includes(q)).map(t => ({ href: "#type/" + t.id, icon: t.data.icon, label: t.data.name, sub: "部屋" }));
      const is = items().filter(i => !q || (titleOf(i) + " " + (i.data.body || "")).toLowerCase().includes(q)).sort((a, b) => {
        const at = titleOf(a).toLowerCase().includes(q) ? 0 : 1, bt = titleOf(b).toLowerCase().includes(q) ? 0 : 1; return at - bt || b.updated_at.localeCompare(a.updated_at);
      }).slice(0, 30).map(i => ({ href: "#item/" + i.id, icon: Store.get(i.data.type)?.data.icon || "📄", label: titleOf(i), sub: typeName(i.data.type) }));
      hits = [...ts.slice(0, 6), ...is];
      if (q) hits.push({ create: inp.value.trim(), icon: "＋", label: `「${inp.value.trim()}」というページを作る`, sub: "" });
      sel = Math.min(sel, hits.length - 1);
      res.innerHTML = hits.map((h, i) => `<a href="${h.href || "#"}" data-i="${i}" class="${i === sel ? "sel" : ""}"><span>${esc(h.icon)}</span><span class="sp" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h.label)}</span><span class="muted">${esc(h.sub)}</span></a>`).join("") || `<div class="muted" style="padding:12px">見つかりませんでした</div>`;
    };
    const pick = h => { close(); if (h.create) go("item/" + newItem(null, h.create)); else location.hash = h.href.slice(1); };
    inp.oninput = () => { sel = 0; draw(); };
    inp.onkeydown = e => {
      if (e.isComposing) return;
      if (e.key === "ArrowDown") { sel = Math.min(sel + 1, hits.length - 1); draw(); e.preventDefault(); }
      if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
      if (e.key === "Enter" && hits[sel]) { e.preventDefault(); pick(hits[sel]); }
    };
    res.onclick = e => { const a = e.target.closest("[data-i]"); if (!a) return; e.preventDefault(); pick(hits[+a.dataset.i]); };
    draw(); setTimeout(() => inp.focus(), 20);
  });
}

/* ================= 設定 ================= */
function viewSettings(v) {
  $("#crumbs").innerHTML = `<a href="#">ホーム</a> / 設定`;
  const cloud = Store.adapter?.name === "cloud";
  const theme = prefs.get("theme", "system");
  v.innerHTML = `<h1>⚙️ 設定</h1>
    <h2>ワークスペース</h2>
    <div class="card"><label class="muted" for="wsName">名前</label><input id="wsName" value="${esc(wsName())}">
      <label class="muted" for="theme" style="display:block;margin-top:10px">見た目</label>
      <select id="theme" style="width:auto"><option value="system" ${theme === "system" ? "selected" : ""}>端末に合わせる</option><option value="light" ${theme === "light" ? "selected" : ""}>ライト（白とシルバー）</option><option value="dark" ${theme === "dark" ? "selected" : ""}>ダーク（グラファイト）</option></select>
      <div class="muted" style="margin-top:12px">フォント（どの端末でも同じになるよ）</div>
      <div class="fontpick">${Object.entries(FONTS).map(([k, f]) => `<button class="${(ws().font || "maru") === k ? "on" : ""}" data-font="${k}" style="font-family:${f.css}"><b>${f.label}</b><span>知識の部屋 Aa 123</span></button>`).join("")}</div></div>
    <h2>同期</h2>
    <div class="card">${cloud
      ? `<p>✅ 同期オン：<b id="me"></b> でログイン中。iPad と iPhone で同じメアドでログインすると、同じデータが見られるよ。</p><button class="btn ghost sm" id="signOut">ログアウト</button>`
      : `<p>いまは<b>この端末のブラウザだけ</b>に保存してるよ。同期の準備（Supabase）ができたら、iPad と iPhone で同じメアドでログインして使えるようになる。</p><p class="muted">それまでに書いたものは、はじめてログインしたときに自動でクラウドへ引っ越すよ。</p>`}</div>
    <h2>バックアップ</h2>
    <div class="card"><p>全部のデータを1つのファイルに書き出したり、書き出したファイルから戻したりできるよ。</p>
      <div class="row"><button class="btn" id="exp">書き出す</button><label class="btn ghost" for="imp" style="cursor:pointer">読み込む</label><input type="file" id="imp" accept=".json,application/json" hidden></div>
      <div class="muted" style="margin-top:8px">部屋 ${types().length}・ページ ${items().length}</div></div>`;
  $("#wsName").onchange = e => { saveWs({ name: e.target.value.trim() || "For the Future Lab" }); renderSide(); toast("保存しました"); };
  $("#theme").onchange = e => { prefs.set("theme", e.target.value); applyTheme(); };
  v.querySelectorAll("[data-font]").forEach(b => b.onclick = () => { saveWs({ font: b.dataset.font }); applyFont(); render(); });
  $("#exp").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([Store.exportAll()], { type: "application/json" })); a.download = `future-lab-${today()}.json`; document.body.appendChild(a); a.click(); a.remove(); };
  $("#imp").onchange = async e => { const f = e.target.files[0]; if (!f) return; try { await Store.importAll(await f.text()); toast("読み込みました"); render(); } catch (err) { toast("読み込めませんでした：" + err.message); } };
  if (cloud) { Store.adapter.session().then(s => { const el = $("#me"); if (el) el.textContent = s?.user?.email || ""; }); $("#signOut").onclick = async () => { await Store.adapter.signOut(); location.reload(); }; }
}
const FONTS = {
  maru: { label: "まるゴシック", css: '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", var(--f-sys)', href: "https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;500;700&display=swap" },
  kiwi: { label: "ころころ", css: '"Kiwi Maru", "Hiragino Maru Gothic ProN", var(--f-sys)', href: "https://fonts.googleapis.com/css2?family=Kiwi+Maru:wght@400;500&display=swap" },
  sans: { label: "すっきり", css: "var(--f-sys)", href: "" },
  mincho: { label: "明朝", css: '"Shippori Mincho", "Hiragino Mincho ProN", serif', href: "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;600;700&display=swap" },
};
function applyFont() {
  const f = FONTS[ws().font] || FONTS.maru;
  document.documentElement.style.setProperty("--f-body", f.css);
  if (f.href && !document.querySelector(`link[href="${f.href}"]`)) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = f.href; document.head.appendChild(l); }
}
function applyTheme() { const t = prefs.get("theme", "system"); if (t === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = t; }

/* ================= ログイン（同期オンのとき） ================= */
const AUTH_ERR = m => /Invalid login credentials/i.test(m) ? "メールアドレスかパスワードが違うみたい。" :
  /Email not confirmed/i.test(m) ? "まだメールの確認が済んでいないよ。届いたメールのリンクを押してから、もう一度ログインしてね。" :
  /already registered|already been registered/i.test(m) ? "このメールアドレスはもう登録されてるよ。「ログイン」から入ってね。" :
  /Password should be at least/i.test(m) ? "パスワードは6文字以上にしてね。" :
  /rate limit/i.test(m) ? "短い時間に何度も試したみたい。少し時間をおいてね。" : m;
function viewLogin(mode = "signin") {
  const signup = mode === "signup";
  root.innerHTML = `<div class="login"><h1>For the Future Lab</h1><p class="lead">同じメールアドレスとパスワードでログインすると、iPad と iPhone で同じデータが使えるよ。</p>
    <form id="lf" class="card">
      <label class="muted" for="em">メールアドレス</label><input id="em" type="email" autocomplete="username" inputmode="email" required>
      <label class="muted" for="pw" style="display:block;margin-top:10px">パスワード${signup ? "（6文字以上）" : ""}</label><input id="pw" type="password" autocomplete="${signup ? "new-password" : "current-password"}" minlength="6" required>
      <button class="btn" style="margin-top:14px;width:100%">${signup ? "登録する" : "ログイン"}</button>
    </form>
    <div class="row" style="margin-top:12px;justify-content:space-between">
      <button class="btn ghost sm" id="switch">${signup ? "登録済みの人はこちら（ログイン）" : "はじめて使う人はこちら（登録）"}</button>
      ${signup ? "" : `<button class="btn ghost sm" id="forgot">パスワードを忘れた</button>`}
    </div>
    <p class="muted" id="lmsg" role="status"></p></div>`;
  const msg = t => $("#lmsg").textContent = t;
  $("#switch").onclick = () => viewLogin(signup ? "signin" : "signup");
  const fg = $("#forgot"); if (fg) fg.onclick = async () => {
    const email = $("#em").value.trim(); if (!email) { msg("先にメールアドレスを入れてね。"); $("#em").focus(); return; }
    try { await Store.adapter.resetPassword(email); msg(`${email} に再設定のメールを送ったよ。リンクを押すと、新しいパスワードを決められる。`); } catch (e) { msg(AUTH_ERR(e.message)); }
  };
  $("#lf").onsubmit = async e => {
    e.preventDefault(); const email = $("#em").value.trim(), pw = $("#pw").value;
    msg(signup ? "登録しています…" : "ログインしています…");
    try {
      if (signup) {
        const ready = await Store.adapter.signUp(email, pw);
        if (!ready) { msg(`${email} に確認メールを送ったよ。メールのリンクを押したら、この画面の「ログイン」から入ってね。（迷惑メールのフォルダも見てみて）`); return; }
      } else await Store.adapter.signIn(email, pw);
      await Store.loadCloud(); start();
    } catch (err) { msg(AUTH_ERR(err.message || String(err))); }
  };
}
function viewNewPassword() {
  root.innerHTML = `<div class="login"><h1>新しいパスワード</h1><form id="np" class="card"><label class="muted" for="npw">新しいパスワード（6文字以上）</label><input id="npw" type="password" autocomplete="new-password" minlength="6" required><button class="btn" style="margin-top:14px;width:100%">決める</button></form><p class="muted" id="lmsg" role="status"></p></div>`;
  $("#np").onsubmit = async e => { e.preventDefault(); try { await Store.adapter.updatePassword($("#npw").value); history.replaceState(null, "", location.pathname); await Store.loadCloud(); start(); toast("パスワードを変えました"); } catch (err) { $("#lmsg").textContent = AUTH_ERR(err.message); } };
}

/* ================= 起動 ================= */
function start() {
  applyFont(); shell(); render();
  Store.on(msg => {
    if (msg === "remote") {
      renderSide();
      const r = route(), a = document.activeElement;
      const editing = a && $("#view")?.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName);
      if (!editing && r.name !== "item") render();
    }
    if (msg && msg.error) { const d = $("#syncDot"), t = $("#syncText"); if (d) d.className = "dot err"; if (t) t.textContent = "保存できませんでした"; toast(msg.error); }
    if (msg === "saved") { const d = $("#syncDot"); if (d && d.classList.contains("err")) renderSide(); }
  });
}
addEventListener("hashchange", render);
addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (!$(".overlay")) openPalette(); } });
applyTheme();
(async () => {
  root.innerHTML = `<div class="login"><p class="muted">ひらいています…</p></div>`;
  try {
    const recovering = /type=recovery/.test(location.hash + location.search);
    await Store.init();
    if (Store.status === "signed-out") viewLogin();
    else if (recovering) viewNewPassword();
    else start();
  } catch (e) {
    root.innerHTML = `<div class="login"><h1>ひらけませんでした</h1><p>${esc(e.message || e)}</p><button class="btn" onclick="location.reload()">もう一度</button></div>`;
  }
})();
