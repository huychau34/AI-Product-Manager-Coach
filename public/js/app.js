/* AI PM Coach - app logic
 * Views are plain functions that render HTML into #app. Clicks use data-c="action:arg1,arg2",
 * inputs use data-in="handler:arg". All progress is stored in this browser (localStorage "aipm").
 */
"use strict";
const CFG = Object.assign({ siteUrl: location.origin, posthogKey: "", posthogHost: "https://eu.i.posthog.com", owner: { name: "", role: "", linkedin: "", bio: [] } }, window.APP_CONFIG || {});
const C = window.CONTENT;
const QK = (k) => C.Q.find((q) => q[0] == k);
// The assessment asks only what changes the roadmap. Industry is optional and set on Home ("Your product").
const Q = ["exp", "tech", "ai", "goal", "time"].map(QK);
const LV = ["Beginner", "Basic", "Intermediate", "Advanced"], AIL = ["Beginner", "Beginner+", "Practitioner", "Experienced", "Leader"];
const app = document.getElementById("app"), navEl = document.getElementById("nav");

// ---------------- Storage ----------------
// When accounts are switched on, visitors who aren't signed in are guests: their progress lives
// only for this visit (sessionStorage), so every new visit starts at the visitor page. Only the
// theme and analytics choice are remembered for them. Signed-in learners use localStorage + the cloud.
let S = load();
function guestMode() { try { return !localStorage.getItem("aipm_auth") && (JSON.parse(sessionStorage.getItem("aipm_acc") || "null") || {}).on === true } catch (e) { return false } }
function prefs() { try { return JSON.parse(localStorage.getItem("aipm_prefs") || "{}") || {} } catch (e) { return {} } }
function load() {
  try {
    if (guestMode()) { const g = JSON.parse(sessionStorage.getItem("aipm_g") || "null") || {}, p = prefs(); if (g.theme == null && p.theme) g.theme = p.theme; if (g.consent == null && p.consent) g.consent = p.consent; return g }
    return JSON.parse(localStorage.getItem("aipm") || "null") || prefs();
  } catch (e) { return {} }
}
function saveLocal() {
  try {
    if (guestMode()) { sessionStorage.setItem("aipm_g", JSON.stringify(S)); localStorage.setItem("aipm_prefs", JSON.stringify({ theme: S.theme, consent: S.consent })) }
    else localStorage.setItem("aipm", JSON.stringify(S));
  } catch (e) { }
}
// Progress a guest saved in this browser before guests became visit-only: kept aside and offered to their account when they sign in.
function stashOldGuest() {
  try {
    const raw = localStorage.getItem("aipm"); if (!raw) return false; const o = JSON.parse(raw) || {};
    if (o.profile && !o.acct) localStorage.setItem("aipm_old", raw);
    localStorage.setItem("aipm_prefs", JSON.stringify({ theme: o.theme, consent: o.consent })); localStorage.removeItem("aipm"); return true;
  } catch (e) { return false }
}
function save() { S.updatedAt = Date.now(); S.dirty = (S.dirty || 0) + 1; saveLocal(); if (typeof schedulePush == "function") schedulePush() }
function initState() {
  for (const k of ["done", "chat", "pr", "ref", "rfb", "vs", "vseen", "vr", "open", "days", "rev", "daily", "conf", "ach", "rp", "iv", "steps"]) if (!S[k] || typeof S[k] != "object") S[k] = {};
  if (!S.prd || typeof S.prd != "object") S.prd = { title: "", sec: {}, fb: {} };
  if (!Array.isArray(S.ev)) S.ev = [];
  delete S.T;
  let changed = false;
  if (S.profile && S.ver !== 2) {            // upgrade from the first version: add the new lessons, keep progress
    S.road = buildRoad(S.profile);
    S.newLessons = 1; changed = true;
  }
  S.ver = 2;
  if (S.view == "lesson" && !L(S.cur)) S.view = "home";
  changed ? save() : saveLocal();            // opening the app isn't an edit, so it doesn't trigger a cloud save
}

// ---------------- Helpers ----------------
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])) }
function dkey(d = new Date()) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") }
function addDays(key, n) { const [y, m, d] = key.split("-").map(Number); return dkey(new Date(y, m - 1, d + n)) }
function daysBetween(a, b) { const p = (k) => { const [y, m, d] = k.split("-").map(Number); return Date.UTC(y, m - 1, d) }; return Math.round((p(b) - p(a)) / 864e5) }
function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }
const L = (id) => C.LESSONS.find((l) => l.id == id);
const hasInd = () => !!(S.profile && S.profile.ind != null && S.profile.ind !== 9);
const IND = () => (hasInd() ? QK("ind")[2][S.profile.ind] : "your industry");
const X = () => C.EX[IND()] || "your company";
const fillX = (s) => String(s).replace(/\{x\}/g, X()).replace(/\{ind\}/g, IND());
function info(lessonId) { const p = S.profile || {}; return { page: S.view, exp: p.exp, ind: p.ind ?? 9, tech: p.tech, ai: p.ai, goal: p.goal, lesson: lessonId || null, done: Object.keys(S.done), product: S.product || "" } }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }
function ring(val, max, label, size = 86) { const r = size / 2 - 7, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, max ? val / max : 0)); return `<div class=ring style="width:${size}px;height:${size}px"><svg width=${size} height=${size} aria-hidden=true><circle cx=${size / 2} cy=${size / 2} r=${r} fill=none stroke="var(--soft)" stroke-width=8 /><circle cx=${size / 2} cy=${size / 2} r=${r} fill=none stroke="url(#rg)" stroke-width=8 stroke-linecap=round stroke-dasharray="${c * p} ${c}"/><defs><linearGradient id=rg><stop offset=0 stop-color="var(--ac)"/><stop offset=1 stop-color="var(--ac2)"/></linearGradient></defs></svg><div class=v>${label}</div></div>` }
// The coach's mark: a small compass (the tour guide). Icons are inline SVG so they follow the theme colours.
const svg = (d, w = 20) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const COMPASS = '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor" fill-opacity=".25"/>';
const mark = (lg) => `<span class="cm ${lg ? "lg" : ""}" aria-hidden="true">${svg(COMPASS, lg ? 24 : 18)}</span>`;
const ICO = {
  home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
  road: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  practice: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  prd: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  progress: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  send: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};
const CHK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="ok" d="M5 12.5l4.5 4.5L19 7.5"/><path class="no" d="M7 7l10 10M17 7L7 17"/></svg>';
// One option tile. A label like "Beginner - I prefer..." becomes a bold title with a hint.
function tileH(o, on, dc, ic, hint, multi, extra) {
  let l = o, d = hint || ""; const k = o.indexOf(" - "); if (!d && k > 0) { l = o.slice(0, k); d = o.slice(k + 3) }
  return `<button type=button class="opt tile ${multi ? "m" : ""} ${on ? "on" : ""} ${extra || ""}" data-c="${dc}" aria-pressed="${!!on}"><span class=ic aria-hidden=true>${ic}</span><span><span class=l>${esc(l)}</span>${d ? `<span class=d>${esc(d)}</span>` : ""}</span><span class=ck>${CHK}</span></button>`
}
function toast(t) { let e = document.getElementById("toast"); if (!e) { e = document.createElement("div"); e.id = "toast"; e.className = "toast"; e.setAttribute("role", "status"); document.body.appendChild(e) } e.textContent = t; e.classList.add("show"); clearTimeout(e._t); e._t = setTimeout(() => e.classList.remove("show"), 2600) }
function download(name, text, type = "text/markdown") { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 500) }

// ---------------- Analytics & activity ----------------
let PH = null; // PostHog, loaded only after consent
function ev(name, props) {
  S.ev.push([name, Date.now()]); if (S.ev.length > 3000) S.ev = S.ev.slice(-3000); saveLocal();
  try { if (PH) PH.capture(name, props || {}) } catch (e) { }
}
const evCount = (n) => S.ev.filter((x) => x[0] == n).length;
function act(kind, props) {                  // a meaningful learning action: counts towards streaks
  const t = dkey(); S.days[t] = (S.days[t] || 0) + 1;
  S.best = Math.max(S.best || 0, streak());
  ev(kind, props); checkAch();
}
function streak() { let d = dkey(); if (!S.days[d]) d = addDays(d, -1); let n = 0; while (S.days[d]) { n++; d = addDays(d, -1) } return n }
function weekStart(k = dkey()) { const [y, m, d] = k.split("-").map(Number); const dt = new Date(y, m - 1, d); const off = (dt.getDay() + 6) % 7; return dkey(new Date(y, m - 1, d - off)) }
function weekCount() { const ws = weekStart(); return Object.keys(S.days).filter((k) => k >= ws && k <= dkey()).length }
const weekTarget = () => [1, 2, 3, 4, 5][S.profile ? S.profile.time : 1];

// ---------------- Achievements ----------------
const nDone = () => (S.road || []).filter((x) => S.done[x.id]).length;
const roadDone = () => !!(S.road && S.road.length && S.road.every((x) => S.done[x.id]));
const prdCount = () => C.PRD.filter((p) => (S.prd.sec[p.id] || "").trim().length >= 40).length;
const ACH = [
  ["first", "🌱", "First steps", "Complete your first lesson", () => nDone() >= 1],
  ["three", "📚", "Getting serious", "Complete 3 lessons", () => nDone() >= 3],
  ["road", "🗺️", "Roadmap complete", "Finish every lesson on your roadmap", roadDone],
  ["deep", "💡", "Deep thinker", "Get a 'Strong answer' on a reflection", () => Object.values(S.rfb).some((o) => Object.values(o || {}).some((f) => f && f.rating == "strong"))],
  ["streak3", "🔥", "On a roll", "Learn 3 days in a row", () => (S.best || 0) >= 3],
  ["streak7", "⚡", "Unstoppable", "Learn 7 days in a row", () => (S.best || 0) >= 7],
  ["daily5", "📅", "Daily habit", "Answer 5 daily challenges", () => Object.values(S.daily).filter((d) => d.done).length >= 5],
  ["review10", "🧠", "Sharp memory", "Get 10 review cards right", () => (S.revOk || 0) >= 10],
  ["mentor10", "💬", "Curious mind", "Send 10 messages to your coach", () => evCount("mentor") >= 10],
  ["rp8", "🎭", "Persuader", "Score 8+ in a role-play", () => Object.values(S.rp).some((r) => (r.best || 0) >= 8)],
  ["iv8", "🎤", "Interview ready", "Score 8+ on an interview question", () => Object.values(S.iv).some((r) => (r.best || 0) >= 8)],
  ["prd", "📝", "PRD author", "Draft every section of the capstone PRD", () => prdCount() == C.PRD.length],
  ["growth", "📈", "Growth mindset", "Raise your confidence by 2+ in a lesson", () => Object.values(S.conf).some((c) => c.post && c.pre && c.post - c.pre >= 2)],
];
function checkAch() {
  for (const [id, e, name, , test] of ACH) if (!S.ach[id]) { let ok = false; try { ok = test() } catch (x) { } if (ok) { S.ach[id] = Date.now(); save(); setTimeout(() => toast(`${e} Achievement unlocked: ${name}`), 900); ev("achievement", { id }) } }
}

// ---------------- AI client (calls the site's /api/ai function) ----------------
const AIERR = {
  not_hosted: "AI features work on the published website. They can't run when the file is opened directly from your computer.",
  offline: "You seem to be offline. Check your connection and try again.",
  rate_limited: "That's a lot of AI requests in a short time. Please wait a minute and try again.",
  daily_limit: "You've reached today's limit for AI features. It resets tomorrow; everything else in the app still works.",
  site_limit: "The AI features are very busy today. Please try again tomorrow.",
  forbidden_origin: "The AI request was blocked because it didn't come from this site.",
  not_set_up: "The AI features aren't set up on this site yet (the /api/ai function wasn't found).",
  missing_api_key: "The AI features aren't configured yet (the site has no Anthropic API key).",
  invalid_api_key: "The AI service rejected the site's API key. The site owner needs to update ANTHROPIC_API_KEY in Netlify and redeploy.",
  no_credit: "The AI service is out of credit. The site owner needs to add credit to the Anthropic account.",
  model_not_found: "The AI model isn't available for this account. The site owner needs to check ANTHROPIC_MODEL.",
  api_permission: "The API key doesn't have permission to use this model.",
  overloaded: "The AI service is very busy right now. Please try again in a minute.",
  empty: "The AI didn't reply. Please try again.",
  login_required: "Sign in with Google to use the AI coach. It's free.",
  bad_format: "The AI reply came back in an unexpected format. Please try again.",
};
const aiErr = (e) => AIERR[e && e.code] || "The AI features are unavailable right now. Please try again in a moment.";
async function ai(payload, onText, retried) {
  let r;
  if (AU && AU.rt && AU.exp && AU.exp - Date.now() < 60000) await refreshToken();
  const h = { "Content-Type": "application/json" }; if (AU && AU.at) h.Authorization = "Bearer " + AU.at;   // AI features need a signed-in learner
  try { r = await fetch("/api/ai", { method: "POST", headers: h, body: JSON.stringify(payload) }) }
  catch (e) { throw { code: /^https?:$/.test(location.protocol) ? "offline" : "not_hosted" } }
  if (!r.ok) { let err = ""; try { err = (await r.json()).error || "" } catch (e) { }
    if (err == "login_required") {
      if (AU && !retried && await refreshToken()) return ai(payload, onText, true);
      ACC.on = true;
      if (AU) endSession("Your session ended. Please sign in again; your progress is saved in your account."); else { renderNav(); wall("ai") }
      throw { code: "login_required" };
    }
    throw { code: r.status == 404 || r.status == 405 || r.status == 501 ? "not_set_up" : AIERR[err] ? err : r.status == 429 ? "rate_limited" : "server_error" } }
  const rd = r.body.getReader(), dec = new TextDecoder(); let text = "";
  for (; ;) { const { done, value } = await rd.read(); if (done) break; text += dec.decode(value, { stream: true }); if (onText) onText(text) }
  if (!text.trim()) throw { code: "empty" };
  return text;
}
async function aiJSON(payload, re = /\{[\s\S]*\}/) { const t = await ai(payload); const m = t.match(re); try { return JSON.parse(m ? m[0] : t) } catch (e) { throw { code: "bad_format" } } }
const list = (v, n = 3) => (Array.isArray(v) ? v : []).map(String).filter(Boolean).slice(0, n);
function normFb(r) { if (!r || typeof r != "object" || !r.summary) throw { code: "bad_format" }; return { rating: ["strong", "good", "developing"].includes(r.rating) ? r.rating : "good", summary: String(r.summary), strengths: list(r.strengths), improve: list(r.improve), example: String(r.example || ""), next: String(r.next || "") } }
function normScore(r) { if (!r || typeof r != "object" || !r.verdict) throw { code: "bad_format" }; const s = Math.round(Number(r.score)); return { score: s >= 1 && s <= 10 ? s : 5, verdict: String(r.verdict), strengths: list(r.strengths), improve: list(r.improve), extra: String(r.better_line || r.model_answer || ""), followup: String(r.followup || "") } }
const RLAB = { strong: ["Strong", "d"], good: ["Good start", "p"], developing: ["Needs more depth", "n"] };
// Shared renderer for AI feedback (reflections and PRD sections)
function fbBox(f, stale, exLabel = "See an example answer") {
  if (!f) return ""; const lab = RLAB[f.rating] || RLAB.good, li = (a) => a.map((x) => `<li>${esc(x)}</li>`).join("");
  return `<div class="rfb r-${f.rating}"><div class=hd><span class="st ${lab[1]}">${lab[0]}</span><p>${esc(f.summary)}</p></div>
${f.strengths.length ? `<h4>What works</h4><ul>${li(f.strengths)}</ul>` : ""}${f.improve.length ? `<h4>To make it stronger</h4><ul>${li(f.improve)}</ul>` : ""}
${f.example ? `<details><summary>${exLabel}</summary><p>${esc(f.example)}</p></details>` : ""}${f.next ? `<p class=nx><b>Think further:</b> ${esc(f.next)}</p>` : ""}
${stale ? `<p class=old>You've edited your text since this feedback. Ask again for an updated review.</p>` : ""}</div>`
}
function scoreBox(r, extraTitle) {
  const li = (a) => a.map((x) => `<li>${esc(x)}</li>`).join("");
  return `<div class="rfb r-${r.score >= 8 ? "strong" : r.score >= 5 ? "good" : "developing"}"><div class=score>${ring(r.score, 10, `${r.score}<small>/ 10</small>`, 92)}<p style="flex:1;min-width:200px;margin:0;font-weight:600">${esc(r.verdict)}</p></div>
${r.strengths.length ? `<h4>What worked</h4><ul>${li(r.strengths)}</ul>` : ""}${r.improve.length ? `<h4>To score higher</h4><ul>${li(r.improve)}</ul>` : ""}
${r.extra ? `<h4>${extraTitle}</h4><div class=outline>${esc(r.extra)}</div>` : ""}${r.followup ? `<p class=nx><b>Likely follow-up:</b> ${esc(r.followup)}</p>` : ""}</div>`
}

// ---------------- Navigation ----------------
const A = {};                                // click actions, called via data-c="name:args"
const IN = {};                               // input handlers, called via data-in="name:arg"
// ---------------- Sign-in wall: guests get the assessment, roadmap and first lesson; AI needs an account ----------------
const guest = () => ACC.on && !AU;
const locked = () => guest();             // guests can take the assessment and see their plan; lessons need an account
function wall(kind) {
  if (document.getElementById("wall")) return;
  const t = kind == "lesson"
    ? ["", "Sign in to start learning", "Your plan is ready. Sign in with Google to save it and start your lessons, with your AI coach alongside."]
    : ["", "Sign in to use your AI coach", "Your coach, reflection feedback, fresh practice questions, the simulators and the PRD review are for signed-in learners."];
  const d = document.createElement("div"); d.id = "wall"; d.className = "wall"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "wallH");
  d.innerHTML = `<div class="card wall-c">${mark(true)}<h2 id=wallH>${t[1]}</h2><p class=help>${t[2]} It's free and takes a few seconds. Without an account, your plan is kept only until you close this page.</p><button class=btn data-c=signin>Continue with Google</button><button class=lnk data-c=wallClose>Not now</button></div>`;
  d.addEventListener("click", (e) => { if (e.target === d) A.wallClose() });
  document.body.append(d); ev("wall_shown", { kind }); const b = d.querySelector(".btn"); if (b) b.focus();
}
A.wallClose = () => { const w = document.getElementById("wall"); if (w) w.remove() };
document.addEventListener("keydown", (e) => { if (e.key != "Escape") return; if (document.getElementById("wall")) A.wallClose(); else if (document.querySelector(".done-moment")) A.doneClose(); else if (document.querySelector(".guide")) endTour(); else if (CO) A.coachClose() });
const needAcc = (kind = "ai") => { if (!guest()) return false; wall(kind); return true };
const lockTxt = (t) => (guest() ? "🔒 " : "") + t;
let V = {};                                  // views
function go(v, cur) { if (v != "admin") leaveAdminURL(); S.view = v; if (cur !== undefined) S.cur = cur; saveLocal(); render(); window.scrollTo(0, 0) }
A.go = go;
function render() {
  const view = V[S.view] ? S.view : (S.profile ? "home" : "land");
  if ((view == "home" || view == "road" || view == "lesson" || view == "progress" || view == "review") && !S.profile) { S.view = "land"; return render() }
  S.view = view; document.body.dataset.view = view; renderNav(); clearTour(); V[view](); coachSync();
  try { if (PH) PH.capture("$pageview", { view }) } catch (e) { }
}
function renderNav() {
  const tabs = S.profile ? [["home", "Today"], ["road", "Plan"], ["practice", "Practice"], ["prd", "Capstone"], ["progress", "Progress"]] : [];
  document.body.classList.toggle("has-tabs", !!S.profile);
  const due = dueCards().length, act = { lesson: "road", rp: "practice", iv: "practice", review: "home", quiz: "", prof: "", account: "" }[S.view] ?? S.view;
  navEl.innerHTML = `<div class=nav-in><button class=brand data-c="go:${S.profile ? "home" : "land"}" aria-label="AI PM Coach home"><span class=logo-m aria-hidden=true>${svg('<path d="M5 12l4 4 10-10"/>', 14)}</span><span>AI PM Coach</span></button>
<nav class=nav-links aria-label="Main">${tabs.map(([v, t]) => `<button data-c="go:${v}" class="${act == v ? "on" : ""}" ${act == v ? 'aria-current="page"' : ""}><span class=ti>${svg(ICO[v], 22)}</span>${t}${v == "home" && due ? `<span class=ct aria-label="${due} review cards due">${due}</span>` : ""}</button>`).join("")}</nav>
<span class=nav-r>${AU ? `<button class=theme-btn data-c="go:account" aria-label="Your account" title="${esc(AU.email || "")}">${svg(ICO.user, 18)}<span class=acct-l>${esc((AU.name || AU.email || "Account").split(/[ @]/)[0])}</span></button>` : ACC.on ? `<button class="theme-btn" data-c="go:account">Sign in</button>` : ""}<button class=theme-btn data-c="theme" aria-label="Switch colour theme">${svg((S.theme || "dark") == "dark" ? ICO.sun : ICO.moon, 18)}</button></span></div>`
}
function applyTheme() { document.documentElement.setAttribute("data-theme", S.theme || "dark") }   // dark unless the learner chose light
A.theme = () => { S.theme = (S.theme || "dark") == "dark" ? "light" : "dark"; save(); applyTheme(); renderNav() };
// Admin is hidden from the UI: open it at /admin, /administrator or #admin.
function isAdminURL() { return /\/(admin|administrator)\/?$/i.test(location.pathname) || /^#\/?(admin|administrator)$/i.test(location.hash) }
function leaveAdminURL() { if (!isAdminURL()) return; try { history.replaceState(null, "", location.pathname.replace(/\/(admin|administrator)\/?$/i, "/") + location.search) } catch (e) { location.hash = "" } }
addEventListener("hashchange", () => { if (isAdminURL()) go("admin") });

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-c]"); if (!el || el.disabled) return;
  e.preventDefault();
  const [name, ...rest] = el.getAttribute("data-c").split(":"), argStr = rest.join(":");
  const args = argStr ? argStr.split(",").map((a) => (/^-?\d+$/.test(a) ? +a : a)) : [];
  if (A[name]) A[name](...args, el); else console.warn("Unknown action", name);
});
document.addEventListener("input", (e) => {
  const el = e.target.closest("[data-in]"); if (!el) return;
  const [name, arg] = el.getAttribute("data-in").split(":"); if (IN[name]) IN[name](el, arg);
});
document.addEventListener("keydown", (e) => {
  const el = e.target;
  if (el && el.dataset && el.dataset.enter && e.key == "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); const f = A[el.dataset.enter]; if (f) f() }
});

// ================= Landing =================
V.land = () => {
  if (!S.ev.length) ev("visit");
  document.title = "AI PM Coach - learn to build AI products";
  const resume = S.draft && !S.profile, o = CFG.owner || {};
  const cta = S.profile ? `<button class=btn data-c="go:home">Go to today's plan</button>` : `<button class=btn data-c="startQuiz">${resume ? `Resume my answers (question ${S.draft.qi + 1} of ${Q.length})` : "Build my plan"}</button>`;
  const ex = [1, 2, 3, 4, 5, 6].map((st) => `<li><b>${C.STAGES[st]}</b><span>${C.LESSONS.filter((l) => l.stage == st).map((l) => esc(l.title)).join(" · ")}</span></li>`).join("");
  app.innerHTML = `<section class=a-hero><p class=kicker>AI PM Coach</p><h1>Learn to build AI products, one short lesson at a time.</h1>
<p class="soft lead">A personal plan for product managers. Short lessons with a video, a clear explanation and practice in your industry, and a coach on every page to answer your questions.</p>
<div class="row l" style="margin-top:22px">${cta}<span class=mu>5 questions · about a minute · free</span></div></section>
<div class=a-cols><section class=a-main><h2 class=sec-h>An example plan</h2><p class="mu" style="margin-top:0">For a PM with a few years' experience and 3 to 5 hours a week. Yours is shaped by your answers.</p><ol class=plan-ex>${ex}</ol></section>
<aside class=a-side><h2 class=sec-h>How it works</h2><ol class=how><li><b>First</b><span>Answer 5 questions about your experience, goal and time.</span></li><li><b>Then</b><span>Follow your plan: about 20 minutes a lesson, or one question on busy days.</span></li><li><b>Finally</b><span>Practise real conversations and write an AI PRD you can show employers.</span></li></ol>
<h2 class=sec-h style="margin-top:28px">Along the way</h2><ul class=plain><li>A coach in the corner of every page</li><li>Role-play and interview simulators, scored</li><li>Questions you miss come back until they stick</li></ul></aside></div>
${o.name ? `<p class="mu owner">Made by ${esc(o.name)}${o.role ? ", " + esc(o.role) : ""}. <button class=lnk data-c="go:about">About the app</button></p>` : ""}
${S.profile ? "" : `<p class=a-end><button class=btn data-c="startQuiz">Build my plan</button></p>`}`
};

// ================= Assessment =================
let QZ = null; // {qi, ans, edit}
A.startQuiz = () => { ev("assess_start"); QZ = S.draft && !S.profile ? S.draft : { qi: 0, ans: {} }; go("quiz") };
A.editProfile = () => { QZ = { qi: 0, ans: JSON.parse(JSON.stringify(S.profile || {})), edit: true }; go("quiz") };
V.quiz = () => {
  if (!QZ) QZ = S.draft || { qi: 0, ans: {} };
  const q = Q[QZ.qi], m = q[3], cur = QZ.ans.hasOwnProperty(q[0]) ? QZ.ans[q[0]] : (m ? [] : null);
  document.title = "Assessment · AI PM Coach";
  const nudge = ["About 30 seconds", "", "", "Nearly done", "Last one"][QZ.qi] || "";
  app.innerHTML = `<div class=bar role=progressbar aria-valuemin=0 aria-valuemax=${Q.length} aria-valuenow=${QZ.qi}><i style="width:${QZ.qi / Q.length * 100}%"></i></div>
<p class=mu>${QZ.edit ? "Editing your answers · " : ""}Question ${QZ.qi + 1} of ${Q.length} <span class=nudge>${nudge}</span>${m ? " · select all that apply" : ""}</p><h2>${q[1]}</h2>
${q[4] ? `<p class=help>${q[4]}</p>` : ""}
<div class=tiles role=group aria-label="${esc(q[1])}">${q[2].map((o, i) => { const mt = (C.QI[q[0]] || [])[i] || ["•", ""]; return tileH(o, m ? cur.includes(i) : cur === i, `pick:${i}`, mt[0], mt[1], m) }).join("")}</div>
<p class=err id=qerr></p>
<div class=row><button class="btn g" data-c="qback">Back</button><button class=btn data-c="qnext">${QZ.qi == Q.length - 1 ? (QZ.edit ? "Save answers" : "Finish") : "Next"}</button></div>`
};
A.pick = (i) => {
  const q = Q[QZ.qi];
  if (q[3]) { let a = QZ.ans.hasOwnProperty(q[0]) ? QZ.ans[q[0]] : []; const none = q[2].findIndex((o) => /^None of these/.test(o)); if (a.includes(i)) a = a.filter((x) => x != i); else a = i === none ? [i] : a.filter((x) => x !== none).concat(i); QZ.ans[q[0]] = a }
  else QZ.ans[q[0]] = i;
  const cur = QZ.ans[q[0]];
  $$("#app .opt").forEach((b, j) => { const on = q[3] ? cur.includes(j) : cur === j; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on) });
  $("#qerr").textContent = "";
  if (!QZ.edit) { S.draft = QZ; save() }
};
A.qback = () => { if (QZ.qi) { QZ.qi--; if (!QZ.edit) { S.draft = QZ; save() } V.quiz() } else { QZ = null; go(S.profile ? "prof" : "land") } };
A.qnext = () => {
  const q = Q[QZ.qi], v = QZ.ans.hasOwnProperty(q[0]) ? QZ.ans[q[0]] : null;
  if (v == null || (q[3] && !v.length)) { $("#qerr").textContent = q[3] ? "Pick at least one option." : "Pick an option to continue."; return }
  if (QZ.qi < Q.length - 1) { QZ.qi++; if (!QZ.edit) { S.draft = QZ; save() } V.quiz(); window.scrollTo(0, 0); return }
  const editing = QZ.edit && S.profile;
  S.profile = QZ.ans; delete S.draft; QZ = null;
  if (editing) { S.road = buildRoad(S.profile); S.w = [.75, 2, 4, 7, 12][S.profile.time]; save(); ev("profile_edit"); go("road"); toast("Plan updated. Your progress is kept") }
  else { ev("assess_done"); go("prof") }
};

// ================= Profile =================
function buildRoad(p) {
  let t = C.LESSONS.filter((l) => l.stage <= 6 && !(p.ai >= 3 && l.stage == 1) && !(p.ai >= 2 && l.id == "prompt"));
  if (p.time == 0) t = t.filter((l) => ["llm", "disc", "rag", "eval"].includes(l.id) || (p.ai >= 3 && ["pat", "strat"].includes(l.id))).slice(0, 4);
  else if (p.time == 1) t = t.filter((l) => l.prio < 3 || [3, 4].includes(p.goal));
  if (p.goal == 2) t = t.concat(C.LESSONS.filter((l) => l.id == "pjob"));
  return t.map((l) => ({ id: l.id, d: p.tech == 3 && l.stage <= 2 ? "Skim" : p.ai >= 3 ? "Deep dive" : "Standard" }));
}
function strengths(p) {
  const r = p.roles || [], tt = p.techt || [], s = [];
  s.push(p.exp >= 2 ? "Product strategy experience" : "Fresh product perspective");
  if (p.tech >= 2 || r.includes(3) || tt.includes(5)) s.push("Technical collaboration");
  if (tt.includes(4) || tt.includes(1)) s.push("Data literacy");
  if (p.ai >= 3) s.push("AI feature delivery"); else if (p.ai >= 1) s.push("Hands-on AI tool use");
  if (r.includes(7) || r.includes(8) || p.exp >= 3) s.push("Product leadership");
  if (r.includes(2) || r.includes(5)) s.push("Agile delivery");
  if (r.includes(6)) s.push("Requirements & analysis");
  return s.slice(0, 4);
}
const AXES = ["Fundamentals", "Discovery", "Design", "RAG & data", "Eval & ops", "Strategy"];
function skills() {
  const p = S.profile, at = p.ait || [], has = (i) => at.includes(i);
  const base = {
    1: [.5, 1.5, 2, 3, 3.5][p.ai] + (has(0) ? .5 : 0) + (has(1) ? .5 : 0), 2: [1, 1.5, 2, 2.5, 3][p.exp] + (p.ai >= 2 ? .5 : 0),
    3: [.5, 1, 1.5, 2.5, 3][p.ai] + (has(5) ? .5 : 0), 4: .5 + (has(2) ? .5 : 0) + (has(3) ? 1 : 0) + (has(4) ? .5 : 0) + (has(7) ? .5 : 0) + (p.tech >= 2 ? .5 : 0),
    5: .5 + (has(6) ? 1.5 : 0) + (p.ai >= 3 ? .5 : 0), 6: [1, 1.5, 2, 2.5, 3][p.exp] + (p.goal == 3 ? .5 : 0)
  };
  const target = [3, 4].includes(p.goal) ? 5 : 4, cur = {};
  for (let s = 1; s <= 6; s++) { const b = Math.min(target, base[s]), inS = (S.road || []).filter((x) => L(x.id) && L(x.id).stage == s), dn = inS.filter((x) => S.done[x.id]).length; cur[s] = inS.length ? b + (target - b) * dn / inS.length : Math.min(target, b + .5) }
  return { cur, target };
}
function radar() {
  const { cur, target } = skills(), R = 104, cx = 180, cy = 140, pt = (i, v) => { const a = -Math.PI / 2 + i * Math.PI / 3; return [cx + Math.cos(a) * R * v / 5, cy + Math.sin(a) * R * v / 5] };
  const poly = (vals) => vals.map((v, i) => pt(i, v).map((n) => n.toFixed(1)).join(",")).join(" ");
  const grid = [1, 2, 3, 4, 5].map((g) => `<polygon points="${poly(Array(6).fill(g))}" fill=none stroke="var(--bd)" />`).join("");
  const labels = AXES.map((t, i) => { const [x, y] = pt(i, 6.1); return `<text x="${x.toFixed(0)}" y="${(y + 3).toFixed(0)}" text-anchor="middle">${t}</text>` }).join("");
  return `<svg class=radar viewBox="0 0 360 290" role=img aria-label="Skill radar: your estimated level across six areas compared with your target">${grid}
<polygon points="${poly(Array(6).fill(target))}" fill="none" stroke="var(--ac2)" stroke-dasharray="4 4" stroke-width=1.5 />
<polygon points="${poly([1, 2, 3, 4, 5, 6].map((s) => cur[s]))}" fill="rgba(13,148,136,.25)" stroke="var(--ac)" stroke-width=2 />${labels}</svg>
<div class=legend><span><i style="background:var(--ac)"></i>You now (estimated)</span><span><i style="background:var(--ac2)"></i>Your target</span></div>`
}
function devAreas() { const { cur } = skills(); return Object.entries(cur).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([s]) => AXES[s - 1]) }
V.prof = () => {
  const p = S.profile, first = !S.road;
  document.title = "Your profile · AI PM Coach";
  app.innerHTML = `<span class=eyebrow>Your profile</span><h1>Your AI PM profile</h1>
<div class=card><b style="font-size:1.15rem">${QK("exp")[2][p.exp]} PM${hasInd() ? " · " + esc(IND()) : ""}</b><p>AI experience: <b>${AIL[p.ai]}</b><br>Technical confidence: <b>${LV[p.tech]}</b><br>Goal: <b>${QK("goal")[2][p.goal]}</b><br>Pace: <b>${QK("time")[2][p.time]} a week</b></p>
<p class=mu style="margin-bottom:4px">Strengths from your answers</p>${strengths(p).map((t) => `<span class=tag>${t}</span>`).join("")}
<p class=mu style="margin:14px 0 4px">Biggest growth areas</p>${devAreas().map((t) => `<span class=tag>${t}</span>`).join("")}
<p style="margin:14px 0 0"><button class=lnk data-c="editProfile">Edit my answers</button></p></div>
<div class=card><span class=eyebrow>Skill radar</span>${radar()}<p class=help>Estimated from your answers. It grows as you complete lessons.</p></div>
${productCard()}
<button class=btn data-c="${first ? "makeRoad" : "go:road"}">${first ? "See my plan" : "Back to my plan"}</button>`
};
function productCard() {
  return `<div class=card><span class=eyebrow>My product (optional)</span><p class=help>Describe the product you work on in one or two sentences. The AI Mentor, reflections, simulators and new questions will use it in their examples. Don't include confidential details.</p>
<textarea rows=3 maxlength=300 data-in="product" placeholder="e.g. A B2B invoicing app for small businesses in the Nordics, used by 5,000 accountants.">${esc(S.product || "")}</textarea>
<label class=fl for=indSel style="margin-top:10px">Industry <span class=mu>(optional, used for examples)</span></label><select id=indSel data-in="ind"><option value="">Not set</option>${QK("ind")[2].slice(0, 9).map((t, i) => `<option value="${i}" ${S.profile && S.profile.ind === i ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
<p class=sub id=prodSaved>${S.product ? "Saved." : ""}</p></div>`
}
IN.ind = (el) => { if (!S.profile) return; if (el.value === "") delete S.profile.ind; else S.profile.ind = +el.value; save(); const s = $("#prodSaved"); if (s) s.textContent = "Saved."; ev("industry_set") };
IN.product = (el) => { S.product = el.value.slice(0, 300); save(); const s = $("#prodSaved"); if (s) s.textContent = "Saved on this device."; clearTimeout(IN._pt); IN._pt = setTimeout(() => ev("product_set"), 1500) };
A.makeRoad = () => { S.road = buildRoad(S.profile); S.w = [.75, 2, 4, 7, 12][S.profile.time]; ev("roadmap"); go("home"); toast("Your plan is ready") };

// ================= Home dashboard =================
function nextLesson() { const r = S.road || []; if (S.cur && r.some((x) => x.id == S.cur) && !S.done[S.cur] && S.open[S.cur]) return S.cur; const n = r.find((x) => !S.done[x.id]); return n ? n.id : null }
V.home = () => {
  if (!S.road) { go("prof"); return }
  document.title = "Today · AI PM Coach";
  const nx = nextLesson(), l = nx && L(nx), due = dueCards().length, done = roadDone(), pc = prdCount();
  const hr = new Date().getHours(), hi = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening", nm = AU && AU.name ? AU.name.split(" ")[0] : "";
  const pos = l ? S.road.findIndex((x) => x.id == nx) + 1 : 0;
  app.innerHTML = `<div class=a-cols><div class=a-main>
<div id=t-hello class=hello>${mark(true)}<div><h1>${hi}${nm ? ", " + esc(nm) : ""}.</h1><p class=soft>${done ? "You've finished every lesson in your plan." : `You've finished ${nDone()} of ${S.road.length} lessons.`}</p></div></div>
${guest() ? `<div class="note-c"><b>Sign in to start your first lesson.</b><p class=help>It's free. Without an account, your plan is kept only until you close this page.</p><button class="btn sm" data-c=signin>Continue with Google</button></div>` : ""}
${S.newLessons ? `<div class="note-c"><b>New lessons were added to your plan</b><p class=help>AI UX & trust, data strategy, prompting vs RAG vs fine-tuning, responsible AI, launching & monitoring, and pricing. Your progress is kept.</p><button class="btn sm" data-c="go:road">See my plan</button> <button class=lnk data-c="dismissNew">Dismiss</button></div>` : ""}
${l ? `<section id=t-next class="card a-card"><p class="mu m0">${S.open[nx] ? "Continue where you stopped" : "Next up"} · lesson ${pos} of ${S.road.length} · ${C.STAGES[l.stage]}</p><h2>${esc(l.title)}</h2><p class=soft>${esc(l.why)}</p><p class=mu>About ${l.min} minutes</p><button class=btn data-c="openL:${nx}">${S.open[nx] ? "Continue the lesson" : "Start the lesson"}</button></section>` : whatsNextH()}
<section id=t-chat class=coachcard><div class=say>${mark()}<div id=hcBody>${coachCardH()}</div></div></section>
${S.product ? "" : productCard()}
</div><aside class="a-side side">
<section id=t-week>${homeStats()}</section>
<section><h3>To review</h3>${due ? `<p class=m0>${due} question${due > 1 ? "s" : ""} you missed before.</p><p><button class="btn sm g" data-c="revStart">Review now</button></p>` : `<p class="mu m0">Nothing due. ${nextDueText()}</p>`}</section>
<section><h3>Practice</h3><p class="mu m0">Pitch a sceptical CFO, handle an incident or answer timed interview questions.</p><p><button class="btn sm g" data-c="go:practice">Open the studio</button></p></section>
<section><h3>Your capstone</h3><p class=m0>${pc} of ${C.PRD.length} sections drafted</p><div class="dots" aria-hidden=true>${C.PRD.map((x, k) => `<span class="${k < pc ? "on" : ""}"></span>`).join("")}</div><p><button class="btn sm g" data-c="go:prd">${pc ? "Continue" : "Start"} the capstone</button></p></section>
</aside></div>`;
  if (!S.toured) setTimeout(tour, 400);
};
function homeStats() {
  const wk = weekCount(), tg = weekTarget(), st = streak();
  return `<h3>This week</h3><p class=wk><b>${Math.min(wk, 99)}</b> <span class=mu>of ${tg} day${tg > 1 ? "s" : ""}</span></p><div class=dots aria-hidden=true>${Array.from({ length: tg }, (_, k) => `<span class="${k < wk ? "on" : ""}"></span>`).join("")}</div>
<p class="mu sm">${wk >= tg ? "Goal reached. Anything more is a bonus." : `${tg - wk} more learning day${tg - wk == 1 ? "" : "s"} reaches your goal.`}${st > 1 ? ` ${st} days in a row.` : ""}</p>`
}
// "How much time do you have?" 20 minutes opens the lesson; 5 minutes shows today's question right here.
let HC = 0;
function coachCardH() {
  const nx = nextLesson(), dd = (S.daily[dkey()] || {}).done;
  if (HC || dd) return `<p class=m0>${dd ? "Today's question is done, so today counts as a learning day." : "Then let's do one question. It still counts as a learning day."}</p><div id=daily>${dailyH()}</div>${dd && nx ? `<p class=m0><button class=lnk data-c="openL:${nx}">Found more time? Open the lesson</button></p>` : ""}`;
  return `<p class=m0>How much time do you have today?</p><div class=quick><button data-c=hcFull>${nx ? "About 20 minutes" : "20 minutes or more"}</button><button data-c=hcShort>Only 5 minutes</button></div>`;
}
A.hcFull = () => { const nx = nextLesson(); ev("coach_time", { t: 20 }); if (nx) A.openL(nx); else go("practice") };
A.hcShort = () => { HC = 1; ev("coach_time", { t: 5 }); const el = $("#hcBody"); if (el) el.innerHTML = coachCardH() };
// After the whole plan is done: add lessons, write the capstone, practise, keep it fresh.
function whatsNextH() {
  const extra = C.LESSONS.filter((l) => !(S.road || []).some((x) => x.id == l.id)).length, pc = prdCount(), due = dueCards().length;
  const row = (t, d, b) => `<li><div><b>${t}</b><span class=mu>${d}</span></div>${b}</li>`;
  return `<section id=t-next class="card a-card"><p class="mu m0">Your plan is complete</p><h2>What's next</h2><p class=soft>You've built the foundations. Here's how to keep going.</p><ul class=next-list>
${extra ? row("Add more lessons", `${extra} lesson${extra > 1 ? "s aren't" : " isn't"} in your plan yet.`, `<button class="btn sm" data-c=goMore>Choose lessons</button>`) : ""}
${row("Write your capstone PRD", `${pc} of ${C.PRD.length} sections drafted. It's the piece to show employers.`, `<button class="btn sm g" data-c="go:prd">${pc ? "Continue" : "Start"}</button>`)}
${row("Practise real conversations", "Role-play a sceptical CFO or answer timed interview questions.", `<button class="btn sm g" data-c="go:practice">Open the studio</button>`)}
${row("Keep it fresh", due ? `${due} review question${due > 1 ? "s" : ""} waiting, plus a new daily question.` : "A new question every day, and missed questions come back.", due ? `<button class="btn sm g" data-c=revStart>Review</button>` : `<button class="btn sm g" data-c=hcShort>Today's question</button>`)}
</ul></section>`
}
A.goMore = () => { go("road"); setTimeout(() => A.jump("more"), 60) };
function moreLessonsH() {
  if (!S.road) return "";
  const extra = C.LESSONS.filter((l) => !S.road.some((x) => x.id == l.id));
  if (!extra.length) return "";
  return `<div class=stage-h id=more><h2>More lessons you can add</h2><span class=sub>Not in your plan yet</span></div>` + extra.map((l) => `<div class="card lcard"><div class=body><b>${esc(l.title)}</b><span class=sub>${l.min} min · ${C.STAGES[l.stage]}</span></div><button class="btn sm g go" data-c="addL:${l.id}">Add to my plan</button></div>`).join("");
}
A.addL = (id) => {
  if (!L(id) || !S.road || S.road.some((x) => x.id == id)) return;
  S.road.push({ id, d: S.profile && S.profile.ai >= 3 ? "Deep dive" : "Standard" }); save(); ev("lesson_add", { id }); render(); toast(`Added "${L(id).title}" to your plan`);
};

// ---------------- First-visit tour (Home) ----------------
const TOUR = [
  ["t-hello", "Hi, I'm your coach. Let me show you around: three stops, about 15 seconds."],
  ["t-next", "Stop 1: your next lesson. There's always one main thing to do, and it's here."],
  ["t-chat", "Stop 2: short on time? Tell me here and I'll find something that fits."],
  ["t-week", "Stop 3: your week. A few learning days a week is the goal. After that, I'm in the corner of every page if you need me."],
];
let TI = 0;
function clearTour() { document.body.classList.remove("touring"); $$(".spot").forEach((e) => e.classList.remove("spot")); $$(".guide,.tour-dim").forEach((e) => e.remove()) }
function tour() {
  clearTour(); if (S.toured || S.view != "home" || document.getElementById("wall")) return;
  if (TI >= TOUR.length) { endTour(); return }
  const [id, text] = TOUR[TI], el = document.getElementById(id); if (!el) { TI++; return tour() }
  document.body.classList.add("touring");   // page animations create layers that would sit under the dimmer
  const dim = document.createElement("div"); dim.className = "tour-dim"; dim.addEventListener("click", endTour); document.body.appendChild(dim);
  el.classList.add("spot");
  const g = document.createElement("div"); g.className = "guide"; g.setAttribute("role", "dialog"); g.setAttribute("aria-label", "Welcome tour");
  g.innerHTML = `<div class=say>${mark()}<p class=m0>${esc(text)}</p></div><div class=guide-foot><span class="mu sm">${TI + 1} of ${TOUR.length}</span><span class=row><button class=lnk data-c=tourEnd>Skip</button><button class="btn sm" data-c=tourNext>${TI == TOUR.length - 1 ? "Got it" : "Next"}</button></span></div>`;
  el.insertAdjacentElement("afterend", g);
  g.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  g.querySelector(".btn").focus({ preventScroll: true });
}
function endTour() { S.toured = 1; TI = 0; save(); clearTour(); ev("tour_done") }
A.tourNext = () => { TI++; tour() };
A.tourEnd = endTour;
A.dismissNew = () => { delete S.newLessons; save(); render() };
function nextDueText() { const d = Object.values(S.rev).map((c) => c.due).sort()[0]; if (!d) return "Missed practice questions will appear here."; const n = daysBetween(dkey(), d); return `Next card due in ${n} day${n == 1 ? "" : "s"}.` }

// ---------------- Daily challenge ----------------
function pool() { return C.LESSONS.flatMap((l) => l.qs.map((q, i) => ({ lid: l.id, i, q }))) }
function todayQ() { const p = pool(); return p[hash(dkey() + "-aipm") % p.length] }
function dailyH() {
  const t = dkey(), it = todayQ(), q = it.q, d = S.daily[t] || { a: [] }, m = q.c.length > 1, sel = d.a || [];
  const top = `<div class=row><span class=eyebrow>Today's 1-minute challenge</span><span class=sub>${esc(L(it.lid).title)}</span></div><p><b>${esc(fillX(q.q))}</b>${m ? " <span class=sub>· select all that apply</span>" : ""}</p>`;
  const tiles = `<div class="tiles pr">${q.o.map((o, j) => tileH(o, !d.done && sel.includes(j), `dpick:${j}`, String.fromCharCode(65 + j), "", m, d.done ? (q.c.includes(j) ? "good" : sel.includes(j) ? "bad" : "dim") : "")).join("")}</div>`;
  if (d.done) return top + tiles + `<p><b>${d.ok ? "Correct." : "Not quite."}</b> ${esc(q.e)}</p><p class=sub>${d.ok ? "" : "This question was added to your smart review. "}Come back tomorrow for a new challenge.</p>`;
  return top + tiles + `<button class=btn data-c="dcheck" ${sel.length ? "" : "disabled"}>Check answer</button>`;
}
A.dpick = (j) => { const t = dkey(), q = todayQ().q, d = S.daily[t] = S.daily[t] || { a: [] }; if (d.done) return; d.a = q.c.length > 1 ? (d.a.includes(j) ? d.a.filter((x) => x != j) : d.a.concat(j)) : [j]; save(); $$("#daily .opt").forEach((b, n) => { b.classList.toggle("on", d.a.includes(n)); b.setAttribute("aria-pressed", d.a.includes(n)) }); const cb = $('#daily [data-c="dcheck"]'); if (cb) cb.disabled = !d.a.length };
A.dcheck = () => { const t = dkey(), it = todayQ(), d = S.daily[t]; if (!d || !d.a.length) return; d.done = true; d.ok = d.a.slice().sort().join() == it.q.c.slice().sort().join(); if (!d.ok) addCard(it.lid, it.q); save(); act("daily", { ok: d.ok }); $("#daily").innerHTML = dailyH(); const hs = $("#t-week"); if (hs) hs.innerHTML = homeStats(); toast(d.ok ? "Correct. Today counts as a learning day." : "Not quite. The explanation is below.") };

// ---------------- Smart review (spaced repetition) ----------------
const cardKey = (lid, q) => lid + "|" + hash(q.q);
function addCard(lid, q) { const k = cardKey(lid, q); S.rev[k] = { lid, q: { q: q.q, o: q.o, c: q.c, e: q.e }, due: addDays(dkey(), 1), iv: 1 }; save() }
function dueCards() { return Object.keys(S.rev || {}).filter((k) => S.rev[k].due <= dkey()) }
let RV = null;
A.revStart = () => { RV = { keys: shuffle(dueCards()), i: 0, a: [], done: false, right: 0 }; go("review") };
V.review = () => {
  document.title = "Review · AI PM Coach";
  if (!RV || !RV.keys.length) { app.innerHTML = `<h1>Smart review</h1><div class=card><p>Nothing to review right now. ${nextDueText()}</p><button class=btn data-c="go:home">Back home</button></div>`; return }
  if (RV.i >= RV.keys.length) { app.innerHTML = `<h1>Review complete</h1><div class=card><p class=big>${RV.right} / ${RV.keys.length}</p><p class=mu>Cards you got right come back later; the others return tomorrow. Mastered cards retire after 16 days.</p><button class=btn data-c="go:home">Back home</button></div>`; return }
  const k = RV.keys[RV.i], c = S.rev[k], q = c.q, m = q.c.length > 1, sel = RV.a;
  app.innerHTML = `<div class=row><h1 style="font-size:1.7rem">Smart review</h1><span class=sub>Card ${RV.i + 1} of ${RV.keys.length}</span></div><div class=bar><i style="width:${RV.i / RV.keys.length * 100}%"></i></div>
<div class=card><span class=eyebrow>${esc(L(c.lid) ? L(c.lid).title : "Review")}</span><p><b>${esc(fillX(q.q))}</b>${m ? " <span class=sub>· select all that apply</span>" : ""}</p>
<div class="tiles pr">${q.o.map((o, j) => tileH(o, !RV.done && sel.includes(j), `rpick:${j}`, String.fromCharCode(65 + j), "", m, RV.done ? (q.c.includes(j) ? "good" : sel.includes(j) ? "bad" : "dim") : "")).join("")}</div>
${RV.done ? `<p><b>${RV.ok ? "Correct." : "Not quite."}</b> ${esc(q.e)}</p><button class=btn data-c="rnext">Next →</button>` : `<button class=btn data-c="rcheck" ${sel.length ? "" : "disabled"}>Check answer</button>`}</div>`
};
A.rpick = (j) => { if (RV.done) return; const q = S.rev[RV.keys[RV.i]].q; RV.a = q.c.length > 1 ? (RV.a.includes(j) ? RV.a.filter((x) => x != j) : RV.a.concat(j)) : [j]; $$("#app .opt").forEach((b, n) => { b.classList.toggle("on", RV.a.includes(n)); b.setAttribute("aria-pressed", RV.a.includes(n)) }); $('[data-c="rcheck"]').disabled = !RV.a.length };
A.rcheck = () => {
  const k = RV.keys[RV.i], c = S.rev[k]; RV.done = true; RV.ok = RV.a.slice().sort().join() == c.q.c.slice().sort().join();
  if (RV.ok) { RV.right++; S.revOk = (S.revOk || 0) + 1; c.iv *= 2; if (c.iv > 16) { S.revMastered = (S.revMastered || 0) + 1; RV.mastered = k } else c.due = addDays(dkey(), c.iv) } else { c.iv = 1; c.due = addDays(dkey(), 1) }
  save(); act("review", { ok: RV.ok }); V.review();
};
A.rnext = () => { if (RV.mastered) { delete S.rev[RV.mastered]; RV.mastered = null; save() } RV.i++; RV.a = []; RV.done = false; V.review(); renderNav(); window.scrollTo(0, 0) };

// ================= Roadmap =================
V.road = () => {
  if (!S.road) { go("prof"); return }
  document.title = "Your plan · AI PM Coach";
  const r = S.road, dn = nDone(), nx = nextLesson(), mins = r.reduce((a, x) => a + (L(x.id) ? L(x.id).min : 0), 0);
  const stages = [...new Set(r.map((x) => L(x.id).stage))].sort();
  let n = 0;
  app.innerHTML = `<div class=row><h1>Your plan</h1><button class="btn g sm" data-c="go:prof">Edit profile</button></div>
<div class=bar><i style="width:${dn / r.length * 100}%"></i></div>${guest() ? `<div class="card flat" style="border-color:var(--ac)"><b>Sign in to save this plan and start learning.</b><p class=help style="margin:4px 0 10px">It's free. Without an account, your plan is kept only until you close this page.</p><button class="btn sm" data-c=signin>Continue with Google</button></div>` : ""}<p class=mu>${dn} of ${r.length} lessons complete · about ${Math.max(1, Math.ceil(mins / 60 / (S.w || 2)))} week${Math.ceil(mins / 60 / (S.w || 2)) > 1 ? "s" : ""} at your pace (${Math.round(mins / 60 * 10) / 10} hours in total)</p>
${stages.map((s) => { const items = r.filter((x) => L(x.id).stage == s), sm = items.reduce((a, x) => a + L(x.id).min, 0), sd = items.filter((x) => S.done[x.id]).length;
    return `<div class=stage-h><h2>${C.STAGES[s]}</h2><span class=sub>${sd}/${items.length} done · ${sm} min</span></div>` + items.map((it) => { n++; const l = L(it.id), done = S.done[it.id], cf = S.conf[it.id], isNext = it.id == nx;
      return `<div class="card lcard ${done ? "done" : ""} ${isNext ? "next" : ""}"><div class=num aria-hidden=true>${done ? "✓" : n}</div><div class=body><b>${l.title}</b><span class=sub>${l.min} min · ${it.d}${cf && cf.pre && cf.post ? ` · confidence ${cf.pre}→${cf.post}` : ""}</span><div style="margin-top:6px">${done ? '<span class="st d">Completed</span>' : isNext ? '<span class="pill hot">Next up</span>' : S.open[it.id] ? '<span class="st p">In progress</span>' : '<span class="st n">Not started</span>'}</div></div><button class="btn sm go ${done ? "g" : ""}" data-c="openL:${it.id}">${locked(it.id) ? "🔒 Unlock" : done ? "Review" : S.open[it.id] ? "Continue" : "Start"}</button></div>` }).join("") }).join("")}
${moreLessonsH()}`
};

// ================= Lesson =================
A.openL = (id) => { if (locked(id)) { wall("lesson"); return } if (!S.open[id]) { S.open[id] = 1; save(); ev("lesson_open", { id }) } go("lesson", id) };
const STEP_NAMES = [["video", "Video", "sec-video"], ["read", "Understand", "sec-read"], ["practice", "Practice", "sec-practice"], ["reflect", "Reflect", "sec-reflect"], ["mentor", "Ask the coach", "sec-mentor"]];
const stepsOf = (id) => (S.steps[id] = S.steps[id] || {});
function markStep(k) { const id = S.cur, s = stepsOf(id); if (s[k]) return; s[k] = 1; save(); const b = $(`#stepsNav [data-step="${k}"]`); if (b) { b.classList.add("ok"); b.firstChild.textContent = "✓ " } const n = $("#narr"); if (n) n.innerHTML = narrH(); if (k == "practice") finH() }
// The narrator bar: how long is left and what comes next, updated as steps are done.
function narrH() {
  const l = L(S.cur); if (!l) return ""; const st = stepsOf(l.id), left = STEP_NAMES.filter(([k]) => !st[k]), nd = STEP_NAMES.length - left.length;
  const min = Math.max(1, Math.round(l.min * left.length / STEP_NAMES.length));
  const txt = S.done[l.id] ? "Lesson complete" : !left.length ? "Ready to finish: mark the lesson complete below" : `About ${min} minute${min == 1 ? "" : "s"} left · next: ${left[0][1].toLowerCase()}`;
  return `${mark()}<span>${txt}</span><span class=nbar aria-hidden=true><i style="width:${S.done[l.id] ? 100 : nd / STEP_NAMES.length * 100}%"></i></span>`;
}
A.jump = (sec) => { const el = document.getElementById(sec); if (el) { const y = el.getBoundingClientRect().top + scrollY - 118; scrollTo({ top: y, behavior: "smooth" }) } };
let readObs = null;
V.lesson = () => {
  const l = L(S.cur); if (!l) { go("road"); return }
  if (locked(l.id)) { go("road"); wall("lesson"); return }
  const id = l.id, it = (S.road || []).find((x) => x.id == id) || { d: "Standard" }, st = stepsOf(id), cf = S.conf[id] || {};
  S.chat[id] = S.chat[id] || [];
  document.title = l.title + " · AI PM Coach";
  const und = l.und.map((p) => fillX(p)), skim = it.d == "Skim";
  const pos = (S.road || []).findIndex((x) => x.id == id) + 1;
  app.innerHTML = `<div class=narrator id=narr role=status>${narrH()}</div><button class=lnk data-c="go:home">Back to today</button><p class="mu" style="margin:18px 0 0">${pos ? `Lesson ${pos} of ${S.road.length} · ` : ""}${C.STAGES[l.stage]}</p><h1 style="margin-top:6px">${l.title}</h1><p class=mu style="margin-top:0">${l.min} min · ${it.d}${it.d == "Deep dive" ? " (the longer video is selected, and the further reading is worth it)" : skim ? " (short version first; expand if you need it)" : ""}</p>
<div class=steps-nav id=stepsNav aria-label="Lesson steps">${STEP_NAMES.map(([k, t, sec]) => `<button data-c="jump:${sec}" data-step="${k}" class="${st[k] ? "ok" : ""}"><span>${st[k] ? "✓ " : ""}</span>${t}</button>`).join("")}</div>
${cf.pre ? "" : `<div class="card flat" id=confPre><b>Before you start: how confident are you with ${esc(l.title)}?</b>${scale5("pre")}</div>`}
<div class="annot" id=sec-why><div class=card><span class=eyebrow>Why it matters</span><p>${esc(l.why)}</p></div><aside class=margin>${mark()}<div><b>Key idea</b>${esc(l.summary)}</div></aside></div>
<div class=card id=sec-video><span class=eyebrow>Learn</span><p class=help>Focus on the concepts behind product decisions; you don't need every technical detail.</p><div id=vd></div></div>
<div class="card und ${skim ? "" : "open"}" id=sec-read><span class=eyebrow>Understand</span><p>${und[0]}</p><div class=more>${und.slice(1).map((p) => `<p>${p}</p>`).join("")}</div>${skim ? `<button class="lnk showmore" data-c="undOpen">Show the full explanation</button>` : ""}
<p class=mu style="margin:18px 0 4px"><b>Go deeper</b> · further reading (opens in a new tab)</p>${l.reads.map((r) => `<a class=rd href="${esc(r[2])}" target=_blank rel="noopener noreferrer"><i aria-hidden=true>↗</i><span><b>${esc(r[0])}</b><span class=mu>${esc(r[1])} · ${esc(r[3])}</span></span></a>`).join("")}<span id=readEnd></span></div>
<div class=check id=chk>${st.read ? `<p class="mu m0">${mark()} You said this made sense. If anything is unclear later, ask me in the corner.</p>` : `<p class=m0><b>Does that make sense so far?</b></p><div class="row l" style="margin-top:12px"><button class="btn sm" data-c=chkYes>Yes, carry on</button><button class="btn sm g" data-c=chkNo>Not quite</button></div>`}</div>
<div class=card id=sec-practice><span class=eyebrow>Practice</span><div id=pr></div></div>
<div class=card id=sec-reflect>${reflectH(l)}</div>
<div class=card id=sec-mentor><span class=eyebrow>Ask your coach</span><p class=help>Explain the idea in your own words and get feedback, or ask anything about it. The chat stays open as you move around the app.</p><div class=chips>${starters().map((t, k) => `<button class=chip data-c="starter:${k}">${esc(t)}</button>`).join("")}</div><p style="margin-bottom:0"><button class="btn sm" data-c=coachOpen>Open the chat</button></p></div>
<div id=finbox></div>`;
  rv(); rp(); finH();
  if (readObs) readObs.disconnect();
  if ("IntersectionObserver" in window) { readObs = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { markStep("read"); readObs.disconnect() } }, { threshold: 1 }); readObs.observe($("#readEnd")) }
};
function scale5(kind) { const lab = ["Not at all", "A little", "Somewhat", "Confident", "Very"]; return `<div class=scale5 role=group aria-label="Confidence from 1 to 5">${[1, 2, 3, 4, 5].map((n) => `<button data-c="conf:${kind},${n}"><b>${n}</b><small>${lab[n - 1]}</small></button>`).join("")}</div>` }
A.conf = (kind, n) => {
  const id = S.cur, c = S.conf[id] = S.conf[id] || {}; c[kind] = n; save(); ev("confidence", { id, kind, n });
  if (kind == "pre") { const b = $("#confPre"); if (b) b.innerHTML = `<p class=mu style="margin:0">Thanks! We'll ask again at the end so you can see how much you've grown.</p>`; setTimeout(() => { const b2 = $("#confPre"); if (b2) b2.remove() }, 2500) }
  else completeLesson();
};
A.undOpen = () => { $("#sec-read").classList.add("open"); markStep("read") };
A.chkYes = () => { markStep("read"); ev("checkpoint", { ok: 1 }); const c = $("#chk"); if (c) c.innerHTML = `<p class="mu m0">${mark()} Good. Next, check yourself with a few questions.</p>`; setTimeout(() => A.jump("sec-practice"), 250) };
A.chkNo = () => { if (needAcc()) return; ev("checkpoint", { ok: 0 }); const l = L(S.cur); coachAsk(`I didn't quite get "${l.title}". Can you explain it another way, with a simple example from ${IND()}?`) };

// ---------------- Video ----------------
let embedBlocked = false;
function canEmbed() { return !embedBlocked && /^https?:$/.test(location.protocol) && window.origin && window.origin !== "null" }
// Picks the video for a lesson: matches the learner's depth (Skim = intro, Deep dive = advanced),
// prefers videos they haven't watched, and skips ones they rated down. The pick stays the same
// until they finish the lesson or ask for another, so a revisit shows something new.
const vidLevel = (it) => (it.d == "Deep dive" ? 3 : it.d == "Skim" ? 1 : 2);
function vidRank(l) {
  const it = (S.road || []).find((x) => x.id == l.id) || {}, want = vidLevel(it);
  return l.videos.map((v, j) => ({ v, sc: -Math.abs((v[4] || 2) - want) * 2 - (S.vseen[v[0]] ? 4 : 0) + (S.vr[v[0]] || 0) * 3 - j * 0.01 })).sort((a, b) => b.sc - a.sc).map((x) => x.v);
}
function curVideo(l) {
  const Ls = l.videos, c = S.vs[l.id];
  let v = typeof c == "number" ? Ls[c] : Ls.find((w) => w[0] == c);
  if (!v) { v = vidRank(l)[0]; S.vs[l.id] = v[0]; saveLocal() }
  return v;
}
const seenVideo = () => { const l = L(S.cur); if (l) { const v = curVideo(l); if (!S.vseen[v[0]]) { S.vseen[v[0]] = 1; save() } } };
function rv() {
  const el = $("#vd"); if (!el) return; const l = L(S.cur), Ls = l.videos, v = curVideo(l), r = S.vr[v[0]] || 0;
  const player = canEmbed() ? `<iframe src="https://www.youtube-nocookie.com/embed/${v[0]}?rel=0&playsinline=1" title="${esc(v[1])}" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowfullscreen></iframe>`
    : `<a class=vc href="https://www.youtube.com/watch?v=${v[0]}" target=_blank rel=noopener data-c="vidOut"><span class=pl aria-hidden=true>▶</span><b>${esc(v[1])}</b><small>${esc(v[2])} · Watch on YouTube</small></a>`;
  const lv = ["", "Intro", "Standard", "Deep dive"];
  el.innerHTML = `<div class=vw>${player}</div><p class=help>${canEmbed() ? `Video not playing? <a href="https://www.youtube.com/watch?v=${v[0]}" target=_blank rel=noopener>Watch it on YouTube</a>` : "Opens in a new tab on YouTube. Come back here for the practice and mentor."}</p>
<p><b>${esc(v[1])}</b><br><span class=mu>${esc(v[2])} · ${lv[v[4] || 2]} · ${esc(v[3])}</span></p>
<div class=vrate><span class=mu>Was this video helpful?</span><button class="vr-b ${r > 0 ? "on" : ""}" data-c="vrate:1" aria-pressed="${r > 0}" aria-label="Helpful">👍</button><button class="vr-b ${r < 0 ? "on" : ""}" data-c="vrate:-1" aria-pressed="${r < 0}" aria-label="Not helpful">👎</button>${Ls.length > 1 ? `<button class="btn g xs" data-c=vidNext>Show me a different video</button>` : ""}</div>
${Ls.length > 1 ? `<details class=vlist><summary class=mu>All ${Ls.length} videos for this lesson</summary>${Ls.map((w, j) => `<button class="vrow ${w === v ? "on" : ""}" data-c="vid:${j}"><i aria-hidden=true>▶</i><span><b>${esc(w[1])}</b><br><span class=mu>${esc(w[2])} · ${lv[w[4] || 2]}${S.vseen[w[0]] ? " · watched" : ""}</span></span></button>`).join("")}</details>` : ""}`
}
A.vid = (j) => { const l = L(S.cur); S.vs[S.cur] = l.videos[j][0]; save(); rv() };
A.vidNext = () => { const l = L(S.cur), cur = curVideo(l), rk = vidRank(l).filter((w) => w !== cur); S.vs[S.cur] = (rk[0] || cur)[0]; save(); ev("video_next", { id: S.cur }); rv() };
A.vrate = (n) => {
  const l = L(S.cur), v = curVideo(l); S.vr[v[0]] = S.vr[v[0]] == n ? 0 : n; if (!S.vr[v[0]]) delete S.vr[v[0]];
  save(); ev("video_rate", { id: S.cur, video: v[0], rating: S.vr[v[0]] || 0 }); rv();
  if (S.vr[v[0]] < 0) toast("Thanks. Tap \"Show me a different video\" to try another one."); else if (S.vr[v[0]] > 0) toast("Thanks for rating it");
};
A.vidOut = (el) => { markStep("video"); seenVideo(); window.open(el.href, "_blank", "noopener") };
// Clicking into the embedded player moves focus to the iframe, which blurs the window: count it as watching.
addEventListener("blur", () => setTimeout(() => { const a = document.activeElement; if (a && a.tagName == "IFRAME" && a.closest("#vd")) { markStep("video"); seenVideo(); act("video", { id: S.cur }) } }, 0));
document.addEventListener("securitypolicyviolation", (e) => { if (/youtube/.test(e.blockedURI || "") && !embedBlocked) { embedBlocked = true; rv() } });

// ---------------- Practice ----------------
const pst = () => (S.pr[S.cur] = S.pr[S.cur] || { i: 0, a: [], k: [] });
const pqs = () => { const st = pst(); return (st.qs || L(S.cur).qs).map((q) => ({ ...q, m: q.c.length > 1 })) };
const okAt = (st, L2, j) => (st.a[j] || []).slice().sort().join() == L2[j].c.slice().sort().join();
function rp() {
  const el = $("#pr"); if (!el) return; const st = pst(), qs = pqs();
  const dots = `<div class=dots aria-hidden=true>${qs.map((q, j) => `<b class="${st.k[j] ? "c" : j == st.i ? "d" : ""}"></b>`).join("")}</div>`;
  if (st.i >= qs.length) {
    const n = qs.filter((q, j) => okAt(st, qs, j)).length; markStep("practice");
    el.innerHTML = `${dots}<h2>${n} / ${qs.length} correct</h2><p class=mu>${n == qs.length ? "Perfect! Reflect on the lesson next, then mark it complete." : "Missed questions were added to your smart review, so you'll see them again in a day or two."}</p>
<div class=nav><button class="btn g arrow" data-c="pn:-1" aria-label="Previous question">←</button><span class=row><button class="btn g sm" data-c="pretry">Try again (shuffled)</button><button class="btn sm" data-c="pz">${guest() ? "🔒 " : ""}New AI questions</button></span></div>`; return
  }
  const q = qs[st.i], sel = st.a[st.i] || [], k = st.k[st.i], good = k && okAt(st, qs, st.i);
  el.innerHTML = `${dots}<p class=mu>Question ${st.i + 1} of ${qs.length}${q.m ? " · select all that apply" : ""}</p><p><b>${esc(fillX(q.q))}</b></p>
<div class="tiles pr">${q.o.map((o, j) => tileH(o, !k && sel.includes(j), `ps:${j}`, String.fromCharCode(65 + j), "", q.m, k ? (q.c.includes(j) ? "good" : sel.includes(j) ? "bad" : "dim") : "")).join("")}</div>
${k ? `<p><b>${good ? "Correct." : "Not quite."}</b> ${esc(q.e)}</p>${good ? "" : `<p><button class="btn g sm" data-c="why:${st.i}">${guest() ? "🔒 " : ""}Ask the coach why</button></p>`}` : ""}
<div class=nav>${st.i > 0 ? '<button class="btn g arrow" data-c="pn:-1" aria-label="Previous question">←</button>' : "<span></span>"}${k ? `<button class=btn data-c="pn:1">${st.i == qs.length - 1 ? "See results" : "Next"} →</button>` : `<button class=btn data-c="pc" ${sel.length ? "" : "disabled"}>Check answer</button>`}</div>`
}
A.ps = (j) => { const st = pst(), q = pqs()[st.i]; if (st.k[st.i]) return; let a = st.a[st.i] || []; a = q.m ? (a.includes(j) ? a.filter((x) => x != j) : a.concat(j)) : [j]; st.a[st.i] = a; save(); $$("#pr .opt").forEach((b, n) => { b.classList.toggle("on", a.includes(n)); b.setAttribute("aria-pressed", a.includes(n)) }); const cb = $('#pr [data-c="pc"]'); if (cb) cb.disabled = !a.length };
A.pc = () => { const st = pst(), qs = pqs(); if (!(st.a[st.i] || []).length) return; st.k[st.i] = 1; const good = okAt(st, qs, st.i); S.stats = S.stats || { n: 0, ok: 0 }; S.stats.n++; if (good) S.stats.ok++; if (!good) addCard(S.cur, qs[st.i]); save(); act("practice", { id: S.cur, ok: good }); rp(); toast(good ? "Correct." : "Not quite - read the explanation 👇") };
A.pn = (d) => { const st = pst(); st.i = Math.max(0, st.i + d); save(); rp() };
A.pretry = () => { const st = pst(), qs = pqs().map((q) => { const order = shuffle(q.o.map((_, i) => i)); return { q: q.q, o: order.map((i) => q.o[i]), c: q.c.map((c) => order.indexOf(c)), e: q.e } }); S.pr[S.cur] = { i: 0, a: [], k: [], qs, seen: st.seen }; save(); rp() };
let gen = false;
A.pz = async () => {
  if (gen || needAcc()) return; const id = S.cur, old = pst(), seen = (old.seen || []).concat(pqs().map((q) => q.q)).slice(-40), el = $("#pr");
  gen = true; el.innerHTML = '<p class=mu>Writing new practice questions for you...</p>';
  try {
    const arr = await aiJSON({ mode: "questions", info: info(id), seen }, /\[[\s\S]*\]/);
    const qs = (Array.isArray(arr) ? arr : []).filter((a) => a && typeof a.q == "string" && Array.isArray(a.o) && a.o.length >= 3 && Array.isArray(a.c) && a.c.length && a.c.every((n) => Number.isInteger(n) && n >= 0 && n < a.o.length)).map((a) => ({ q: a.q, o: a.o.map(String), c: a.c, e: String(a.e || "") }));
    if (qs.length < 3) throw { code: "bad_format" };
    S.pr[id] = { i: 0, a: [], k: [], qs, seen }; save(); act("ai_questions"); toast("Fresh questions ready")
  } catch (e) { toast(aiErr(e)) }
  gen = false; rp()
};
A.why = (i) => {
  if (needAcc()) return;
  const st = pst(), q = pqs()[i], mine = (st.a[i] || []).map((j) => q.o[j]), right = q.c.map((j) => q.o[j]);
  coachAsk(`In the practice question "${fillX(q.q)}", I chose "${mine.join('", "')}", but the right answer is "${right.join('", "')}". Can you explain why, and what I misunderstood?`);
};

// ---------------- Reflect ----------------
const refs = (id) => { const r = S.ref[id]; return Array.isArray(r) ? r : r ? [r] : [] };
function reflectH(l) {
  const id = l.id, a = refs(id), n = a.filter((v) => v && v.trim()).length;
  return `<span class=eyebrow>Reflect</span><p class=help>Apply the idea to your own work. Aim for 2-4 sentences: name a real feature or user, explain your reasoning, and note one risk or trade-off. Then tap <b>Get feedback</b> for coaching and an example answer. <b id=rfc>${n}</b> of ${l.reflect.length} answered, saved on this device.</p>
${l.reflect.map((r, k) => { const f = (S.rfb[id] || {})[k], cur = (a[k] || "").trim(); return `<div class=rq><span class=tag>${esc(r[0])}</span><p><b>${esc(fillX(r[1]))}</b></p><textarea class=rfa data-in="ref:${k}" rows=3 placeholder="Your answer..." aria-label="${esc(fillX(r[1]))}">${esc(a[k] || "")}</textarea><div class=rfr><button type=button class="btn g sm" data-c="rfg:${k}" id=rfb${k}>${guest() ? "🔒 " : ""}Get feedback</button><span class="mu sm" id=rfm${k}></span></div><div id=rff${k}>${f ? fbBox(f, cur && cur !== f.for) : ""}</div></div>` }).join("")}`
}
IN.ref = (el, k) => { const id = S.cur, a = refs(id).slice(); a[+k] = el.value; S.ref[id] = a; const c = $("#rfc"); if (c) c.textContent = a.filter((v) => v && v.trim()).length; if (a.some((v) => v && v.trim().length >= 25)) markStep("reflect"); clearTimeout(IN._rt); IN._rt = setTimeout(save, 400) };
const busy = {};
A.rfg = async (k) => {
  if (needAcc()) return;
  const id = S.cur, l = L(id), q = fillX(l.reflect[k][1]), ta = $(`.rfa[data-in="ref:${k}"]`), a = (ta ? ta.value : "").trim(), msg = $("#rfm" + k), box = $("#rff" + k), btn = $("#rfb" + k);
  if (busy["rf" + k]) return;
  if (a.length < 25) { msg.textContent = "Write a little more first (a sentence or two) so the coach has something to review."; ta && ta.focus(); return }
  msg.textContent = ""; busy["rf" + k] = 1; btn.disabled = true; btn.textContent = "Reviewing..."; box.innerHTML = '<div class="rfb ld">Reviewing your answer...</div>';
  try { const f = normFb(await aiJSON({ mode: "reflect", info: info(id), question: q, answer: a })); f.for = a; (S.rfb[id] = S.rfb[id] || {})[k] = f; save(); markStep("reflect"); act("reflect_feedback", { rating: f.rating }); box.innerHTML = fbBox(f, false) }
  catch (e) { box.innerHTML = `<div class="rfb er">${esc(aiErr(e))}</div>` }
  finally { busy["rf" + k] = 0; btn.disabled = false; btn.textContent = "Get feedback" }
};

// ---------------- Coach (floating chat on every page) ----------------
// One chat per lesson, plus a general one for the other pages. It opens from the button in the corner.
function starters() { const l = L(S.cur); return [`Quiz me on ${l.title.toLowerCase()}`, `Give me an example from ${IND()}`, "Explain it more simply", S.product ? "How does this apply to my product?" : "What should I ask engineers about this?"] }
function genStarters() { return S.profile ? ["What should I focus on this week?", "Explain RAG in plain words", "How do I find a good first AI feature at work?", "Quiz me on what I've learned"] : ["What does an AI product manager do?", "Do I need to code to work on AI products?", "How long does the plan take?"] }
const inLesson = () => S.view == "lesson" && !!L(S.cur);
const coachKey = () => (inLesson() ? S.cur : "_coach");
const coachStarters = () => (inLesson() ? starters() : genStarters());
const PAGE_T = { home: "today", road: "your plan", practice: "the practice studio", rp: "a role-play", iv: "interview practice", prd: "your capstone", progress: "your progress", review: "smart review", prof: "your profile", land: "the home page", quiz: "the questions", about: "about the app", privacy: "the privacy notice", feedback: "feedback", account: "your account", syncChoice: "your progress" };
let CO = false;
function coachMount() {
  if ($("#coach")) return;
  const p = document.createElement("aside"); p.id = "coach"; p.className = "coach"; p.setAttribute("aria-label", "Your coach");
  p.innerHTML = `<div class=c-head>${mark()}<div><div class=c-t>Your coach</div><div class="mu sm" id=c-ctx></div></div><button class=lnk data-c=coachClear id=c-clear>Clear</button><button class="c-x" data-c=coachClose aria-label="Minimise the coach">${svg(ICO.x, 18)}</button></div><div class=c-log id=c-log aria-live=polite></div><div class=c-form id=c-form></div>`;
  const f = document.createElement("button"); f.id = "fab"; f.className = "fab"; f.type = "button"; f.setAttribute("data-c", "coachToggle"); f.setAttribute("aria-label", "Open your coach"); f.setAttribute("aria-expanded", "false"); f.setAttribute("aria-controls", "coach");
  f.innerHTML = svg(COMPASS, 26);
  document.body.append(p, f);
}
function coachSync() {
  coachMount(); const hide = S.view == "admin";
  $("#fab").hidden = hide || CO; if (hide && CO) A.coachClose();
  $("#c-ctx").textContent = "Looking at: " + (inLesson() ? L(S.cur).title : PAGE_T[S.view] || "this page");
  if (CO) coachRender();
}
function coachRender() {
  const log = $("#c-log"), form = $("#c-form"); if (!log) return;
  if (guest()) {
    log.innerHTML = `<div class="b">I'm your coach. I can explain anything in the lessons, give feedback on your thinking and quiz you.</div><div class="b">Sign in with Google (free) to chat with me.</div>`;
    form.innerHTML = `<button class="btn sm" data-c=signin style="width:100%">Continue with Google</button>`; $("#c-clear").hidden = true; return;
  }
  const h = S.chat[coachKey()] || [];
  log.innerHTML = (h.length ? "" : `<div class=b>${inLesson() ? `Hi! Ask me anything about "${esc(L(S.cur).title)}", or explain the main idea in your own words and I'll give you feedback.` : "Hi! Ask me anything about AI product management, or about what's on this page."}</div><div class=chips>${coachStarters().map((t, k) => `<button class=chip data-c="coachStarter:${k}">${esc(t)}</button>`).join("")}</div>`)
    + h.map((m) => `<div class="${m.r == "u" ? "u" : "b"}">${esc(m.t)}</div>`).join("");
  $("#c-clear").hidden = !h.length;
  if (!$("#coachIn")) form.innerHTML = `<label for=coachIn class=vh>Ask your coach</label><textarea id=coachIn rows=1 data-enter=coachSend placeholder="Ask anything"></textarea><button class=send data-c=coachSend id=coachBtn aria-label="Send">${svg(ICO.send, 16)}</button>`;
  log.scrollTop = log.scrollHeight;
}
A.coachOpen = () => { coachMount(); CO = true; $("#coach").classList.add("open"); $("#fab").hidden = true; $("#fab").setAttribute("aria-expanded", "true"); coachSync(); ev("coach_open", { page: S.view }); const i = $("#coachIn"); if (i && matchMedia("(min-width:641px)").matches) i.focus() };
A.coachClose = () => { CO = false; const p = $("#coach"); if (p) p.classList.remove("open"); const f = $("#fab"); if (f) { f.hidden = S.view == "admin"; f.setAttribute("aria-expanded", "false"); f.focus({ preventScroll: true }) } };
A.coachToggle = () => (CO ? A.coachClose() : A.coachOpen());
A.coachStarter = (k) => { const t = coachStarters()[k]; if (t) coachAsk(t) };
A.starter = (k) => { const t = starters()[k]; if (t) coachAsk(t) };
A.coachSend = () => { const i = $("#coachIn"), t = i && i.value.trim(); if (!t) return; i.value = ""; coachAsk(t) };
A.coachClear = () => { const k = coachKey(); if (!(S.chat[k] || []).length) return; if (!confirm("Clear this chat with your coach?")) return; S.chat[k] = []; save(); coachRender() };
async function coachAsk(m) {
  if (!CO) A.coachOpen(); if (needAcc()) return; if (busy.ask || !m) return;
  const k = coachKey(), h = S.chat[k] = S.chat[k] || [], lid = inLesson() ? S.cur : null;
  h.push({ r: "u", t: m }); save(); if (lid) markStep("mentor"); act("mentor", { id: lid || "", page: S.view });
  coachRender(); const log = $("#c-log"), live = document.createElement("div"); live.className = "b"; live.textContent = "Thinking..."; log.append(live); log.scrollTop = log.scrollHeight;
  const btn = $("#coachBtn"); busy.ask = 1; if (btn) btn.disabled = true;
  try { const text = await ai({ mode: "mentor", info: info(lid), messages: h.map((x) => ({ role: x.r == "u" ? "user" : "assistant", content: x.t })) }, (tx) => { live.textContent = tx; log.scrollTop = log.scrollHeight }); live.textContent = text; h.push({ r: "a", t: text }); save(); $("#c-clear").hidden = false }
  catch (e) { live.textContent = aiErr(e); live.classList.add("merr"); h.pop(); save() }
  finally { busy.ask = 0; const b = $("#coachBtn"); if (b) b.disabled = false }
}

// ---------------- Completing a lesson ----------------
function finH() {
  const el = $("#finbox"); if (!el) return; const id = S.cur, done = S.done[id], practiced = stepsOf(id).practice;
  const nid = (S.road || []).map((x) => x.id).find((x) => !S.done[x] && x != id), nl = nid && L(nid);
  if (done) { el.innerHTML = `<div class="card done-box"><h3>Lesson complete</h3>${roadDone() ? `<p>That's your whole plan done. Here's what to do next.</p><button class=btn data-c="go:home">See what's next</button>` : nl ? `<p class=mu>Up next: <b>${nl.title}</b> · ${nl.min} min</p><button class=btn data-c="openL:${nid}">Next lesson →</button>` : ""} <button class="btn g" data-c="go:road">Your plan</button> <button class="btn g" data-c="fb:${id}">Feedback on this lesson</button></div>`; return }
  el.innerHTML = `<div class="card flat"><div class="row">${practiced ? `<button class=btn data-c="fin">Mark lesson complete</button>` : `<button class=btn disabled>Mark lesson complete</button>`}<button class="btn g" data-c="fb:${id}">Feedback on this lesson</button></div>${practiced ? "" : `<p class=help style="margin-top:10px">Finish the practice quiz to complete this lesson.</p>`}</div>`
}
A.fin = () => {
  const id = S.cur; if (!stepsOf(id).practice) { toast("Finish the practice quiz first"); A.jump("sec-practice"); return }
  if (!(S.conf[id] || {}).post) { $("#finbox").innerHTML = `<div class="card flat"><b>Last step: how confident are you now with ${esc(L(id).title)}?</b>${scale5("post")}</div>`; return }
  completeLesson()
};
function completeLesson() {
  const id = S.cur; if (S.done[id]) { finH(); return } S.done[id] = 1;
  const lv = L(id); if (lv) { S.vseen[curVideo(lv)[0]] = 1; delete S.vs[id] }   // next visit shows a video they haven't seen
  save(); act("lesson_done", { id }); finH(); const n = $("#narr"); if (n) n.innerHTML = narrH();
  doneMoment(id);
}
// The completion moment: where this lesson sits in the plan, what's next, and the week's goal.
function doneMoment(id) {
  const r = S.road || [], n = r.length, dn = nDone(), c = S.conf[id] || {}, l = L(id);
  const nid = r.map((x) => x.id).find((x) => !S.done[x]), nl = nid && L(nid), wk = weekCount(), tg = weekTarget();
  const frac = !n ? "" : dn == n ? "That's your whole plan." : dn * 4 == n ? "That's a quarter of your plan." : dn * 2 == n ? "You're halfway through your plan." : dn * 4 == n * 3 ? "Three quarters of your plan done." : `${dn} of ${n} lessons in your plan.`;
  const d = document.createElement("div"); d.className = "done-moment"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "dmH");
  d.innerHTML = `<div class=done-card><div class=say style="align-items:center">${mark(true)}<p class="mu m0">From your coach</p></div><h2 id=dmH>${esc(l.title)}: done. ${frac}</h2>
<div class=prog role=img aria-label="${dn} of ${n} lessons done">${r.map((x) => `<span class="${S.done[x.id] && x.id != id ? "on" : ""}" ${x.id == id ? "data-new" : ""}></span>`).join("")}</div>
${c.pre && c.post > c.pre ? `<p class=soft>Your confidence went from ${c.pre} to ${c.post} out of 5.</p>` : ""}
<p class=soft>${nl ? `Next: ${esc(nl.title)}, about ${nl.min} minutes.` : "Next: see what's next on your Today page."}</p>
<p class=soft>${wk >= tg ? `You've hit this week's goal of ${tg} learning day${tg > 1 ? "s" : ""}.` : `${tg - wk} more learning day${tg - wk == 1 ? "" : "s"} this week reaches your goal.`}</p>
<div class="row l" style="margin-top:20px"><button class=btn data-c=doneHome>Back to today</button>${nl ? `<button class="btn g" data-c="doneNext:${nid}">Next lesson</button>` : ""}</div></div>`;
  d.addEventListener("click", (e) => { if (e.target === d) A.doneClose() });
  document.body.appendChild(d);
  setTimeout(() => { const s2 = d.querySelector("[data-new]"); if (s2) s2.className = "new" }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450);
  d.querySelector(".btn").focus();
}
A.doneClose = () => { const d = $(".done-moment"); if (d) d.remove() };
A.doneHome = () => { A.doneClose(); go("home") };
A.doneNext = (nid) => { A.doneClose(); A.openL(nid) };

// ================= Practice studio =================
V.practice = () => {
  document.title = "Practice studio · AI PM Coach";
  app.innerHTML = `<h1>Practice studio</h1><p class=mu style="margin-top:0">Practise the conversations AI PMs have every week. The AI plays the other person, then scores you and shows how to do better.${S.product ? "" : " Tip: add your product on the Home page to make scenarios more personal."}</p>
<h2 style="margin-top:22px">Role-play simulator</h2><div class=grid2>${C.SCEN.map((s) => { const r = S.rp[s.id] || {}; return `<div class=card><span aria-hidden=true style="font-size:1.6rem">${s.icon}</span><h3>${esc(s.title)}</h3><p class=help><b>${esc(s.character)}</b> · ${esc(s.goal)}</p><div class=row><button class="btn sm" data-c="rpOpen:${s.id}">${lockTxt(r.msgs && r.msgs.length && !r.score ? "Continue" : "Start")}</button>${r.best ? `<span class=pill>Best ${r.best}/10</span>` : ""}</div></div>` }).join("")}</div>
<h2 style="margin-top:26px">Interview simulator</h2><p class=help>Timed AI PM interview questions, scored by an AI hiring manager. Aim for a structured answer in about 3 minutes.</p>
<div class=grid2>${C.IVQ.map((q) => { const r = S.iv[q.id] || {}; return `<div class=card><span class=tag>${esc(q.cat)}</span><p style="margin:8px 0"><b>${esc(fillX(q.q))}</b></p><div class=row><button class="btn sm" data-c="ivOpen:${q.id}">${lockTxt(r.score ? "Try again" : "Answer")}</button>${r.best ? `<span class=pill>Best ${r.best}/10</span>` : ""}</div></div>` }).join("")}</div>`
};

// ---------------- Role-play ----------------
const rpS = () => (S.rp[S.rpid] = S.rp[S.rpid] || { msgs: [], best: 0 });
A.rpOpen = (id) => { if (needAcc()) return; S.rpid = id; ev("roleplay_open", { id }); go("rp") };
V.rp = () => {
  if (guest()) { go("practice"); wall("ai"); return }
  const s = C.SCEN.find((x) => x.id == S.rpid); if (!s) { go("practice"); return } const r = rpS(), turns = r.msgs.filter((m) => m.r == "u").length;
  document.title = s.title + " · Role-play";
  app.innerHTML = `<button class="btn g sm" data-c="go:practice">&larr; Practice studio</button><h1 style="margin-top:14px;font-size:1.8rem">${s.icon} ${esc(s.title)}</h1>
<div class="card flat"><p style="margin-top:0"><b>You're meeting:</b> ${esc(s.character)}</p><p><b>Situation:</b> ${esc(s.brief)}</p><p style="margin-bottom:0"><b>Your goal:</b> ${esc(s.goal)}</p></div>
<div class=card><div id=rpc class=chat aria-live=polite></div>
${r.score ? "" : `<textarea id=rpi rows=3 data-enter=rpSend placeholder="Your reply... (Enter to send)" ${turns >= 10 ? "disabled" : ""}></textarea>
<div class=row style="margin-top:10px"><button class=btn data-c=rpSend id=rpBtn ${turns >= 10 ? "disabled" : ""}>Send</button><button class="btn g" data-c=rpScore ${turns >= 2 ? "" : "disabled"} id=rpEnd>End & get my score</button></div><p class=help>${turns >= 10 ? "That's the end of the meeting. Get your score." : `Reply ${Math.max(0, 2 - turns) ? `at least ${2 - turns} more time${2 - turns > 1 ? "s" : ""} before scoring` : "as long as you like (up to 10 replies)"}.`}</p>`}
<div id=rpscore>${r.score ? scoreBox(r.score, "A stronger line you could use") + `<p><button class=btn data-c=rpReset>Try again</button> <button class="btn g" data-c="go:practice">Another scenario</button></p>` : ""}</div></div>`;
  rpChat(); if (!r.msgs.length && !r.score) rpTurn();
};
function rpChat() { const el = $("#rpc"); if (!el) return; const s = C.SCEN.find((x) => x.id == S.rpid); el.innerHTML = rpS().msgs.map((m) => `<div class=who-lbl>${m.r == "u" ? "You" : esc(s.character)}</div><div class="msg ${m.r == "u" ? "u" : "a"}">${esc(m.t)}</div>`).join("") || '<p class=mu>Starting the meeting...</p>' }
async function rpTurn() {
  const r = rpS(), s = C.SCEN.find((x) => x.id == S.rpid), el = $("#rpc"); if (busy.rp) return; busy.rp = 1;
  const lbl = document.createElement("div"); lbl.className = "who-lbl"; lbl.textContent = s.character; const live = document.createElement("div"); live.className = "msg a"; live.textContent = "..."; if (!r.msgs.length) el.innerHTML = ""; el.append(lbl, live); live.scrollIntoView({ block: "nearest" });
  const b = $("#rpBtn"); if (b) b.disabled = true;
  try { const t = await ai({ mode: "roleplay", scenario: s.id, info: info(), messages: r.msgs.map((m) => ({ role: m.r == "u" ? "user" : "assistant", content: m.t })) }, (tx) => { live.textContent = tx }); r.msgs.push({ r: "a", t }); save() }
  catch (e) { live.textContent = aiErr(e); live.classList.add("merr"); if (r.msgs.length && r.msgs[r.msgs.length - 1].r == "u") r.msgs.pop(); save() }
  finally { busy.rp = 0; if (b) b.disabled = false }
}
A.rpSend = async () => { if (needAcc()) return; const i = $("#rpi"), t = i && i.value.trim(); if (!t || busy.rp) return; const r = rpS(); r.msgs.push({ r: "u", t }); i.value = ""; save(); act("roleplay_turn", { id: S.rpid }); V.rp(); await rpTurn(); if (r.msgs.filter((m) => m.r == "u").length >= 2) V.rp() };
A.rpScore = async () => { if (needAcc()) return;
  const r = rpS(), box = $("#rpscore"), b = $("#rpEnd"); if (busy.rps) return; busy.rps = 1; if (b) { b.disabled = true; b.textContent = "Scoring..." } box.innerHTML = '<div class="rfb ld">Scoring your conversation...</div>';
  try { const sc = normScore(await aiJSON({ mode: "roleplay_score", scenario: S.rpid, info: info(), messages: r.msgs.map((m) => ({ role: m.r == "u" ? "user" : "assistant", content: m.t })) })); r.score = sc; r.best = Math.max(r.best || 0, sc.score); r.runs = (r.runs || 0) + 1; save(); act("roleplay_score", { id: S.rpid, score: sc.score }); V.rp() }
  catch (e) { box.innerHTML = `<div class="rfb er">${esc(aiErr(e))}</div>`; if (b) { b.disabled = false; b.textContent = "End & get my score" } }
  finally { busy.rps = 0 }
};
A.rpReset = () => { const r = rpS(); r.msgs = []; r.score = null; save(); V.rp() };

// ---------------- Interview ----------------
let IVT = null;
const ivS = () => (S.iv[S.ivid] = S.iv[S.ivid] || { answer: "", best: 0 });
A.ivOpen = (id) => { if (needAcc()) return; S.ivid = id; const r = ivS(); if (r.score) { r.score = null; r.answer = "" } save(); ev("interview_open", { id }); go("iv") };
V.iv = () => {
  if (guest()) { go("practice"); wall("ai"); return }
  const q = C.IVQ.find((x) => x.id == S.ivid); if (!q) { go("practice"); return } const r = ivS(); clearInterval(IVT); IVT = null;
  document.title = "Interview practice · AI PM Coach";
  app.innerHTML = `<button class="btn g sm" data-c="go:practice">&larr; Practice studio</button><span class=tag style="margin-left:8px">${esc(q.cat)}</span>
<h1 style="margin-top:14px;font-size:1.7rem">${esc(fillX(q.q))}</h1>
<div class=card>${r.score ? `<p class=mu style="margin-top:0">Your answer</p><div class=outline>${esc(r.answer)}</div><div style="margin-top:14px">${scoreBox(r.score, "Outline of a strong answer")}</div><p><button class=btn data-c="ivOpen:${q.id}">Try again</button> <button class="btn g" data-c="go:practice">Another question</button></p>`
      : `<div class=row><span class=help>Structure tip: clarify, then users & problem, approach, risks & evaluation, metrics.</span><span class=timer id=ivTimer aria-live=off>3:00</span></div>
<textarea id=iva rows=9 data-in=ivText placeholder="Type your answer as you'd say it in the interview. The timer starts when you begin typing.">${esc(r.answer || "")}</textarea><div class=row style="margin-top:10px"><span class=sub id=ivWords></span><button class=btn data-c=ivSubmit id=ivBtn>Submit for scoring</button></div><div id=ivres></div>`}</div>`;
  IN.ivText($("#iva") || { value: "" }, "init");
};
IN.ivText = (el, init) => {
  const r = ivS(); if (el.value !== undefined && init != "init") { r.answer = el.value; clearTimeout(IN._it); IN._it = setTimeout(save, 400) }
  const w = $("#ivWords"); if (w) w.textContent = `${(el.value || "").trim().split(/\s+/).filter(Boolean).length} words`;
  if (init != "init" && !IVT && $("#ivTimer")) { let left = 180; IVT = setInterval(() => { left--; const t = $("#ivTimer"); if (!t) { clearInterval(IVT); IVT = null; return } t.textContent = left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "Time's up - wrap up and submit"; t.classList.toggle("low", left <= 30); if (left <= 0) clearInterval(IVT) }, 1000) }
};
A.ivSubmit = async () => { if (needAcc()) return;
  const r = ivS(), a = ($("#iva").value || "").trim(), box = $("#ivres"), b = $("#ivBtn"); if (busy.iv) return;
  if (a.split(/\s+/).length < 25) { box.innerHTML = `<p class=err>Write a fuller answer first (at least a few sentences) so it can be scored fairly.</p>`; return }
  busy.iv = 1; b.disabled = true; b.textContent = "Scoring..."; box.innerHTML = '<div class="rfb ld">The hiring manager is reviewing your answer...</div>'; clearInterval(IVT); IVT = null;
  try { const sc = normScore(await aiJSON({ mode: "interview", question: S.ivid, info: info(), answer: a })); r.answer = a; r.score = sc; r.best = Math.max(r.best || 0, sc.score); r.runs = (r.runs || 0) + 1; save(); act("interview_score", { id: S.ivid, score: sc.score }); V.iv() }
  catch (e) { box.innerHTML = `<div class="rfb er">${esc(aiErr(e))}</div>`; b.disabled = false; b.textContent = "Submit for scoring" }
  finally { busy.iv = 0 }
};

// ================= Capstone: AI PRD =================
V.prd = () => {
  document.title = "Capstone PRD · AI PM Coach"; const n = prdCount();
  app.innerHTML = `<h1>Capstone: your AI PRD</h1><p class=mu style="margin-top:0">Write a product requirements document for a real AI feature, one section at a time. Each section gets an expert review. It makes a strong portfolio piece and interview story.</p>
<div class="card flat"><div class=row><b id=prdN>${n} of ${C.PRD.length} sections drafted</b><span class=row><button class="btn g sm" data-c=prdCopy>Copy</button><button class="btn sm" data-c=prdDownload>Download (.md)</button></span></div><div class=bar style="margin-top:10px"><i id=prdBar style="width:${n / C.PRD.length * 100}%"></i></div>
<label class=fl for=prdTitle>Feature name</label><input id=prdTitle data-in=prdTitle maxlength=120 placeholder="e.g. AI reply drafts for payment-support agents" value="${esc(S.prd.title || "")}"></div>
${C.PRD.map((p, i) => { const f = S.prd.fb[p.id], cur = (S.prd.sec[p.id] || "").trim(); return `<div class=card id="prd-${p.id}"><span class=eyebrow>${i + 1}. ${esc(p.title)}</span><p class=help>${esc(p.guide)}</p><textarea rows=5 data-in="prdSec:${p.id}" placeholder="${esc(p.ph)}" aria-label="${esc(p.title)}">${esc(S.prd.sec[p.id] || "")}</textarea><div class=rfr><button class="btn g sm" data-c="prdRev:${p.id}" id="prdb-${p.id}">${guest() ? "🔒 " : ""}Review this section</button><span class="mu sm" id="prdm-${p.id}"></span></div><div id="prdf-${p.id}">${f ? fbBox(f, cur && cur !== f.for, "See an improved version") : ""}</div></div>` }).join("")}`
};
IN.prdTitle = (el) => { S.prd.title = el.value.slice(0, 120); clearTimeout(IN._pt2); IN._pt2 = setTimeout(save, 400) };
IN.prdSec = (el, id) => { S.prd.sec[id] = el.value; clearTimeout(IN._ps); IN._ps = setTimeout(() => { save(); checkAch() }, 500); const n = prdCount(), b = $("#prdBar"), t = $("#prdN"); if (b) b.style.width = n / C.PRD.length * 100 + "%"; if (t) t.textContent = `${n} of ${C.PRD.length} sections drafted` };
A.prdRev = async (id) => { if (needAcc()) return;
  const text = (S.prd.sec[id] || "").trim(), msg = $("#prdm-" + id), box = $("#prdf-" + id), btn = $("#prdb-" + id); if (busy["prd" + id]) return;
  if (text.length < 40) { msg.textContent = "Write a few sentences first so the reviewer has something to work with."; return }
  msg.textContent = ""; busy["prd" + id] = 1; btn.disabled = true; btn.textContent = "Reviewing..."; box.innerHTML = '<div class="rfb ld">Reviewing your section...</div>';
  try { const f = normFb(await aiJSON({ mode: "prd", section: id, title: S.prd.title || "", info: info(), text })); f.for = text; S.prd.fb[id] = f; save(); act("prd_review", { id, rating: f.rating }); box.innerHTML = fbBox(f, false, "See an improved version") }
  catch (e) { box.innerHTML = `<div class="rfb er">${esc(aiErr(e))}</div>` }
  finally { busy["prd" + id] = 0; btn.disabled = false; btn.textContent = "Review this section" }
};
function prdMarkdown() { return `# ${S.prd.title || "AI feature PRD"}\n\n_Written with AI PM Coach_\n\n` + C.PRD.map((p) => `## ${p.title}\n\n${(S.prd.sec[p.id] || "").trim() || "_Not written yet._"}\n`).join("\n") }
A.prdDownload = () => { download(((S.prd.title || "ai-prd").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ai-prd") + ".md", prdMarkdown()); ev("prd_download") };
A.prdCopy = async () => { try { await navigator.clipboard.writeText(prdMarkdown()); toast("PRD copied to the clipboard") } catch (e) { toast("Couldn't copy. Use Download instead.") } };

// ================= Progress =================
function accuracy() { const t = S.stats; return t && t.n ? Math.round(t.ok / t.n * 100) : null }
V.progress = () => {
  if (!S.profile) { go("land"); return }
  document.title = "Progress · AI PM Coach"; const acc = accuracy(), got = ACH.filter((a) => S.ach[a[0]]).length;
  const confRows = (S.road || []).map((x) => ({ l: L(x.id), c: S.conf[x.id] })).filter((r) => r.c && r.c.pre);
  app.innerHTML = `<h1>Your progress</h1>
<div class=grid3><div class="card flat"><div class=big>${nDone()}/${(S.road || []).length}</div><p class=sub>lessons complete</p></div><div class="card flat"><div class=big>🔥 ${streak()}</div><p class=sub>day streak (best ${S.best || 0})</p></div><div class="card flat"><div class=big>${acc == null ? "-" : acc + "%"}</div><p class=sub>practice accuracy</p></div></div>
<div class=card><span class=eyebrow>Skill radar</span>${radar()}</div>
<div class=card><span class=eyebrow>Confidence</span>${confRows.length ? confRows.map((r) => `<div class=cbar><span>${esc(r.l.title)}</span><span class=t title="Before ${r.c.pre}, after ${r.c.post || "-"}"><i class=pre style="width:${r.c.pre * 20}%"></i>${r.c.post ? `<i class=post style="width:${r.c.post * 20}%"></i>` : ""}</span></div>`).join("") + `<p class=legend><span><i style="background:var(--mu);opacity:.45"></i>Before the lesson</span><span><i style="background:var(--ac)"></i>After</span></p>` : '<p class=help>Rate your confidence at the start and end of each lesson to see your growth here.</p>'}</div>
<div class=card><span class=eyebrow>Achievements · ${got} of ${ACH.length}</span><div class=ach>${ACH.map(([id, e, n, d]) => `<div class="${S.ach[id] ? "" : "lock"}"><span class=e aria-hidden=true>${e}</span><b>${n}</b><span>${d}</span></div>`).join("")}</div></div>
<div class=card><span class=eyebrow>Your data</span><p class=help>${AU ? `Your progress is saved to your account (${esc(AU.email)}) and in this browser.` : "Your progress is stored only in this browser."} Download a copy, or delete everything and start over.</p><button class="btn g sm" data-c=exportData>Download my data</button> <button class="btn danger sm" data-c=resetAll>Delete all my progress</button></div>`
};
A.exportData = () => { download("ai-pm-coach-data.json", JSON.stringify(S, null, 1), "application/json") };
A.resetAll = () => { if (AU) { go("account"); toast("To delete your saved progress, delete your account data here."); return } if (!confirm("Delete all your progress, answers and chats on this device? This can't be undone.")) return; const theme = S.theme, consent = S.consent; S = { theme, consent }; initState(); save(); ev("reset"); go("land"); toast("Everything was deleted from this device.") };

document.addEventListener("click", (e) => { const a = e.target.closest("a[data-track]"); if (a) ev(a.dataset.track) });

// ================= About & privacy =================
V.about = () => {
  const o = CFG.owner || {}, ini = (o.name || "AI").split(" ").map((w) => w[0]).join("").slice(0, 2);
  document.title = "About · AI PM Coach";
  app.innerHTML = `<button class="btn g sm" data-c="go:${S.profile ? "home" : "land"}">&larr; Back to home</button><span class=eyebrow style="display:table;margin-top:22px">About</span><h1>About AI PM Coach</h1>
${o.name ? `<div class=card><div class=row style="justify-content:flex-start;gap:16px;flex-wrap:nowrap"><div class=av aria-hidden=true>${esc(ini)}</div><div><p class=mu style="margin:0">Created by</p><b style="font-size:1.25rem">${esc(o.name)}</b><br><span class=mu>${esc(o.role || "")}</span></div></div>${(o.bio || []).map((p) => `<p>${esc(p)}</p>`).join("")}${o.linkedin ? `<p style="margin-bottom:0"><a class="btn g" style="display:inline-block;text-decoration:none;padding:10px 18px" href="${esc(o.linkedin)}" target=_blank rel=noopener>Connect on LinkedIn ↗</a></p>` : ""}</div>` : ""}
<div class=card><span class=eyebrow>What this app does</span><p>AI PM Coach helps product managers build the skills to work on AI products. A 2-minute assessment of your experience, technical comfort, AI knowledge and goals produces a personal roadmap, sized to the time you have each week.</p><p>Each lesson combines a short video, a written explanation with further reading, practice questions in your industry, and reflection questions with AI feedback. Beyond lessons you'll find a daily challenge, smart review, role-play and interview simulators, and a capstone where you write an AI PRD for your own product. Your coach is in the corner of every page.</p></div>
<div class=card><span class=eyebrow>Your data</span><p style="margin:0">Your progress is saved in this browser, and in your account if you sign in with Google. When you use an AI feature, what you type is sent to our server and to Anthropic to generate the reply. Details are in the <button class=lnk data-c="go:privacy">privacy notice</button>.</p></div>
<div class=card><span class=eyebrow>Help improve it</span><p>Found a bug, want a topic covered, or have an idea? I'd love to hear it.</p><button class=btn data-c="fb">Give feedback</button></div>`
};
V.privacy = () => {
  document.title = "Privacy · AI PM Coach"; const o = CFG.owner || {};
  app.innerHTML = `<button class="btn g sm" data-c="go:${S.profile ? "home" : "land"}">&larr; Back to home</button><h1 style="margin-top:14px">Privacy notice</h1><p class=mu>Plain-language summary of what happens to your data.</p>
<div class=card><h3>Stored in your browser</h3><p>If you don't sign in, your assessment answers and plan are kept only in this browser tab and deleted when you close it; we don't have a copy. When you're signed in, your progress, reflections, chats, simulator answers and PRD drafts are also kept in this browser's local storage so the app works quickly. You can download or delete everything on the <button class=lnk data-c="go:progress">Progress</button> page.</p></div>
<div class=card><h3>If you sign in</h3><p>Signing in is optional and uses your <b>Google</b> account through <b>Supabase</b>, our account and database provider. We receive your name and email address from Google. Your progress is then also stored in our Supabase database so you can continue on any device, and we record the days you use the app and how often you sign in, to understand how many people use it. The site owner can see your name, email, sign-up date, last activity and lessons completed. You can delete your account and all its data at any time on the <button class=lnk data-c="go:account">Account</button> page.</p></div>
<div class=card><h3>Sent when you use AI features</h3><p>When you use the AI Mentor, reflection feedback, new practice questions, the PRD review, role-play or interview scoring, the text you enter, your assessment answers (level, industry and goal), your product description if you added one, and the current lesson are sent to this site's server function (hosted by Netlify) and passed to <b>Anthropic</b>, which provides the Claude AI model, to generate the reply. Don't enter confidential or personal information in these features. The server doesn't store your messages; it checks that you're signed in and keeps a daily request counter per account (an anonymised hash of your account ID) to prevent abuse, and hosting logs may record technical errors.</p></div>
<div class=card><h3>Feedback form</h3><p>If you send feedback, your message, rating and, optionally, your email address are stored with <b>Netlify Forms</b> so ${esc(o.name || "the site owner")} can read and reply to them.</p></div>
<div class=card><h3>Videos</h3><p>Lesson videos are embedded from YouTube in privacy-enhanced mode (youtube-nocookie.com). When you play a video, YouTube may store data in your browser under its own privacy policy.</p></div>
<div class=card><h3>Analytics</h3>${CFG.posthogKey ? `<p>With your consent, we use <b>PostHog</b> (hosted in the EU) to understand how the app is used, for example which lessons people complete. We don't use it for advertising and don't sell data. You can change your choice at any time.</p><p><b>Your current choice:</b> ${S.consent == "yes" ? "analytics allowed" : S.consent == "no" ? "analytics declined" : "not chosen yet"}</p><button class="btn sm" data-c="consent:yes">Allow analytics</button> <button class="btn g sm" data-c="consent:no">Decline analytics</button>` : "<p>This site currently doesn't use analytics.</p>"}</div>
<div class=card><h3>Contact</h3><p>Questions or requests about your data: use the <button class=lnk data-c="fb">feedback form</button>${o.name ? ` or contact ${esc(o.name)}${o.linkedin ? ` on <a href="${esc(o.linkedin)}" target=_blank rel=noopener>LinkedIn</a>` : ""}` : ""}.</p></div>`
};

// ================= Feedback (Netlify Forms) =================
const FT = [["Bug / problem", "What happened, and what did you expect to happen?", "🐞", "Something isn't working"], ["Idea / feature request", "What would you like the app to do, and how would it help you?", "💡", "Something you'd like added"], ["Lesson content", "Which part could be clearer, more accurate or more useful?", "📚", "Clarity, accuracy, topics"], ["Praise", "What did you like? It helps to know what to keep.", "💚", "What you enjoyed"], ["Other", "Tell me anything else.", "💬", "Anything else"]];
let F = {};
A.fb = (lessonId) => { F = { type: null, rating: 0, lesson: typeof lessonId == "string" ? lessonId : "", from: S.view == "feedback" ? F.from : S.view, fromCur: S.cur, sent: false }; go("feedback") };
A.fbback = () => go(F.from && F.from != "feedback" ? F.from : (S.profile ? "home" : "land"), F.fromCur);
V.feedback = () => {
  if (F.from === undefined) F = { type: null, rating: 0, lesson: "", from: S.profile ? "home" : "land", sent: false };
  document.title = "Feedback · AI PM Coach";
  if (F.sent) { app.innerHTML = `<span class=eyebrow>Feedback</span><h1>Thank you</h1><div class=card><p style="margin-top:0">Your feedback was sent. Every message is read and helps decide what to improve next.</p><div class="row l"><button class=btn data-c="fbback">Back to where I was</button><button class="btn g" data-c="fb">Send more feedback</button></div></div>`; return }
  app.innerHTML = `<button class="btn g sm" data-c="go:${S.profile ? "home" : "land"}">&larr; Back to home</button><span class=eyebrow style="display:table;margin-top:22px">Feedback</span><h1>Help improve AI PM Coach</h1><p class=mu>Tell me what's working, what isn't, and what you'd like to see. It takes about a minute.</p>
<div class=card><label class=fl>What kind of feedback?</label><div class=tiles id=fbt style="margin-top:8px" role=group aria-label="Feedback type">${FT.map((f, i) => tileH(f[0], F.type === i, `fbt:${i}`, f[2], f[3], false)).join("")}</div>
<label class=fl>How would you rate the app overall? <span class=mu>(optional)</span></label><div class=stars id=fbr role=group aria-label="Rating">${[1, 2, 3, 4, 5].map((n) => `<button type=button class="star ${n <= F.rating ? "on" : ""}" data-c="fbr:${n}" aria-label="${n} star${n > 1 ? "s" : ""}">★</button>`).join("")}</div>
<label class=fl for=fbl>Is it about a specific lesson? <span class=mu>(optional)</span></label><select id=fbl><option value="">No, the app in general</option>${C.LESSONS.map((l) => `<option value="${l.id}" ${F.lesson == l.id ? "selected" : ""}>${esc(l.title)}</option>`).join("")}</select>
<label class=fl for=fbm>Your feedback</label><textarea id=fbm rows=5 placeholder="${esc(F.type != null ? FT[F.type][1] : "Choose a feedback type above, then tell me more.")}"></textarea>
<label class=fl for=fbe>Your email <span class=mu>(optional - only if you'd like a reply)</span></label><input id=fbe type=email autocomplete=email placeholder="you@example.com">
<label class=vh>Leave this empty <input id=fbh tabindex=-1 autocomplete=off></label>
<p class=err id=fberr role=alert></p><button class=btn id=fbsend data-c="fbs">Send feedback</button><p class=help>Your feedback is stored with Netlify Forms. See the <button class=lnk data-c="go:privacy">privacy notice</button>.</p></div>`
};
A.fbt = (i) => { F.type = i; $$("#fbt .tile").forEach((b, j) => { b.classList.toggle("on", j == i); b.setAttribute("aria-pressed", j == i) }); const m = $("#fbm"); if (m) m.placeholder = FT[i][1]; $("#fberr").textContent = "" };
A.fbr = (n) => { F.rating = F.rating == n ? 0 : n; $$("#fbr .star").forEach((b, j) => b.classList.toggle("on", j < F.rating)) };
A.fbs = async () => {
  const er = $("#fberr"), btn = $("#fbsend"), msg = $("#fbm").value.trim(), email = $("#fbe").value.trim(), lesson = $("#fbl").value;
  if (F.type == null) { er.textContent = "Please choose what kind of feedback this is."; return }
  if (!msg) { er.textContent = "Please write a few words of feedback."; $("#fbm").focus(); return }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { er.textContent = "That email address doesn't look right. Fix it or leave it empty."; return }
  const body = new URLSearchParams({ "form-name": "feedback", type: FT[F.type][0], rating: F.rating ? F.rating + " / 5" : "Not rated", lesson: lesson ? L(lesson).title : "General", message: msg, email, "bot-field": $("#fbh").value });
  er.textContent = ""; btn.disabled = true; btn.textContent = "Sending...";
  try { const r = await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() }); if (!r.ok) throw new Error(r.status); F.sent = true; ev("feedback"); V.feedback(); window.scrollTo(0, 0); toast("Feedback sent. Thank you!") }
  catch (e) { btn.disabled = false; btn.textContent = "Send feedback"; er.textContent = "Sorry, your feedback couldn't be sent right now. Please try again in a moment." }
};

// ================= Accounts & cloud progress (Google sign-in via Supabase) =================
// Tokens are kept in this browser; all database access goes through /api/account on the server.
const ACC = { on: false, checked: false };
let AU = loadAuth();
function loadAuth() { try { return JSON.parse(localStorage.getItem("aipm_auth") || "null") } catch (e) { return null } }
function saveAuth() { try { AU ? localStorage.setItem("aipm_auth", JSON.stringify(AU)) : localStorage.removeItem("aipm_auth") } catch (e) { } }
async function accPost(body, auth = true) {
  const h = { "Content-Type": "application/json" }; if (auth && AU) h.Authorization = "Bearer " + AU.at;
  let r; try { r = await fetch("/api/account", { method: "POST", headers: h, body: JSON.stringify(body), keepalive: body.action == "save" && JSON.stringify(body).length < 60000 }) } catch (e) { throw { code: "offline" } }
  let d = null; try { d = await r.json() } catch (e) { }
  if (!r.ok) throw { code: (d && d.error) || "server_error", status: r.status, data: d };
  return d;
}
async function refreshToken() {
  if (!AU || !AU.rt) return false;
  try { const d = await accPost({ action: "refresh", refresh_token: AU.rt }, false); AU.at = d.access_token; AU.rt = d.refresh_token || AU.rt; AU.exp = Date.now() + (d.expires_in || 3600) * 1000; saveAuth(); return true } catch (e) { return false }
}
async function acc(body) {                   // authenticated call with automatic token refresh
  if (!AU) throw { code: "signed_out" };
  if (AU.exp && AU.exp - Date.now() < 60000) await refreshToken();
  try { return await accPost(body) }
  catch (e) {
    if (e.code == "session_expired" && await refreshToken()) return accPost(body);
    if (e.code == "session_expired") endSession("Your session ended. Please sign in again; your progress is saved in your account.");
    throw e;
  }
}
A.signin = () => { ev("signin_click"); location.href = "/api/account/login" };
// After Google sign-in, Supabase returns to the site with the session in the URL hash.
function takeRedirect() {
  const h = location.hash || ""; if (!/access_token=|error_description=/.test(h)) return false;
  const q = new URLSearchParams(h.slice(1)); try { history.replaceState(null, "", location.pathname + location.search) } catch (e) { location.hash = "" }
  if (q.get("error_description")) { setTimeout(() => toast("Sign-in didn't complete: " + q.get("error_description")), 300); return false }
  AU = { at: q.get("access_token"), rt: q.get("refresh_token"), exp: Date.now() + (+q.get("expires_in") || 3600) * 1000 }; saveAuth(); return true;
}
const syncable = () => { const o = { ...S }; for (const k of ["ev", "view", "dirty", "syncedAt", "acct"]) delete o[k]; return o };
const hasProgress = (st) => !!(st && st.profile);
let pushT = null, pushing = false, lastPull = 0;
function schedulePush() { if (!AU || !AU.email || S.acct != AU.email) return; clearTimeout(pushT); pushT = setTimeout(push, 2000) }
async function push(force) {
  if (!AU || pushing || (!S.dirty && !force)) return; pushing = true; const mark = S.dirty;
  try {
    const d = await acc({ action: "save", state: syncable(), base: S.syncedAt || null, force: !!force });
    S.syncedAt = d.updated_at; if (S.dirty == mark) S.dirty = 0; S.acct = AU.email; saveLocal(); syncBadge();
  } catch (e) {
    if (e.code == "conflict" && e.data) { const r = e.data; mergeFrom(r.state); S.syncedAt = r.updated_at; saveLocal(); pushing = false; if (S.view != "lesson") render(); return push(true) }
    else syncBadge(e.code);
  } finally { pushing = false }
}
// When two devices changed progress before syncing, keep both: this device's values win,
// and anything only the other device has (lessons done, answers, reviews, badges...) is added.
function mergeFrom(remote) {
  if (!remote) return;
  const maps = ["done", "ach", "open", "steps", "conf", "chat", "pr", "rfb", "rp", "iv", "rev", "daily", "vs", "vseen", "vr"];
  for (const k of maps) { const r = remote[k] || {}, l = S[k] = S[k] || {}; for (const id in r) if (!(id in l)) l[id] = r[id] }
  for (const d in remote.days || {}) S.days[d] = Math.max(S.days[d] || 0, remote.days[d]);
  for (const id in remote.ref || {}) { const r = remote.ref[id], l = S.ref[id]; if (!l) S.ref[id] = r; else if (Array.isArray(r) && Array.isArray(l)) r.forEach((v, i) => { if (v && !(l[i] || "").trim()) l[i] = v }) }
  if (remote.prd) { S.prd.title = S.prd.title || remote.prd.title || ""; for (const sec in remote.prd.sec || {}) if (!(S.prd.sec[sec] || "").trim()) S.prd.sec[sec] = remote.prd.sec[sec]; for (const f in remote.prd.fb || {}) if (!S.prd.fb[f]) S.prd.fb[f] = remote.prd.fb[f] }
  if (!S.product && remote.product) S.product = remote.product;
  
  S.best = Math.max(S.best || 0, remote.best || 0); S.revOk = Math.max(S.revOk || 0, remote.revOk || 0);
  if (remote.stats && (!S.stats || remote.stats.n > S.stats.n)) S.stats = remote.stats;
}
function adopt(remote, ts) {
  const keep = { ev: S.ev, theme: S.theme, consent: S.consent, view: S.view && !["land", "quiz", "prof", "syncChoice"].includes(S.view) ? S.view : "home", cur: S.cur };
  S = { ...remote, ...keep }; S.acct = AU.email; S.syncedAt = ts; S.dirty = 0; initState(); saveLocal(); applyTheme(); render();
}
async function pull(first) {
  if (!AU || !AU.email) return; lastPull = Date.now();
  if (first) {                                // progress this browser had from before guests became visit-only
    try { const raw = localStorage.getItem("aipm_old"); if (raw) { localStorage.removeItem("aipm_old"); const o = JSON.parse(raw); if (!hasProgress(S) && hasProgress(o)) { const keep = { theme: S.theme, consent: S.consent, view: ["land", "quiz", "prof"].includes(S.view) || !S.view ? "home" : S.view }; S = Object.assign(o, keep); delete S.acct; initState(); saveLocal(); render(); setTimeout(() => toast("We've added the progress from this browser to your account"), 600) } } } catch (e) { }
  }
  let r; try { r = await acc({ action: "load" }) } catch (e) { syncBadge(e.code); return }
  const remote = r.state, ts = r.updated_at;
  if (!remote || !hasProgress(remote)) { if (hasProgress(S)) { S.acct = AU.email; await push(true); if (first) toast("Your progress is now saved to your account") } else S.acct = AU.email; saveLocal(); return }
  if (S.acct == AU.email) {                   // this device already belongs to this account
    if (S.syncedAt == ts) { if (S.dirty) push(); return }
    if (!S.dirty) { adopt(remote, ts); if (!first) toast("Updated with your progress from another device") } else { mergeFrom(remote); S.syncedAt = ts; saveLocal(); push(true) }
    return;
  }
  if (!hasProgress(S)) { adopt(remote, ts); toast("Welcome back! Your progress is loaded"); return }
  CH = { remote, ts }; go("syncChoice");      // both this device and the account have progress: let the learner choose
}
let CH = null;
const summary = (st) => { const r = (st.road || []).length, d = Object.keys(st.done || {}).filter((id) => (st.road || []).some((x) => x.id == id)).length; return `${d} of ${r} lessons done` + (st.updatedAt ? ` · last used ${new Date(st.updatedAt).toLocaleDateString()}` : "") };
V.syncChoice = () => {
  if (!CH) { go("home"); return } document.title = "Choose your progress · AI PM Coach";
  app.innerHTML = `<h1>Which progress should we keep?</h1><p class=mu>Your account already has saved progress, and this browser has different progress from before you signed in. Choose one; the other will be replaced.</p>
<div class=grid2><div class=card><span class=eyebrow>In your account</span><h3>${esc(summary(CH.remote))}</h3><button class=btn data-c=keepRemote>Use my account's progress</button></div>
<div class=card><span class=eyebrow>In this browser</span><h3>${esc(summary(S))}</h3><button class="btn g" data-c=keepLocal>Use this browser's progress</button></div></div>`
};
A.keepRemote = () => { const c = CH; CH = null; adopt(c.remote, c.ts); go("home"); toast("Loaded the progress from your account") };
A.keepLocal = async () => { const c = CH; CH = null; S.acct = AU.email; S.syncedAt = c.ts; await push(true); go("home"); toast("This browser's progress is now saved to your account") };
function syncBadge(err) { const el = $("#syncState"); if (!el) return; el.textContent = err ? "Couldn't save to your account just now. We'll retry automatically." : S.syncedAt ? `Saved to your account ${new Date(S.syncedAt).toLocaleString()}` : "Saving..." }
A.syncNow = async () => { await push(true); await pull(); syncBadge(); toast("Synced") };
A.signout = async () => {
  if (S.dirty) await push(true);
  if (!confirm("Sign out? Your progress stays saved in your account, and it will be removed from this browser.")) return;
  ev("signout"); endSession("Signed out");
};
// Signing out, or a session that can't be renewed, always returns this browser to the visitor page.
// The account's progress stays in the cloud; changes that hadn't synced yet are kept aside and
// merged back the next time the same account signs in on this browser.
function endSession(msg) {
  const was = S.acct || (AU && AU.email);
  if (was && S.dirty) { try { localStorage.setItem("aipm_unsynced", JSON.stringify({ acct: was, state: syncable() })) } catch (e) { } }
  const theme = S.theme, consent = S.consent; AU = null; saveAuth(); S = { theme, consent }; initState();
  if (ACC.on) { try { localStorage.removeItem("aipm") } catch (e) { } }
  saveLocal(); A.wallClose(); renderNav(); go("land"); if (msg) toast(msg);
}
async function mergeUnsynced() {
  let st = null; try { st = JSON.parse(localStorage.getItem("aipm_unsynced") || "null") } catch (e) { }
  if (!st || !AU || st.acct != AU.email || S.acct != AU.email) return;
  mergeFrom(st.state); saveLocal(); await push(true); try { localStorage.removeItem("aipm_unsynced") } catch (e) { } render();
}
A.deleteAccount = async () => {
  if (!confirm("Delete your account and all progress saved in it? This can't be undone.")) return;
  try { await acc({ action: "delete" }) } catch (e) { toast("Couldn't delete your account right now. Please try again."); return }
  const theme = S.theme; AU = null; saveAuth(); S = { theme }; initState(); saveLocal(); go("land"); toast("Your account and its data were deleted.");
};
V.account = () => {
  document.title = "Account · AI PM Coach";
  if (!AU) { app.innerHTML = `<h1>Save your progress</h1><div class=card><p>Sign in to keep your roadmap, answers, simulator scores and capstone in your account, so you can continue on any device.</p>${ACC.on ? `<button class=btn data-c=signin>Continue with Google</button>` : `<p class=help>Accounts aren't switched on for this site yet.</p>`}<p class=help style="margin-top:12px">We'll get your name and email from Google. See the <button class=lnk data-c="go:privacy">privacy notice</button>.</p></div>`; return }
  app.innerHTML = `<h1>Your account</h1><div class=card><p style="margin-top:0"><b>${esc(AU.name || "Signed in")}</b><br><span class=mu>${esc(AU.email || "")}</span></p><p class=sub id=syncState></p><div class="row l"><button class="btn g sm" data-c=syncNow>Sync now</button><button class="btn g sm" data-c=signout>Sign out</button></div></div>
<div class=card><span class=eyebrow>Your data</span><p class=help>Download a copy of your progress, or permanently delete your account and everything saved in it.</p><button class="btn g sm" data-c=exportData>Download my data</button> <button class="btn danger sm" data-c=deleteAccount>Delete my account</button></div>`;
  syncBadge();
};
async function startAccounts() {
  try { const st = JSON.parse(sessionStorage.getItem("aipm_acc") || "null"); if (st) ACC.on = st.on } catch (e) { }
  const fresh = takeRedirect();
  if (!ACC.checked) accPost({ action: "status" }, false).then((d) => { ACC.on = !!(d && d.accounts); ACC.checked = true; try { sessionStorage.setItem("aipm_acc", JSON.stringify({ on: ACC.on })) } catch (e) { } if (ACC.on && !AU && stashOldGuest()) { const keep = { theme: S.theme, consent: S.consent }; S = load(); Object.assign(S, { theme: S.theme ?? keep.theme, consent: S.consent ?? keep.consent }); initState(); if (!S.profile && !["land", "quiz", "about", "privacy", "feedback", "admin", "account"].includes(S.view)) S.view = "land"; render() } renderNav(); if (["home", "account", "road", "practice", "prd"].includes(S.view)) render() }).catch(() => { });
  if (!AU) return;
  try { const d = await acc({ action: "session", login: fresh }); AU.email = d.user.email; AU.name = d.user.name; AU.admin = !!d.admin; saveAuth(); ACC.on = true; A.wallClose(); if (fresh) { ev("login"); toast(`Signed in as ${AU.email}`) } renderNav(); await pull(true); await mergeUnsynced(); if (S.view == "admin") V.admin() }
  catch (e) { if (fresh) toast("Sign-in couldn't be completed. Please try again.") }
}
document.addEventListener("visibilitychange", () => { if (!AU) return; if (document.visibilityState == "hidden") { if (S.dirty) push() } else if (Date.now() - lastPull > 60000) pull() });

// ================= Admin (hidden: /admin) =================
let ADM = null;
V.admin = () => {
  document.title = "Admin · AI PM Coach"; const c = evCount;
  const rows = [["Landing visits", "visit"], ["Assessments completed", "assess_done"], ["Lessons completed", "lesson_done"], ["Mentor messages", "mentor"], ["Role-plays scored", "roleplay_score"], ["Interview answers scored", "interview_score"], ["Feedback sent", "feedback"]];
  const local = `<details class="card flat"><summary><b>This browser's activity</b></summary>${rows.map((a) => `<div class=row><span>${a[0]}</span><b>${c(a[1])}</b></div>`).join("")}</details>`;
  const head = `<button class="btn g sm" data-c="go:${S.profile ? "home" : "land"}">&larr; Back</button><h1 style="margin-top:14px">Admin dashboard</h1>`;
  if (!AU) { app.innerHTML = head + `<div class=card><p>Sign in with an admin Google account to see sign-ins and active users.</p>${ACC.on ? `<button class=btn data-c=signin>Continue with Google</button>` : `<p class=help>Accounts aren't configured yet. Follow the "Accounts" steps in the README.</p>`}</div>` + local; return }
  if (!AU.admin) { app.innerHTML = head + `<div class=card><p>You're signed in as <b>${esc(AU.email || "")}</b>, which isn't an admin account. Add this email to <code>ADMIN_EMAILS</code> in Netlify and redeploy.</p></div>` + local; return }
  app.innerHTML = head + `<div id=adm><p class=mu>Loading...</p></div>` + local;
  acc({ action: "admin" }).then((d) => { ADM = d; admH() }).catch((e) => { const el = $("#adm"); if (el) el.innerHTML = `<div class="rfb er">Couldn't load the dashboard (${esc(e.code || "error")}). Check the Supabase settings and the account function log in Netlify.</div>` });
};
const fmtD = (s) => s ? new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "-";
function admChart(series) {
  // Grouped bars: active users (teal) and sign-ins (amber) per day. Same unit (people / sign-ins per day), one axis.
  const W = Math.max(320, Math.min(700, (app.clientWidth || 700) - 44)), H = 220, pl = 30, pb = 26, pt = 10, n = series.length, max = Math.max(1, ...series.map((d) => Math.max(d.active, d.logins)));
  const step = Math.ceil(max / 4) || 1, top = step * 4, gw = (W - pl) / n, bw = Math.min(16, (gw - 8) / 2), y = (v) => pt + (H - pt - pb) * (1 - v / top);
  const bar = (x, v, col, lab) => { if (!v) return ""; const h = (H - pb) - y(v), r = Math.min(4, h, bw / 2), yy = y(v); return `<path d="M${x},${H - pb} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + bw - r} Q${x + bw},${yy} ${x + bw},${yy + r} V${H - pb} Z" fill="${col}"/>` };
  let g = ""; for (let i = 0; i <= 4; i++) { const v = step * i; g += `<line x1=${pl} x2=${W} y1=${y(v)} y2=${y(v)} stroke="var(--bd)" stroke-width=1 /><text x=${pl - 6} y=${y(v) + 4} text-anchor=end class=ax>${v}</text>` }
  const bars = series.map((d, i) => { const x0 = pl + i * gw + (gw - bw * 2 - 2) / 2, lbl = new Date(d.day + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
    return `<g class=hit><title>${lbl}: ${d.active} active user${d.active == 1 ? "" : "s"}, ${d.logins} sign-in${d.logins == 1 ? "" : "s"}, ${d.signups} new</title><rect x=${pl + i * gw} y=${pt} width=${gw} height=${H - pt - pb} fill=transparent />${bar(x0, d.active, "var(--c1)")}${bar(x0 + bw + 2, d.logins, "var(--c2)")}<text x=${pl + i * gw + gw / 2} y=${H - 8} text-anchor=middle class=ax>${i % 2 == 1 || n <= 7 ? new Date(d.day + "T12:00:00").getDate() : ""}</text></g>` }).join("");
  return `<svg class=chart viewBox="0 0 ${W} ${H}" role=img aria-label="Active users and sign-ins per day for the last ${n} days">${g}<line x1=${pl} x2=${W} y1=${H - pb} y2=${H - pb} stroke="var(--mu)" stroke-width=1 />${bars}</svg>`;
}
function admVideos(list) {
  const info = {}; for (const l of C.LESSONS) for (const v of l.videos) info[v[0]] = { title: v[1], ch: v[2], lesson: l.title };
  const rows = list.filter((x) => info[x.id]).sort((a, b) => (b.up + b.down) - (a.up + a.down) || b.up - a.up);
  return `<div class=card><span class=eyebrow>Video ratings</span>${rows.length ? `<div class=tscroll><table class=tbl><tr><th>Video</th><th>Lesson</th><th>👍</th><th>👎</th></tr>${rows.map((x) => `<tr><td><a href="https://www.youtube.com/watch?v=${esc(x.id)}" target=_blank rel=noopener>${esc(info[x.id].title)}</a><br><span class=mu>${esc(info[x.id].ch)}</span></td><td>${esc(info[x.id].lesson)}</td><td>${x.up}</td><td>${x.down}</td></tr>`).join("")}</table></div><p class=help>Videos with many 👎 are good candidates to replace in <code>public/js/content.js</code>.</p>` : `<p class=help>No ratings yet. Learners rate videos with 👍 / 👎 under each lesson video.</p>`}</div>`;
}
function admH() {
  const d = ADM, k = d.kpi, el = $("#adm"); if (!el) return;
  const tile = (v, l) => `<div class="card flat"><div class=big>${v}</div><p class=sub>${l}</p></div>`;
  el.innerHTML = `<p class=mu style="margin-top:0">Signed-in learners only · days in ${esc(d.timezone)} · today is ${fmtD(d.today + "T12:00:00")}. <button class=lnk data-c=admReload>Refresh</button></p>
<div class="grid3 kpis">${tile(k.loginsToday, "sign-ins today")}${tile(k.activeToday, "active users today")}${tile(k.newToday, "new sign-ups today")}${tile(k.active7, "active in the last 7 days")}${tile(k.active30, "active in the last 30 days")}${tile(k.totalUsers, "accounts in total")}</div>
<div class=card><span class=eyebrow>Last 14 days</span><div class=legend style="justify-content:flex-start;margin:6px 0 4px"><span><i style="background:var(--c1)"></i>Active users</span><span><i style="background:var(--c2)"></i>Sign-ins</span></div>${admChart(d.series)}
<details><summary class=sub>Show as a table</summary><table class=tbl><tr><th>Day</th><th>Active users</th><th>Sign-ins</th><th>New sign-ups</th></tr>${d.series.slice().reverse().map((r) => `<tr><td>${fmtD(r.day + "T12:00:00")}</td><td>${r.active}</td><td>${r.logins}</td><td>${r.signups}</td></tr>`).join("")}</table></details></div>
<div class=card><span class=eyebrow>Learners (${d.users.length})</span><div class=tscroll><table class=tbl><tr><th>Learner</th><th>Joined</th><th>Last active</th><th>Active days (30d)</th><th>Lessons</th></tr>${d.users.map((u) => `<tr><td><b>${esc(u.name || "-")}</b><br><span class=sub>${esc(u.email)}</span></td><td>${fmtD(u.joined)}</td><td>${fmtD(u.lastActive || u.lastSignIn)}</td><td>${u.activeDays30}</td><td>${u.lessonsDone}/${u.lessonsTotal || "-"}</td></tr>`).join("") || '<tr><td colspan=5 class=sub>No accounts yet.</td></tr>'}</table></div></div>
${admVideos(d.videos || [])}
<p class=help>Guests who never sign in aren't counted here; use PostHog analytics (js/config.js) to include them.</p>`;
}
A.admReload = () => { const el = $("#adm"); if (el) el.innerHTML = "<p class=mu>Loading...</p>"; acc({ action: "admin" }).then((d) => { ADM = d; admH() }).catch(() => toast("Couldn't refresh")) };

// ================= Analytics consent (PostHog, EU) =================
function loadPostHog() {
  if (PH || !CFG.posthogKey || S.consent != "yes") return;
  const s = document.createElement("script"); s.async = true; s.src = CFG.posthogHost.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js";
  s.onload = () => { try { window.posthog.init(CFG.posthogKey, { api_host: CFG.posthogHost, person_profiles: "identified_only", capture_pageview: false, autocapture: false, disable_session_recording: true, persistence: "localStorage" }); PH = window.posthog; PH.capture("$pageview", { view: S.view }) } catch (e) { } };
  document.head.appendChild(s);
}
function consentBanner() {
  const old = $("#consent"); if (old) old.remove();
  if (!CFG.posthogKey || S.consent) return;
  const d = document.createElement("div"); d.id = "consent"; d.className = "consent"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "Analytics consent");
  d.innerHTML = `<p>Can we use privacy-friendly analytics (PostHog, hosted in the EU) to learn which lessons help most? No ads, no selling data. <button class=lnk data-c="go:privacy">Privacy notice</button></p><button class="btn sm" data-c="consent:yes">Allow</button><button class="btn g sm" data-c="consent:no">No thanks</button>`;
  document.body.appendChild(d);
}
A.consent = (v) => { S.consent = v; save(); consentBanner(); if (v == "yes") loadPostHog(); else if (PH) { try { PH.opt_out_capturing() } catch (e) { } } if (S.view == "privacy") V.privacy(); toast(v == "yes" ? "Thanks! Analytics allowed." : "Okay, no analytics.") };

// ================= Start =================
if (guestMode()) stashOldGuest();
initState(); applyTheme();
if (isAdminURL()) S.view = "admin"; else if (S.view == "admin") S.view = S.profile ? "home" : "land";
if (!S.view || (S.view == "land" && S.profile && S.road)) S.view = S.profile && S.road ? "home" : "land";
if (S.view == "quiz" && !S.draft) S.view = S.profile ? "prof" : "land";
// This browser was used by an account that is no longer signed in here: show the visitor page.
if (!AU && S.acct && !/access_token=/.test(location.hash)) endSession();
render(); consentBanner(); loadPostHog(); checkAch(); startAccounts();
