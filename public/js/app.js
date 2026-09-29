/* AI PM Coach - app logic
 * Views are plain functions that render HTML into #app. Clicks use data-c="action:arg1,arg2",
 * inputs use data-in="handler:arg". All progress is stored in this browser (localStorage "aipm").
 */
"use strict";
const CFG = Object.assign({ siteUrl: location.origin, posthogKey: "", posthogHost: "https://eu.i.posthog.com", owner: { name: "", role: "", linkedin: "", bio: [] } }, window.APP_CONFIG || {});
const C = window.CONTENT;
const Q = C.Q;
const LV = ["Beginner", "Basic", "Intermediate", "Advanced"], AIL = ["Beginner", "Beginner+", "Practitioner", "Experienced", "Leader"];
const app = document.getElementById("app"), navEl = document.getElementById("nav");

// ---------------- Storage ----------------
let S = load();
function load() { try { return JSON.parse(localStorage.getItem("aipm") || "{}") || {} } catch (e) { return {} } }
function saveLocal() { try { localStorage.setItem("aipm", JSON.stringify(S)) } catch (e) { } }
function save() { S.updatedAt = Date.now(); S.dirty = (S.dirty || 0) + 1; saveLocal(); if (typeof schedulePush == "function") schedulePush() }
function initState() {
  for (const k of ["done", "chat", "pr", "ref", "rfb", "vs", "open", "days", "rev", "daily", "conf", "ach", "rp", "iv", "steps"]) if (!S[k] || typeof S[k] != "object") S[k] = {};
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
const IND = () => Q[6][2][S.profile ? S.profile.ind : 8];
const X = () => C.EX[IND()] || "your company";
const fillX = (s) => String(s).replace(/\{x\}/g, X()).replace(/\{ind\}/g, IND());
function info(lessonId) { const p = S.profile || {}; return { exp: p.exp, ind: p.ind, tech: p.tech, ai: p.ai, goal: p.goal, lesson: lessonId || null, done: Object.keys(S.done), product: S.product || "" } }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }
function ring(val, max, label, size = 86) { const r = size / 2 - 7, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, max ? val / max : 0)); return `<div class=ring style="width:${size}px;height:${size}px"><svg width=${size} height=${size} aria-hidden=true><circle cx=${size / 2} cy=${size / 2} r=${r} fill=none stroke="var(--soft)" stroke-width=8 /><circle cx=${size / 2} cy=${size / 2} r=${r} fill=none stroke="url(#rg)" stroke-width=8 stroke-linecap=round stroke-dasharray="${c * p} ${c}"/><defs><linearGradient id=rg><stop offset=0 stop-color="var(--ac)"/><stop offset=1 stop-color="var(--ac2)"/></linearGradient></defs></svg><div class=v>${label}</div></div>` }
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
  ["mentor10", "💬", "Curious mind", "Send 10 messages to the AI Mentor", () => evCount("mentor") >= 10],
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
  bad_format: "The AI reply came back in an unexpected format. Please try again.",
};
const aiErr = (e) => AIERR[e && e.code] || "The AI features are unavailable right now. Please try again in a moment.";
async function ai(payload, onText) {
  let r;
  try { r = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }) }
  catch (e) { throw { code: /^https?:$/.test(location.protocol) ? "offline" : "not_hosted" } }
  if (!r.ok) { let err = ""; try { err = (await r.json()).error || "" } catch (e) { } throw { code: r.status == 404 || r.status == 405 || r.status == 501 ? "not_set_up" : AIERR[err] ? err : r.status == 429 ? "rate_limited" : "server_error" } }
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
let V = {};                                  // views
function go(v, cur) { if (v != "admin") leaveAdminURL(); S.view = v; if (cur !== undefined) S.cur = cur; saveLocal(); render(); window.scrollTo(0, 0) }
A.go = go;
function render() {
  const view = V[S.view] ? S.view : (S.profile ? "home" : "land");
  if ((view == "home" || view == "road" || view == "lesson" || view == "progress" || view == "review") && !S.profile) { S.view = "land"; return render() }
  S.view = view; renderNav(); V[view]();
  try { if (PH) PH.capture("$pageview", { view }) } catch (e) { }
}
function renderNav() {
  const tabs = S.profile ? [["home", "Home", "🏠"], ["road", "Roadmap", "🗺️"], ["practice", "Practice", "🎭"], ["prd", "Capstone", "📝"], ["progress", "Progress", "📈"]] : [];
  document.body.classList.toggle("has-tabs", !!S.profile);
  const due = dueCards().length, act = { lesson: "road", rp: "practice", iv: "practice", review: "home", cert: "progress", quiz: "", prof: "", account: "" }[S.view] ?? S.view;
  navEl.innerHTML = `<div class=nav-in><button class=brand data-c="go:${S.profile ? "home" : "land"}" aria-label="AI PM Coach home"><img src="/favicon.svg" alt=""><span>AI PM Coach</span></button>
<nav class=nav-links aria-label="Main">${tabs.map(([v, t, ic]) => `<button data-c="go:${v}" class="${act == v ? "on" : ""}" ${act == v ? 'aria-current="page"' : ""}><span class=ti aria-hidden=true>${ic}</span>${t}${v == "home" && due ? `<span class=ct aria-label="${due} review cards due">${due}</span>` : ""}</button>`).join("")}</nav>
<span class=nav-r>${AU ? `<button class=theme-btn data-c="go:account" aria-label="Your account" title="${esc(AU.email || "")}">👤 <span class=acct-l>${esc((AU.name || AU.email || "Account").split(/[ @]/)[0])}</span></button>` : ACC.on ? `<button class="theme-btn" data-c="go:account">Sign in</button>` : ""}<button class=theme-btn data-c="theme" aria-label="Switch colour theme">${(S.theme || "light") == "dark" ? "☀️" : "🌙"}</button></span></div>`
}
function applyTheme() { document.documentElement.setAttribute("data-theme", S.theme || "light") }
A.theme = () => { S.theme = (S.theme || "light") == "dark" ? "light" : "dark"; save(); applyTheme(); renderNav() };
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
  document.title = "AI PM Coach - become an AI Product Manager";
  const resume = S.draft && !S.profile;
  app.innerHTML = `<section class=hero><span class=eyebrow>AI PM Coach</span><h1>Become an <span class=gr>AI Product Manager</span></h1>
<p class=mu style="font-size:1.08rem">A personalised learning path for product managers: short lessons, practice with AI feedback, role-play and interview simulators, and a capstone AI PRD you can show employers.</p>
<div class="row l" style="margin-top:14px">${S.profile ? `<button class=btn data-c="go:home">Go to my dashboard →</button>` : `<button class=btn data-c="startQuiz">${resume ? `Resume my assessment (question ${S.draft.qi + 1} of ${Q.length})` : "Generate My AI PM Roadmap"}</button>`}</div>
<p class=mu>Free · Takes about 2 minutes · No sign-up</p>
<div class=who><span class=tag>PMs adding AI skills</span><span class=tag>PMs moving into AI roles</span><span class=tag>Job-seekers</span><span class=tag>Product leaders</span></div></section>
<div class=steps>${[["🧭", "1. Discover", "A 2-minute assessment of your experience and goals."], ["🗺️", "2. Get your roadmap", "Lessons sized to the time you have each week."], ["🎯", "3. Practise", "Quizzes, reflections and simulators with AI feedback."], ["🚀", "4. Prove it", "A capstone AI PRD and a certificate for LinkedIn."]].map((a) => `<div class=step><div class=ic aria-hidden=true>${a[0]}</div><b>${a[1]}</b><br><span class=mu>${a[2]}</span></div>`).join("")}</div>
<div class=preview><b>Example roadmap</b> <span class=mu>· a 4-7 year PM in fintech, 3-5 hours a week</span><ol>${[1, 2, 3, 4, 5, 6].map((s) => `<li><b>${C.STAGES[s]}</b> <span class=mu>· ${C.LESSONS.filter((l) => l.stage == s).map((l) => l.title).join(", ")}</span></li>`).join("")}</ol></div>
<h2 style="margin-top:26px">More than videos</h2>
<div class=feat>${[["🎭", "Role-play simulator", "Pitch a sceptical CFO or handle an AI incident, then get scored."], ["🎤", "Interview simulator", "Timed AI PM interview questions with a hiring-manager score."], ["💬", "AI Mentor", "Explain concepts in your own words and get coached."], ["📝", "Capstone PRD", "Write an AI PRD section by section with expert review."], ["🧠", "Smart review", "Missed questions come back until you've mastered them."], ["🎓", "Certificate", "Finish your roadmap and add it to your LinkedIn profile."]].map((f) => `<div><span aria-hidden=true style="font-size:1.4rem">${f[0]}</span><b>${f[1]}</b><span>${f[2]}</span></div>`).join("")}</div>
<p style="text-align:center;margin-top:22px">${S.profile ? "" : `<button class=btn data-c="startQuiz">Start now - it's free</button>`}</p>`
};

// ================= Assessment =================
let QZ = null; // {qi, ans, edit}
A.startQuiz = () => { ev("assess_start"); QZ = S.draft && !S.profile ? S.draft : { qi: 0, ans: {} }; go("quiz") };
A.editProfile = () => { QZ = { qi: 0, ans: JSON.parse(JSON.stringify(S.profile || {})), edit: true }; go("quiz") };
V.quiz = () => {
  if (!QZ) QZ = S.draft || { qi: 0, ans: {} };
  const q = Q[QZ.qi], m = q[3], cur = QZ.ans.hasOwnProperty(q[0]) ? QZ.ans[q[0]] : (m ? [] : null);
  document.title = "Assessment · AI PM Coach";
  const nudge = ["Let's go! 🚀", "Nice start 👍", "You're rolling", "Great answers", "Halfway there! 🎉", "Looking good", "Almost there", "Just a few more", "Two to go", "Last one! 🏁"][QZ.qi];
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
  if (editing) { S.road = buildRoad(S.profile); S.w = [.75, 2, 4, 7, 12][S.profile.time]; save(); ev("profile_edit"); go("road"); toast("Roadmap updated. Your progress is kept ✅") }
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
<div class=card><b style="font-size:1.15rem">${Q[0][2][p.exp]} PM · ${IND()}</b><p>AI experience: <b>${AIL[p.ai]}</b><br>Technical confidence: <b>${LV[p.tech]}</b><br>Goal: <b>${Q[7][2][p.goal]}</b><br>Pace: <b>${Q[8][2][p.time]} a week</b></p>
<p class=mu style="margin-bottom:4px">Strengths from your answers</p>${strengths(p).map((t) => `<span class=tag>${t}</span>`).join("")}
<p class=mu style="margin:14px 0 4px">Biggest growth areas</p>${devAreas().map((t) => `<span class=tag>${t}</span>`).join("")}
<p style="margin:14px 0 0"><button class=lnk data-c="editProfile">Edit my answers</button></p></div>
<div class=card><span class=eyebrow>Skill radar</span>${radar()}<p class=help>Estimated from your answers. It grows as you complete lessons.</p></div>
${productCard()}
<button class=btn data-c="${first ? "makeRoad" : "go:road"}">${first ? "Generate my roadmap →" : "Back to my roadmap →"}</button>`
};
function productCard() {
  return `<div class=card><span class=eyebrow>My product (optional)</span><p class=help>Describe the product you work on in one or two sentences. The AI Mentor, reflections, simulators and new questions will use it in their examples. Don't include confidential details.</p>
<textarea rows=3 maxlength=300 data-in="product" placeholder="e.g. A B2B invoicing app for small businesses in the Nordics, used by 5,000 accountants.">${esc(S.product || "")}</textarea><p class=sub id=prodSaved>${S.product ? "Saved on this device." : ""}</p></div>`
}
IN.product = (el) => { S.product = el.value.slice(0, 300); save(); const s = $("#prodSaved"); if (s) s.textContent = "Saved on this device."; clearTimeout(IN._pt); IN._pt = setTimeout(() => ev("product_set"), 1500) };
A.makeRoad = () => { S.road = buildRoad(S.profile); S.w = [.75, 2, 4, 7, 12][S.profile.time]; ev("roadmap"); go("home"); toast("Your roadmap is ready 🗺️") };

// ================= Home dashboard =================
function nextLesson() { const r = S.road || []; if (S.cur && r.some((x) => x.id == S.cur) && !S.done[S.cur] && S.open[S.cur]) return S.cur; const n = r.find((x) => !S.done[x.id]); return n ? n.id : null }
V.home = () => {
  if (!S.road) { go("prof"); return }
  document.title = "Home · AI PM Coach";
  const nx = nextLesson(), l = nx && L(nx), due = dueCards().length, got = ACH.filter((a) => S.ach[a[0]]);
  const hr = new Date().getHours(), hi = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  app.innerHTML = `<h1 style="font-size:1.9rem">${hi} 👋</h1><p class=mu style="margin-top:0">${roadDone() ? "You've finished your roadmap. Keep your skills sharp with practice and review." : `${nDone()} of ${S.road.length} lessons complete. Here's your plan for today.`}</p>
${S.newLessons ? `<div class="card flat" style="border-color:var(--ac)"><b>New: 6 lessons were added</b><p class="help">AI UX & trust, data strategy, prompting vs RAG vs fine-tuning, responsible AI, launching & monitoring, and pricing. Your progress is kept.</p><button class="btn sm" data-c="go:road">See my roadmap</button> <button class=lnk data-c="dismissNew">Dismiss</button></div>` : ""}
${l ? `<div class="card cont"><span class=eyebrow>${S.open[nx] ? "Continue where you left off" : "Next up"}</span><h3>${l.title}</h3><p class=mu style="margin-top:0">${l.min} min · ${C.STAGES[l.stage]}</p><button class=btn data-c="openL:${nx}">${S.open[nx] ? "Continue lesson →" : "Start lesson →"}</button></div>`
      : `<div class="card cont"><span class=eyebrow>Roadmap complete 🎓</span><h3>Claim your certificate</h3><p class=mu>Add it to your LinkedIn profile and share your progress.</p><button class=btn data-c="go:cert">View certificate →</button></div>`}
<div class=grid2 id=homeStats>${homeStats()}</div>
<div class=card id=daily>${dailyH()}</div>
<div class=grid2>
 <div class=card><span class=eyebrow>Smart review</span><h3>${due ? `${due} card${due > 1 ? "s" : ""} to review` : "Nothing due right now"}</h3><p class=help>Questions you got wrong come back after 1, 2, 4, 8 and 16 days until you've mastered them.</p>${due ? `<button class="btn sm" data-c="revStart">Start review</button>` : `<p class=sub>${nextDueText()}</p>`}</div>
 <div class=card><span class=eyebrow>Practice studio</span><h3>Role-play & interviews</h3><p class=help>Pitch a sceptical CFO, handle an incident, or answer timed interview questions, and get scored.</p><button class="btn sm" data-c="go:practice">Open the studio</button></div>
 <div class=card><span class=eyebrow>Capstone</span><h3>Your AI PRD</h3><div class=bar><i style="width:${prdCount() / C.PRD.length * 100}%"></i></div><p class=sub>${prdCount()} of ${C.PRD.length} sections drafted</p><button class="btn sm g" data-c="go:prd">${prdCount() ? "Continue" : "Start"} the capstone</button></div>
 <div class=card><span class=eyebrow>Achievements</span><h3>${got.length} of ${ACH.length} unlocked</h3>${got.length ? `<div class=ach-row aria-hidden=true>${got.slice(-6).map((a) => `<span title="${a[2]}">${a[1]}</span>`).join("")}</div>` : '<p class=sub>Complete a lesson to earn your first badge.</p>'}<p style="margin-bottom:0"><button class="btn sm g" data-c="go:progress">See progress</button></p></div>
</div>
${!AU && ACC.on ? `<div class="card flat" style="border-color:var(--ac)"><span class=eyebrow>Keep your progress safe</span><h3>Sign in to save your progress to your account</h3><p class=help>Right now your progress lives only in this browser. Sign in with Google to continue on any device, and never lose it if you clear your browser.</p><button class=btn data-c=signin>Continue with Google</button></div>` : ""}
${S.product ? "" : productCard()}`
};
function homeStats() {
  const wk = weekCount(), tg = weekTarget(), st = streak();
  return ` <div class=card><span class=eyebrow>This week</span><div class=stat>${ring(wk, tg, `${Math.min(wk, 99)}/${tg}<small>days</small>`)}<div><b>${wk >= tg ? "Weekly goal reached 🎉" : `${tg - wk} more learning day${tg - wk == 1 ? "" : "s"} to hit your goal`}</b><p class=sub>Goal: ${tg} day${tg > 1 ? "s" : ""} a week, based on your ${Q[8][2][S.profile.time].toLowerCase()}.</p></div></div></div>
 <div class=card><span class=eyebrow>Streak</span><div class=stat><div class=streak aria-hidden=true>🔥</div><div><div class=big>${st} day${st == 1 ? "" : "s"}</div><p class=sub>${st ? "Keep it going: answer today's challenge." : "Do any lesson activity or today's challenge to start a streak."} Best: ${S.best || 0}</p></div></div></div>`
}
A.dismissNew = () => { delete S.newLessons; save(); render() };
function nextDueText() { const d = Object.values(S.rev).map((c) => c.due).sort()[0]; if (!d) return "Missed practice questions will appear here."; const n = daysBetween(dkey(), d); return `Next card due in ${n} day${n == 1 ? "" : "s"}.` }

// ---------------- Daily challenge ----------------
function pool() { return C.LESSONS.flatMap((l) => l.qs.map((q, i) => ({ lid: l.id, i, q }))) }
function todayQ() { const p = pool(); return p[hash(dkey() + "-aipm") % p.length] }
function dailyH() {
  const t = dkey(), it = todayQ(), q = it.q, d = S.daily[t] || { a: [] }, m = q.c.length > 1, sel = d.a || [];
  const top = `<div class=row><span class=eyebrow>Today's 1-minute challenge</span><span class=sub>${esc(L(it.lid).title)}</span></div><p><b>${esc(fillX(q.q))}</b>${m ? " <span class=sub>· select all that apply</span>" : ""}</p>`;
  const tiles = `<div class="tiles pr">${q.o.map((o, j) => tileH(o, !d.done && sel.includes(j), `dpick:${j}`, String.fromCharCode(65 + j), "", m, d.done ? (q.c.includes(j) ? "good" : sel.includes(j) ? "bad" : "dim") : "")).join("")}</div>`;
  if (d.done) return top + tiles + `<p><b>${d.ok ? "Correct! 🎉" : "Not quite."}</b> ${esc(q.e)}</p><p class=sub>${d.ok ? "" : "This question was added to your smart review. "}Come back tomorrow for a new challenge.</p>`;
  return top + tiles + `<button class=btn data-c="dcheck" ${sel.length ? "" : "disabled"}>Check answer</button>`;
}
A.dpick = (j) => { const t = dkey(), q = todayQ().q, d = S.daily[t] = S.daily[t] || { a: [] }; if (d.done) return; d.a = q.c.length > 1 ? (d.a.includes(j) ? d.a.filter((x) => x != j) : d.a.concat(j)) : [j]; save(); $$("#daily .opt").forEach((b, n) => { b.classList.toggle("on", d.a.includes(n)); b.setAttribute("aria-pressed", d.a.includes(n)) }); const cb = $('#daily [data-c="dcheck"]'); if (cb) cb.disabled = !d.a.length };
A.dcheck = () => { const t = dkey(), it = todayQ(), d = S.daily[t]; if (!d || !d.a.length) return; d.done = true; d.ok = d.a.slice().sort().join() == it.q.c.slice().sort().join(); if (!d.ok) addCard(it.lid, it.q); save(); act("daily", { ok: d.ok }); $("#daily").innerHTML = dailyH(); const hs = $("#homeStats"); if (hs) hs.innerHTML = homeStats(); toast(d.ok ? "Correct! 🎉" : "Not quite - see why below 👇") };

// ---------------- Smart review (spaced repetition) ----------------
const cardKey = (lid, q) => lid + "|" + hash(q.q);
function addCard(lid, q) { const k = cardKey(lid, q); S.rev[k] = { lid, q: { q: q.q, o: q.o, c: q.c, e: q.e }, due: addDays(dkey(), 1), iv: 1 }; save() }
function dueCards() { return Object.keys(S.rev || {}).filter((k) => S.rev[k].due <= dkey()) }
let RV = null;
A.revStart = () => { RV = { keys: shuffle(dueCards()), i: 0, a: [], done: false, right: 0 }; go("review") };
V.review = () => {
  document.title = "Review · AI PM Coach";
  if (!RV || !RV.keys.length) { app.innerHTML = `<h1>Smart review</h1><div class=card><p>Nothing to review right now. ${nextDueText()}</p><button class=btn data-c="go:home">Back home</button></div>`; return }
  if (RV.i >= RV.keys.length) { app.innerHTML = `<h1>Review complete 🧠</h1><div class=card><p class=big>${RV.right} / ${RV.keys.length}</p><p class=mu>Cards you got right come back later; the others return tomorrow. Mastered cards retire after 16 days.</p><button class=btn data-c="go:home">Back home</button></div>`; return }
  const k = RV.keys[RV.i], c = S.rev[k], q = c.q, m = q.c.length > 1, sel = RV.a;
  app.innerHTML = `<div class=row><h1 style="font-size:1.7rem">Smart review</h1><span class=sub>Card ${RV.i + 1} of ${RV.keys.length}</span></div><div class=bar><i style="width:${RV.i / RV.keys.length * 100}%"></i></div>
<div class=card><span class=eyebrow>${esc(L(c.lid) ? L(c.lid).title : "Review")}</span><p><b>${esc(fillX(q.q))}</b>${m ? " <span class=sub>· select all that apply</span>" : ""}</p>
<div class="tiles pr">${q.o.map((o, j) => tileH(o, !RV.done && sel.includes(j), `rpick:${j}`, String.fromCharCode(65 + j), "", m, RV.done ? (q.c.includes(j) ? "good" : sel.includes(j) ? "bad" : "dim") : "")).join("")}</div>
${RV.done ? `<p><b>${RV.ok ? "Correct! 🎉" : "Not quite."}</b> ${esc(q.e)}</p><button class=btn data-c="rnext">Next →</button>` : `<button class=btn data-c="rcheck" ${sel.length ? "" : "disabled"}>Check answer</button>`}</div>`
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
  document.title = "Roadmap · AI PM Coach";
  const r = S.road, dn = nDone(), nx = nextLesson(), mins = r.reduce((a, x) => a + (L(x.id) ? L(x.id).min : 0), 0);
  const stages = [...new Set(r.map((x) => L(x.id).stage))].sort();
  let n = 0;
  app.innerHTML = `<div class=row><h1>Your roadmap</h1><button class="btn g sm" data-c="go:prof">Edit profile</button></div>
<div class=bar><i style="width:${dn / r.length * 100}%"></i></div><p class=mu>${dn} of ${r.length} lessons complete · about ${Math.max(1, Math.ceil(mins / 60 / (S.w || 2)))} week${Math.ceil(mins / 60 / (S.w || 2)) > 1 ? "s" : ""} at your pace (${Math.round(mins / 60 * 10) / 10} hours in total)</p>
${stages.map((s) => { const items = r.filter((x) => L(x.id).stage == s), sm = items.reduce((a, x) => a + L(x.id).min, 0), sd = items.filter((x) => S.done[x.id]).length;
    return `<div class=stage-h><h2>${C.STAGES[s]}</h2><span class=sub>${sd}/${items.length} done · ${sm} min</span></div>` + items.map((it) => { n++; const l = L(it.id), done = S.done[it.id], cf = S.conf[it.id], isNext = it.id == nx;
      return `<div class="card lcard ${done ? "done" : ""} ${isNext ? "next" : ""}"><div class=num aria-hidden=true>${done ? "✓" : n}</div><div class=body><b>${l.title}</b><span class=sub>${l.min} min · ${it.d}${cf && cf.pre && cf.post ? ` · confidence ${cf.pre}→${cf.post}` : ""}</span><div style="margin-top:6px">${done ? '<span class="st d">Completed</span>' : isNext ? '<span class="pill hot">Next up</span>' : S.open[it.id] ? '<span class="st p">In progress</span>' : '<span class="st n">Not started</span>'}</div></div><button class="btn sm go ${done ? "g" : ""}" data-c="openL:${it.id}">${done ? "Review" : S.open[it.id] ? "Continue" : "Start"}</button></div>` }).join("") }).join("")}
<div class="card flat" style="margin-top:24px"><b>Finished your roadmap?</b><p class=help>The capstone PRD, the practice studio and your certificate are waiting.</p><button class="btn sm g" data-c="go:prd">Capstone</button> <button class="btn sm g" data-c="go:cert">Certificate</button></div>`
};

// ================= Lesson =================
A.openL = (id) => { if (!S.open[id]) { S.open[id] = 1; save(); ev("lesson_open", { id }) } go("lesson", id) };
const STEP_NAMES = [["video", "Video", "sec-video"], ["read", "Read", "sec-read"], ["practice", "Practice", "sec-practice"], ["reflect", "Reflect", "sec-reflect"], ["mentor", "Mentor", "sec-mentor"]];
const stepsOf = (id) => (S.steps[id] = S.steps[id] || {});
function markStep(k) { const id = S.cur, s = stepsOf(id); if (s[k]) return; s[k] = 1; save(); const b = $(`#stepsNav [data-step="${k}"]`); if (b) { b.classList.add("ok"); b.firstChild.textContent = "✓ " } if (k == "practice") finH() }
A.jump = (sec) => { const el = document.getElementById(sec); if (el) { const y = el.getBoundingClientRect().top + scrollY - 118; scrollTo({ top: y, behavior: "smooth" }) } };
let readObs = null;
V.lesson = () => {
  const l = L(S.cur); if (!l) { go("road"); return }
  const id = l.id, it = (S.road || []).find((x) => x.id == id) || { d: "Standard" }, st = stepsOf(id), cf = S.conf[id] || {};
  S.chat[id] = S.chat[id] || [];
  document.title = l.title + " · AI PM Coach";
  const und = l.und.map((p) => fillX(p)), skim = it.d == "Skim";
  app.innerHTML = `<button class="btn g sm" data-c="go:road">&larr; Roadmap</button><h1 style="margin-top:14px">${l.title}</h1><p class=mu style="margin-top:0">${l.min} min · ${C.STAGES[l.stage]} · ${it.d}${it.d == "Deep dive" ? " (the longer video is selected, and the further reading is worth it)" : skim ? " (short version first; expand if you need it)" : ""}</p>
<div class=steps-nav id=stepsNav aria-label="Lesson steps">${STEP_NAMES.map(([k, t, sec]) => `<button data-c="jump:${sec}" data-step="${k}" class="${st[k] ? "ok" : ""}"><span>${st[k] ? "✓ " : ""}</span>${t}</button>`).join("")}</div>
${cf.pre ? "" : `<div class="card flat" id=confPre><b>Before you start: how confident are you with ${esc(l.title.toLowerCase())}?</b>${scale5("pre")}</div>`}
<div class=card id=sec-why><span class=eyebrow>Why it matters</span><p>${esc(l.why)}</p></div>
<div class=card id=sec-video><span class=eyebrow>Learn</span><p class=help>Focus on the concepts behind product decisions; you don't need every technical detail.</p><div id=vd></div></div>
<div class="card und ${skim ? "" : "open"}" id=sec-read><span class=eyebrow>Understand</span><p>${und[0]}</p><div class=more>${und.slice(1).map((p) => `<p>${p}</p>`).join("")}</div>${skim ? `<button class="lnk showmore" data-c="undOpen">Show the full explanation</button>` : ""}
<p class=mu style="margin:18px 0 4px"><b>Go deeper</b> · further reading (opens in a new tab)</p>${l.reads.map((r) => `<a class=rd href="${esc(r[2])}" target=_blank rel="noopener noreferrer"><i aria-hidden=true>↗</i><span><b>${esc(r[0])}</b><span class=mu>${esc(r[1])} · ${esc(r[3])}</span></span></a>`).join("")}<span id=readEnd></span></div>
<div class=card id=sec-practice><span class=eyebrow>Practice</span><div id=pr></div></div>
<div class=card id=sec-reflect>${reflectH(l)}</div>
<div class=card id=sec-mentor><span class=eyebrow>AI Mentor</span><p class=help>Explain the concept in your own words and get feedback, or ask anything about it.</p><div id=ch class=chat aria-live=polite></div>
<textarea id=mi rows=2 data-enter=ask placeholder="Explain it, or ask a question... (Enter to send, Shift+Enter for a new line)"></textarea>
<div class=row style="margin-top:10px"><button class=btn data-c=ask id=askBtn>Send</button><button class="lnk" data-c=clearChat>Clear chat</button></div></div>
<div id=finbox></div>`;
  rv(); rp(); chatH(); finH();
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

// ---------------- Video ----------------
let embedBlocked = false;
function canEmbed() { return !embedBlocked && /^https?:$/.test(location.protocol) && window.origin && window.origin !== "null" }
function rv() {
  const el = $("#vd"); if (!el) return; const l = L(S.cur), Ls = l.videos, it = (S.road || []).find((x) => x.id == l.id) || {};
  const i = S.vs[l.id] ?? (it.d == "Deep dive" ? Ls.length - 1 : 0), v = Ls[Math.min(i, Ls.length - 1)];
  const player = canEmbed() ? `<iframe src="https://www.youtube-nocookie.com/embed/${v[0]}?rel=0&playsinline=1" title="${esc(v[1])}" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowfullscreen></iframe>`
    : `<a class=vc href="https://www.youtube.com/watch?v=${v[0]}" target=_blank rel=noopener data-c="vidOut"><span class=pl aria-hidden=true>▶</span><b>${esc(v[1])}</b><small>${esc(v[2])} · Watch on YouTube</small></a>`;
  el.innerHTML = `<div class=vw>${player}</div><p class=help>${canEmbed() ? `Video not playing? <a href="https://www.youtube.com/watch?v=${v[0]}" target=_blank rel=noopener>Watch it on YouTube</a>` : "Opens in a new tab on YouTube. Come back here for the practice and mentor."}</p><p><b>${esc(v[1])}</b><br><span class=mu>${esc(v[2])} · ${esc(v[3])}</span></p>
${Ls.length > 1 ? '<p class=mu>Choose a video</p>' + Ls.map((w, j) => `<button class="vrow ${w === v ? "on" : ""}" data-c="vid:${j}"><i aria-hidden=true>▶</i><span><b>${esc(w[1])}</b><br><span class=mu>${esc(w[2])} · ${esc(w[3])}</span></span></button>`).join("") : ""}`
}
A.vid = (j) => { S.vs[S.cur] = j; save(); rv() };
A.vidOut = (el) => { markStep("video"); window.open(el.href, "_blank", "noopener") };
// Clicking into the embedded player moves focus to the iframe, which blurs the window: count it as watching.
addEventListener("blur", () => setTimeout(() => { const a = document.activeElement; if (a && a.tagName == "IFRAME" && a.closest("#vd")) { markStep("video"); act("video", { id: S.cur }) } }, 0));
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
    el.innerHTML = `${dots}<h2>${n} / ${qs.length} correct ${n == qs.length ? "🏆" : n >= qs.length / 2 ? "👏" : "💪"}</h2><p class=mu>${n == qs.length ? "Perfect! Reflect on the lesson next, then mark it complete." : "Missed questions were added to your smart review, so you'll see them again in a day or two."}</p>
<div class=nav><button class="btn g arrow" data-c="pn:-1" aria-label="Previous question">←</button><span class=row><button class="btn g sm" data-c="pretry">Try again (shuffled)</button><button class="btn sm" data-c="pz">✨ New AI questions</button></span></div>`; return
  }
  const q = qs[st.i], sel = st.a[st.i] || [], k = st.k[st.i], good = k && okAt(st, qs, st.i);
  el.innerHTML = `${dots}<p class=mu>Question ${st.i + 1} of ${qs.length}${q.m ? " · select all that apply" : ""}</p><p><b>${esc(fillX(q.q))}</b></p>
<div class="tiles pr">${q.o.map((o, j) => tileH(o, !k && sel.includes(j), `ps:${j}`, String.fromCharCode(65 + j), "", q.m, k ? (q.c.includes(j) ? "good" : sel.includes(j) ? "bad" : "dim") : "")).join("")}</div>
${k ? `<p><b>${good ? "Correct! 🎉" : "Not quite."}</b> ${esc(q.e)}</p>${good ? "" : `<p><button class="btn g sm" data-c="why:${st.i}">💬 Ask the mentor why</button></p>`}` : ""}
<div class=nav>${st.i > 0 ? '<button class="btn g arrow" data-c="pn:-1" aria-label="Previous question">←</button>' : "<span></span>"}${k ? `<button class=btn data-c="pn:1">${st.i == qs.length - 1 ? "See results" : "Next"} →</button>` : `<button class=btn data-c="pc" ${sel.length ? "" : "disabled"}>Check answer</button>`}</div>`
}
A.ps = (j) => { const st = pst(), q = pqs()[st.i]; if (st.k[st.i]) return; let a = st.a[st.i] || []; a = q.m ? (a.includes(j) ? a.filter((x) => x != j) : a.concat(j)) : [j]; st.a[st.i] = a; save(); $$("#pr .opt").forEach((b, n) => { b.classList.toggle("on", a.includes(n)); b.setAttribute("aria-pressed", a.includes(n)) }); const cb = $('#pr [data-c="pc"]'); if (cb) cb.disabled = !a.length };
A.pc = () => { const st = pst(), qs = pqs(); if (!(st.a[st.i] || []).length) return; st.k[st.i] = 1; const good = okAt(st, qs, st.i); S.stats = S.stats || { n: 0, ok: 0 }; S.stats.n++; if (good) S.stats.ok++; if (!good) addCard(S.cur, qs[st.i]); save(); act("practice", { id: S.cur, ok: good }); rp(); toast(good ? "Correct! 🎉" : "Not quite - read the explanation 👇") };
A.pn = (d) => { const st = pst(); st.i = Math.max(0, st.i + d); save(); rp() };
A.pretry = () => { const st = pst(), qs = pqs().map((q) => { const order = shuffle(q.o.map((_, i) => i)); return { q: q.q, o: order.map((i) => q.o[i]), c: q.c.map((c) => order.indexOf(c)), e: q.e } }); S.pr[S.cur] = { i: 0, a: [], k: [], qs, seen: st.seen }; save(); rp() };
let gen = false;
A.pz = async () => {
  if (gen) return; const id = S.cur, old = pst(), seen = (old.seen || []).concat(pqs().map((q) => q.q)).slice(-40), el = $("#pr");
  gen = true; el.innerHTML = '<p class=mu>Writing new practice questions for you...</p>';
  try {
    const arr = await aiJSON({ mode: "questions", info: info(id), seen }, /\[[\s\S]*\]/);
    const qs = (Array.isArray(arr) ? arr : []).filter((a) => a && typeof a.q == "string" && Array.isArray(a.o) && a.o.length >= 3 && Array.isArray(a.c) && a.c.length && a.c.every((n) => Number.isInteger(n) && n >= 0 && n < a.o.length)).map((a) => ({ q: a.q, o: a.o.map(String), c: a.c, e: String(a.e || "") }));
    if (qs.length < 3) throw { code: "bad_format" };
    S.pr[id] = { i: 0, a: [], k: [], qs, seen }; save(); act("ai_questions"); toast("Fresh questions ready ✨")
  } catch (e) { toast(aiErr(e)) }
  gen = false; rp()
};
A.why = (i) => {
  const st = pst(), q = pqs()[i], mine = (st.a[i] || []).map((j) => q.o[j]), right = q.c.map((j) => q.o[j]);
  const box = $("#mi"); box.value = `In the practice question "${fillX(q.q)}", I chose "${mine.join('", "')}", but the right answer is "${right.join('", "')}". Can you explain why, and what I misunderstood?`;
  A.jump("sec-mentor"); A.ask();
};

// ---------------- Reflect ----------------
const refs = (id) => { const r = S.ref[id]; return Array.isArray(r) ? r : r ? [r] : [] };
function reflectH(l) {
  const id = l.id, a = refs(id), n = a.filter((v) => v && v.trim()).length;
  return `<span class=eyebrow>Reflect</span><p class=help>Apply the idea to your own work. Aim for 2-4 sentences: name a real feature or user, explain your reasoning, and note one risk or trade-off. Then tap <b>Get feedback</b> for coaching and an example answer. <b id=rfc>${n}</b> of ${l.reflect.length} answered, saved on this device.</p>
${l.reflect.map((r, k) => { const f = (S.rfb[id] || {})[k], cur = (a[k] || "").trim(); return `<div class=rq><span class=tag>${esc(r[0])}</span><p><b>${esc(fillX(r[1]))}</b></p><textarea class=rfa data-in="ref:${k}" rows=3 placeholder="Your answer..." aria-label="${esc(fillX(r[1]))}">${esc(a[k] || "")}</textarea><div class=rfr><button type=button class="btn g sm" data-c="rfg:${k}" id=rfb${k}>✨ Get feedback</button><span class="mu sm" id=rfm${k}></span></div><div id=rff${k}>${f ? fbBox(f, cur && cur !== f.for) : ""}</div></div>` }).join("")}`
}
IN.ref = (el, k) => { const id = S.cur, a = refs(id).slice(); a[+k] = el.value; S.ref[id] = a; const c = $("#rfc"); if (c) c.textContent = a.filter((v) => v && v.trim()).length; if (a.some((v) => v && v.trim().length >= 25)) markStep("reflect"); clearTimeout(IN._rt); IN._rt = setTimeout(save, 400) };
const busy = {};
A.rfg = async (k) => {
  const id = S.cur, l = L(id), q = fillX(l.reflect[k][1]), ta = $(`.rfa[data-in="ref:${k}"]`), a = (ta ? ta.value : "").trim(), msg = $("#rfm" + k), box = $("#rff" + k), btn = $("#rfb" + k);
  if (busy["rf" + k]) return;
  if (a.length < 25) { msg.textContent = "Write a little more first (a sentence or two) so the coach has something to review."; ta && ta.focus(); return }
  msg.textContent = ""; busy["rf" + k] = 1; btn.disabled = true; btn.textContent = "Reviewing..."; box.innerHTML = '<div class="rfb ld">Reviewing your answer...</div>';
  try { const f = normFb(await aiJSON({ mode: "reflect", info: info(id), question: q, answer: a })); f.for = a; (S.rfb[id] = S.rfb[id] || {})[k] = f; save(); markStep("reflect"); act("reflect_feedback", { rating: f.rating }); box.innerHTML = fbBox(f, false) }
  catch (e) { box.innerHTML = `<div class="rfb er">${esc(aiErr(e))}</div>` }
  finally { busy["rf" + k] = 0; btn.disabled = false; btn.textContent = "✨ Get feedback" }
};

// ---------------- Mentor ----------------
function starters() { const l = L(S.cur); return [`Quiz me on ${l.title.toLowerCase()}`, `Give me an example from ${IND()}`, "Explain it more simply", S.product ? "How does this apply to my product?" : "What should I ask engineers about this?"] }
function chatH() {
  const ch = $("#ch"); if (!ch) return; const h = S.chat[S.cur] || [], l = L(S.cur);
  ch.innerHTML = (h.length ? "" : `<div class="msg a coach">Hi! I'm your AI Mentor for "${esc(l.title)}". Try explaining the main idea in your own words, and I'll give you feedback. Or pick a starter below.</div><div class=chips>${starters().map((s, i) => `<button class=chip data-c="starter:${i}">${esc(s)}</button>`).join("")}</div>`)
    + h.map((m) => `<div class="msg ${m.r == "u" ? "u" : "a"}">${esc(m.t)}</div>`).join("");
}
A.starter = (i) => { $("#mi").value = starters()[i]; A.ask() };
A.clearChat = () => { if (!(S.chat[S.cur] || []).length) return; if (!confirm("Clear this lesson's chat with the mentor?")) return; S.chat[S.cur] = []; save(); chatH() };
A.ask = async () => {
  const box = $("#mi"), m = box.value.trim(); if (!m || busy.ask) return; const id = S.cur, h = S.chat[id] = S.chat[id] || [];
  const chips = $("#ch .chips"); if (chips) chips.remove(); const coach = $("#ch .coach"); if (coach) coach.remove();
  h.push({ r: "u", t: m }); box.value = ""; save(); markStep("mentor"); act("mentor", { id });
  const ch = $("#ch"), ue = document.createElement("div"); ue.className = "msg u"; ue.textContent = m; const live = document.createElement("div"); live.className = "msg a"; live.textContent = "Thinking..."; ch.append(ue, live); live.scrollIntoView({ block: "nearest" });
  const btn = $("#askBtn"); busy.ask = 1; if (btn) btn.disabled = true;
  try { const text = await ai({ mode: "mentor", info: info(id), messages: h.map((x) => ({ role: x.r == "u" ? "user" : "assistant", content: x.t })) }, (tx) => { live.textContent = tx; live.scrollIntoView({ block: "nearest" }) }); live.textContent = text; h.push({ r: "a", t: text }); save() }
  catch (e) { live.textContent = aiErr(e); live.classList.add("merr"); h.pop(); save() }
  finally { busy.ask = 0; if (btn) btn.disabled = false }
};

// ---------------- Completing a lesson ----------------
function finH() {
  const el = $("#finbox"); if (!el) return; const id = S.cur, done = S.done[id], practiced = stepsOf(id).practice;
  const nid = (S.road || []).map((x) => x.id).find((x) => !S.done[x] && x != id), nl = nid && L(nid);
  if (done) { el.innerHTML = `<div class="card done-box"><h3>✅ Lesson complete</h3>${roadDone() ? `<p>You've finished your whole roadmap! 🎓</p><button class=btn data-c="go:cert">Get your certificate →</button>` : nl ? `<p class=mu>Up next: <b>${nl.title}</b> · ${nl.min} min</p><button class=btn data-c="openL:${nid}">Next lesson →</button>` : ""} <button class="btn g" data-c="go:road">Roadmap</button> <button class="btn g" data-c="fb:${id}">Feedback on this lesson</button></div>`; return }
  el.innerHTML = `<div class="card flat"><div class="row">${practiced ? `<button class=btn data-c="fin">Mark lesson complete</button>` : `<button class=btn disabled>Mark lesson complete</button>`}<button class="btn g" data-c="fb:${id}">Feedback on this lesson</button></div>${practiced ? "" : `<p class=help style="margin-top:10px">Finish the practice quiz to complete this lesson.</p>`}</div>`
}
A.fin = () => {
  const id = S.cur; if (!stepsOf(id).practice) { toast("Finish the practice quiz first"); A.jump("sec-practice"); return }
  if (!(S.conf[id] || {}).post) { $("#finbox").innerHTML = `<div class="card flat"><b>Last step: how confident are you now with ${esc(L(id).title.toLowerCase())}?</b>${scale5("post")}</div>`; return }
  completeLesson()
};
function completeLesson() {
  const id = S.cur; if (S.done[id]) { finH(); return } S.done[id] = 1; save(); act("lesson_done", { id });
  const c = S.conf[id] || {}; toast(c.pre && c.post > c.pre ? `Lesson complete ✅ Confidence up from ${c.pre} to ${c.post}!` : "Lesson complete ✅ Keep going"); finH();
}

// ================= Practice studio =================
V.practice = () => {
  document.title = "Practice studio · AI PM Coach";
  app.innerHTML = `<h1>Practice studio</h1><p class=mu style="margin-top:0">Practise the conversations AI PMs have every week. The AI plays the other person, then scores you and shows how to do better.${S.product ? "" : " Tip: add your product on the Home page to make scenarios more personal."}</p>
<h2 style="margin-top:22px">🎭 Role-play simulator</h2><div class=grid2>${C.SCEN.map((s) => { const r = S.rp[s.id] || {}; return `<div class=card><span aria-hidden=true style="font-size:1.6rem">${s.icon}</span><h3>${esc(s.title)}</h3><p class=help><b>${esc(s.character)}</b> · ${esc(s.goal)}</p><div class=row><button class="btn sm" data-c="rpOpen:${s.id}">${r.msgs && r.msgs.length && !r.score ? "Continue" : "Start"}</button>${r.best ? `<span class=pill>Best ${r.best}/10</span>` : ""}</div></div>` }).join("")}</div>
<h2 style="margin-top:26px">🎤 Interview simulator</h2><p class=help>Timed AI PM interview questions, scored by an AI hiring manager. Aim for a structured answer in about 3 minutes.</p>
<div class=grid2>${C.IVQ.map((q) => { const r = S.iv[q.id] || {}; return `<div class=card><span class=tag>${esc(q.cat)}</span><p style="margin:8px 0"><b>${esc(fillX(q.q))}</b></p><div class=row><button class="btn sm" data-c="ivOpen:${q.id}">${r.score ? "Try again" : "Answer"}</button>${r.best ? `<span class=pill>Best ${r.best}/10</span>` : ""}</div></div>` }).join("")}</div>`
};

// ---------------- Role-play ----------------
const rpS = () => (S.rp[S.rpid] = S.rp[S.rpid] || { msgs: [], best: 0 });
A.rpOpen = (id) => { S.rpid = id; ev("roleplay_open", { id }); go("rp") };
V.rp = () => {
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
A.rpSend = async () => { const i = $("#rpi"), t = i && i.value.trim(); if (!t || busy.rp) return; const r = rpS(); r.msgs.push({ r: "u", t }); i.value = ""; save(); act("roleplay_turn", { id: S.rpid }); V.rp(); await rpTurn(); if (r.msgs.filter((m) => m.r == "u").length >= 2) V.rp() };
A.rpScore = async () => {
  const r = rpS(), box = $("#rpscore"), b = $("#rpEnd"); if (busy.rps) return; busy.rps = 1; if (b) { b.disabled = true; b.textContent = "Scoring..." } box.innerHTML = '<div class="rfb ld">Scoring your conversation...</div>';
  try { const sc = normScore(await aiJSON({ mode: "roleplay_score", scenario: S.rpid, info: info(), messages: r.msgs.map((m) => ({ role: m.r == "u" ? "user" : "assistant", content: m.t })) })); r.score = sc; r.best = Math.max(r.best || 0, sc.score); r.runs = (r.runs || 0) + 1; save(); act("roleplay_score", { id: S.rpid, score: sc.score }); V.rp() }
  catch (e) { box.innerHTML = `<div class="rfb er">${esc(aiErr(e))}</div>`; if (b) { b.disabled = false; b.textContent = "End & get my score" } }
  finally { busy.rps = 0 }
};
A.rpReset = () => { const r = rpS(); r.msgs = []; r.score = null; save(); V.rp() };

// ---------------- Interview ----------------
let IVT = null;
const ivS = () => (S.iv[S.ivid] = S.iv[S.ivid] || { answer: "", best: 0 });
A.ivOpen = (id) => { S.ivid = id; const r = ivS(); if (r.score) { r.score = null; r.answer = "" } save(); ev("interview_open", { id }); go("iv") };
V.iv = () => {
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
A.ivSubmit = async () => {
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
${C.PRD.map((p, i) => { const f = S.prd.fb[p.id], cur = (S.prd.sec[p.id] || "").trim(); return `<div class=card id="prd-${p.id}"><span class=eyebrow>${i + 1}. ${esc(p.title)}</span><p class=help>${esc(p.guide)}</p><textarea rows=5 data-in="prdSec:${p.id}" placeholder="${esc(p.ph)}" aria-label="${esc(p.title)}">${esc(S.prd.sec[p.id] || "")}</textarea><div class=rfr><button class="btn g sm" data-c="prdRev:${p.id}" id="prdb-${p.id}">✨ Review this section</button><span class="mu sm" id="prdm-${p.id}"></span></div><div id="prdf-${p.id}">${f ? fbBox(f, cur && cur !== f.for, "See an improved version") : ""}</div></div>` }).join("")}`
};
IN.prdTitle = (el) => { S.prd.title = el.value.slice(0, 120); clearTimeout(IN._pt2); IN._pt2 = setTimeout(save, 400) };
IN.prdSec = (el, id) => { S.prd.sec[id] = el.value; clearTimeout(IN._ps); IN._ps = setTimeout(() => { save(); checkAch() }, 500); const n = prdCount(), b = $("#prdBar"), t = $("#prdN"); if (b) b.style.width = n / C.PRD.length * 100 + "%"; if (t) t.textContent = `${n} of ${C.PRD.length} sections drafted` };
A.prdRev = async (id) => {
  const text = (S.prd.sec[id] || "").trim(), msg = $("#prdm-" + id), box = $("#prdf-" + id), btn = $("#prdb-" + id); if (busy["prd" + id]) return;
  if (text.length < 40) { msg.textContent = "Write a few sentences first so the reviewer has something to work with."; return }
  msg.textContent = ""; busy["prd" + id] = 1; btn.disabled = true; btn.textContent = "Reviewing..."; box.innerHTML = '<div class="rfb ld">Reviewing your section...</div>';
  try { const f = normFb(await aiJSON({ mode: "prd", section: id, title: S.prd.title || "", info: info(), text })); f.for = text; S.prd.fb[id] = f; save(); act("prd_review", { id, rating: f.rating }); box.innerHTML = fbBox(f, false, "See an improved version") }
  catch (e) { box.innerHTML = `<div class="rfb er">${esc(aiErr(e))}</div>` }
  finally { busy["prd" + id] = 0; btn.disabled = false; btn.textContent = "✨ Review this section" }
};
function prdMarkdown() { return `# ${S.prd.title || "AI feature PRD"}\n\n_Written with AI PM Coach_\n\n` + C.PRD.map((p) => `## ${p.title}\n\n${(S.prd.sec[p.id] || "").trim() || "_Not written yet._"}\n`).join("\n") }
A.prdDownload = () => { download(((S.prd.title || "ai-prd").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ai-prd") + ".md", prdMarkdown()); ev("prd_download") };
A.prdCopy = async () => { try { await navigator.clipboard.writeText(prdMarkdown()); toast("PRD copied to the clipboard 📋") } catch (e) { toast("Couldn't copy. Use Download instead.") } };

// ================= Progress =================
function accuracy() { const t = S.stats; return t && t.n ? Math.round(t.ok / t.n * 100) : null }
V.progress = () => {
  if (!S.profile) { go("land"); return }
  document.title = "Progress · AI PM Coach"; const acc = accuracy(), got = ACH.filter((a) => S.ach[a[0]]).length;
  const confRows = (S.road || []).map((x) => ({ l: L(x.id), c: S.conf[x.id] })).filter((r) => r.c && r.c.pre);
  app.innerHTML = `<h1>Your progress</h1>
<div class=grid3><div class="card flat"><div class=big>${nDone()}/${(S.road || []).length}</div><p class=sub>lessons complete</p></div><div class="card flat"><div class=big>🔥 ${streak()}</div><p class=sub>day streak (best ${S.best || 0})</p></div><div class="card flat"><div class=big>${acc == null ? "-" : acc + "%"}</div><p class=sub>practice accuracy</p></div></div>
<div class=card><span class=eyebrow>Certificate</span>${roadDone() ? `<h3>🎓 Unlocked</h3><p class=help>Add it to your LinkedIn profile or save it as a PDF.</p><button class=btn data-c="go:cert">View certificate</button>` : `<h3>Finish your roadmap to unlock it</h3><div class=bar><i style="width:${nDone() / (S.road || [1]).length * 100}%"></i></div><p class=sub>${(S.road || []).length - nDone()} lessons to go</p><button class="btn g sm" data-c="go:cert">Preview</button>`}</div>
<div class=card><span class=eyebrow>Skill radar</span>${radar()}</div>
<div class=card><span class=eyebrow>Confidence</span>${confRows.length ? confRows.map((r) => `<div class=cbar><span>${esc(r.l.title)}</span><span class=t title="Before ${r.c.pre}, after ${r.c.post || "-"}"><i class=pre style="width:${r.c.pre * 20}%"></i>${r.c.post ? `<i class=post style="width:${r.c.post * 20}%"></i>` : ""}</span></div>`).join("") + `<p class=legend><span><i style="background:var(--mu);opacity:.45"></i>Before the lesson</span><span><i style="background:var(--ac)"></i>After</span></p>` : '<p class=help>Rate your confidence at the start and end of each lesson to see your growth here.</p>'}</div>
<div class=card><span class=eyebrow>Achievements · ${got} of ${ACH.length}</span><div class=ach>${ACH.map(([id, e, n, d]) => `<div class="${S.ach[id] ? "" : "lock"}"><span class=e aria-hidden=true>${e}</span><b>${n}</b><span>${d}</span></div>`).join("")}</div></div>
<div class=card><span class=eyebrow>Your data</span><p class=help>${AU ? `Your progress is saved to your account (${esc(AU.email)}) and in this browser.` : "Your progress is stored only in this browser."} Download a copy, or delete everything and start over.</p><button class="btn g sm" data-c=exportData>Download my data</button> <button class="btn danger sm" data-c=resetAll>Delete all my progress</button></div>`
};
A.exportData = () => { download("ai-pm-coach-data.json", JSON.stringify(S, null, 1), "application/json") };
A.resetAll = () => { if (AU) { go("account"); toast("To delete your saved progress, delete your account data here."); return } if (!confirm("Delete all your progress, answers and chats on this device? This can't be undone.")) return; const theme = S.theme, consent = S.consent; S = { theme, consent }; initState(); save(); ev("reset"); go("land"); toast("Everything was deleted from this device.") };

// ================= Certificate =================
const CERT_TITLE = "AI Product Management Foundations";
V.cert = () => {
  document.title = "Certificate · AI PM Coach";
  if (!roadDone()) { const left = (S.road || []).filter((x) => !S.done[x.id]); app.innerHTML = `<h1>Your certificate</h1><div class=card><h3>🔒 Finish your roadmap to unlock it</h3><div class=bar><i style="width:${nDone() / Math.max(1, (S.road || []).length) * 100}%"></i></div><p class=mu>Still to do:</p><ul>${left.map((x) => `<li>${L(x.id).title}</li>`).join("")}</ul>${left[0] ? `<button class=btn data-c="openL:${left[0].id}">Continue learning →</button>` : ""}</div>`; return }
  if (!S.cert) { S.cert = { name: "", date: dkey(), id: "AIPM-" + Math.random().toString(36).slice(2, 8).toUpperCase() }; save(); ev("cert_unlocked") }
  const c = S.cert, [y, m] = c.date.split("-"), hours = Math.round((S.road || []).reduce((a, x) => a + L(x.id).min, 0) / 6) / 10, enc = encodeURIComponent;
  const add = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${enc(CERT_TITLE)}&organizationName=${enc("AI PM Coach")}&issueYear=${+y}&issueMonth=${+m}&certUrl=${enc(CFG.siteUrl)}&certId=${enc(c.id)}`;
  const share = `https://www.linkedin.com/sharing/share-offsite/?url=${enc(CFG.siteUrl)}`;
  app.innerHTML = `<div class=no-print><h1>Your certificate 🎓</h1><div class="card flat"><label class=fl for=certName>Name on the certificate</label><input id=certName data-in=certName maxlength=60 placeholder="Your full name" value="${esc(c.name)}"></div></div>
<div class=cert><div class=seal aria-hidden=true>🏅</div><p class=mu style="letter-spacing:.12em;text-transform:uppercase;font-weight:700;margin:0">Certificate of completion</p><h2>${CERT_TITLE}</h2><p class=mu>This certifies that</p><div class=nm id=certNm>${esc(c.name) || "Your name"}</div><p>has completed the AI PM Coach roadmap: ${(S.road || []).length} lessons (about ${hours} hours) covering AI fundamentals, product discovery, AI design, RAG, evaluation, safety and AI product strategy.</p>
<div class=meta><span>Issued ${new Date(c.date + "T12:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}<br>Credential ID ${esc(c.id)}</span><span style="text-align:right">AI PM Coach<br>${esc(CFG.siteUrl.replace(/^https?:\/\//, ""))}</span></div></div>
<div class="row l no-print" style="margin-top:16px"><button class=btn data-c=certPrint>Save as PDF / print</button><a class="btn g" href="${add}" target=_blank rel=noopener data-track=cert_linkedin_add style="text-decoration:none">Add to LinkedIn profile</a><a class="btn g" href="${share}" target=_blank rel=noopener data-track=cert_linkedin_share style="text-decoration:none">Share on LinkedIn</a></div>
<p class="help no-print">This certificate confirms completion of a self-paced learning programme. It isn't an accredited qualification.</p>`
};
IN.certName = (el) => { S.cert.name = el.value.slice(0, 60); save(); const n = $("#certNm"); if (n) n.textContent = S.cert.name || "Your name" };
A.certPrint = () => { ev("cert_print"); window.print() };
document.addEventListener("click", (e) => { const a = e.target.closest("a[data-track]"); if (a) ev(a.dataset.track) });

// ================= About & privacy =================
V.about = () => {
  const o = CFG.owner || {}, ini = (o.name || "AI").split(" ").map((w) => w[0]).join("").slice(0, 2);
  document.title = "About · AI PM Coach";
  app.innerHTML = `<button class="btn g sm" data-c="go:${S.profile ? "home" : "land"}">&larr; Home</button><span class=eyebrow style="display:table;margin-top:22px">About</span><h1>About AI PM Coach</h1>
${o.name ? `<div class=card><div class=row style="justify-content:flex-start;gap:16px;flex-wrap:nowrap"><div class=av aria-hidden=true>${esc(ini)}</div><div><p class=mu style="margin:0">Created by</p><b style="font-size:1.25rem">${esc(o.name)}</b><br><span class=mu>${esc(o.role || "")}</span></div></div>${(o.bio || []).map((p) => `<p>${esc(p)}</p>`).join("")}${o.linkedin ? `<p style="margin-bottom:0"><a class="btn g" style="display:inline-block;text-decoration:none;padding:10px 18px" href="${esc(o.linkedin)}" target=_blank rel=noopener>Connect on LinkedIn ↗</a></p>` : ""}</div>` : ""}
<div class=card><span class=eyebrow>What this app does</span><p>AI PM Coach helps product managers build the skills to work on AI products. A 2-minute assessment of your experience, technical comfort, AI knowledge and goals produces a personal roadmap, sized to the time you have each week.</p><p>Each lesson combines a short video, a written explanation with further reading, practice questions in your industry, and reflection questions with AI feedback. Beyond lessons you'll find a daily challenge, smart review, role-play and interview simulators, a capstone AI PRD and a certificate.</p></div>
<div class=card><span class=eyebrow>Your data</span><p style="margin:0">Your progress is saved in this browser, and in your account if you sign in with Google. When you use an AI feature, what you type is sent to our server and to Anthropic to generate the reply. Details are in the <button class=lnk data-c="go:privacy">privacy notice</button>.</p></div>
<div class=card><span class=eyebrow>Help improve it</span><p>Found a bug, want a topic covered, or have an idea? I'd love to hear it.</p><button class=btn data-c="fb">Give feedback</button></div>`
};
V.privacy = () => {
  document.title = "Privacy · AI PM Coach"; const o = CFG.owner || {};
  app.innerHTML = `<button class="btn g sm" data-c="go:${S.profile ? "home" : "land"}">&larr; Home</button><h1 style="margin-top:14px">Privacy notice</h1><p class=mu>Plain-language summary of what happens to your data.</p>
<div class=card><h3>Stored in your browser</h3><p>Your assessment answers, roadmap, progress, reflections, chats, simulator answers and PRD drafts are saved in this browser's local storage. If you don't sign in, we don't have a copy. Clearing your browser data deletes them, and you can also download or delete everything on the <button class=lnk data-c="go:progress">Progress</button> page.</p></div>
<div class=card><h3>If you sign in</h3><p>Signing in is optional and uses your <b>Google</b> account through <b>Supabase</b>, our account and database provider. We receive your name and email address from Google. Your progress is then also stored in our Supabase database so you can continue on any device, and we record the days you use the app and how often you sign in, to understand how many people use it. The site owner can see your name, email, sign-up date, last activity and lessons completed. You can delete your account and all its data at any time on the <button class=lnk data-c="go:account">Account</button> page.</p></div>
<div class=card><h3>Sent when you use AI features</h3><p>When you use the AI Mentor, reflection feedback, new practice questions, the PRD review, role-play or interview scoring, the text you enter, your assessment answers (level, industry and goal), your product description if you added one, and the current lesson are sent to this site's server function (hosted by Netlify) and passed to <b>Anthropic</b>, which provides the Claude AI model, to generate the reply. Don't enter confidential or personal information in these features. The server doesn't store your messages; it keeps a daily request counter per visitor (an anonymised hash of your IP address) to prevent abuse, and hosting logs may record technical errors.</p></div>
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
  if (F.sent) { app.innerHTML = `<span class=eyebrow>Feedback</span><h1>Thank you! 🙏</h1><div class=card><p style="margin-top:0">Your feedback was sent. Every message is read and helps decide what to improve next.</p><div class="row l"><button class=btn data-c="fbback">Back to where I was</button><button class="btn g" data-c="fb">Send more feedback</button></div></div>`; return }
  app.innerHTML = `<button class="btn g sm" data-c="fbback">&larr; Back</button><span class=eyebrow style="display:table;margin-top:22px">Feedback</span><h1>Help improve AI PM Coach</h1><p class=mu>Tell me what's working, what isn't, and what you'd like to see. It takes about a minute.</p>
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
  try { const r = await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() }); if (!r.ok) throw new Error(r.status); F.sent = true; ev("feedback"); V.feedback(); window.scrollTo(0, 0); toast("Feedback sent - thank you! 🙏") }
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
    if (e.code == "session_expired") { AU = null; saveAuth(); renderNav(); toast("Your session ended. Please sign in again to keep saving your progress.") }
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
  const maps = ["done", "ach", "open", "steps", "conf", "chat", "pr", "rfb", "rp", "iv", "rev", "daily", "vs"];
  for (const k of maps) { const r = remote[k] || {}, l = S[k] = S[k] || {}; for (const id in r) if (!(id in l)) l[id] = r[id] }
  for (const d in remote.days || {}) S.days[d] = Math.max(S.days[d] || 0, remote.days[d]);
  for (const id in remote.ref || {}) { const r = remote.ref[id], l = S.ref[id]; if (!l) S.ref[id] = r; else if (Array.isArray(r) && Array.isArray(l)) r.forEach((v, i) => { if (v && !(l[i] || "").trim()) l[i] = v }) }
  if (remote.prd) { S.prd.title = S.prd.title || remote.prd.title || ""; for (const sec in remote.prd.sec || {}) if (!(S.prd.sec[sec] || "").trim()) S.prd.sec[sec] = remote.prd.sec[sec]; for (const f in remote.prd.fb || {}) if (!S.prd.fb[f]) S.prd.fb[f] = remote.prd.fb[f] }
  if (!S.product && remote.product) S.product = remote.product;
  if (!S.cert && remote.cert) S.cert = remote.cert;
  S.best = Math.max(S.best || 0, remote.best || 0); S.revOk = Math.max(S.revOk || 0, remote.revOk || 0);
  if (remote.stats && (!S.stats || remote.stats.n > S.stats.n)) S.stats = remote.stats;
}
function adopt(remote, ts) {
  const keep = { ev: S.ev, theme: S.theme, consent: S.consent, view: S.view && !["land", "quiz", "prof", "syncChoice"].includes(S.view) ? S.view : "home", cur: S.cur };
  S = { ...remote, ...keep }; S.acct = AU.email; S.syncedAt = ts; S.dirty = 0; initState(); saveLocal(); applyTheme(); render();
}
async function pull(first) {
  if (!AU || !AU.email) return; lastPull = Date.now();
  let r; try { r = await acc({ action: "load" }) } catch (e) { syncBadge(e.code); return }
  const remote = r.state, ts = r.updated_at;
  if (!remote || !hasProgress(remote)) { if (hasProgress(S)) { S.acct = AU.email; await push(true); if (first) toast("Your progress is now saved to your account ☁️") } else S.acct = AU.email; saveLocal(); return }
  if (S.acct == AU.email) {                   // this device already belongs to this account
    if (S.syncedAt == ts) { if (S.dirty) push(); return }
    if (!S.dirty) { adopt(remote, ts); if (!first) toast("Updated with your progress from another device") } else { mergeFrom(remote); S.syncedAt = ts; saveLocal(); push(true) }
    return;
  }
  if (!hasProgress(S)) { adopt(remote, ts); toast("Welcome back! Your progress is loaded ☁️"); return }
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
A.keepRemote = () => { const c = CH; CH = null; adopt(c.remote, c.ts); go("home"); toast("Loaded the progress from your account ☁️") };
A.keepLocal = async () => { const c = CH; CH = null; S.acct = AU.email; S.syncedAt = c.ts; await push(true); go("home"); toast("This browser's progress is now saved to your account ☁️") };
function syncBadge(err) { const el = $("#syncState"); if (!el) return; el.textContent = err ? "Couldn't save to your account just now. We'll retry automatically." : S.syncedAt ? `Saved to your account ${new Date(S.syncedAt).toLocaleString()}` : "Saving..." }
A.syncNow = async () => { await push(true); await pull(); syncBadge(); toast("Synced ☁️") };
A.signout = async () => {
  if (S.dirty) await push(true);
  if (!confirm("Sign out? Your progress stays saved in your account, and it will be removed from this browser.")) return;
  const theme = S.theme, consent = S.consent; AU = null; saveAuth(); S = { theme, consent }; initState(); saveLocal(); ev("signout"); go("land"); toast("Signed out");
};
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
  if (!ACC.checked) accPost({ action: "status" }, false).then((d) => { ACC.on = !!(d && d.accounts); ACC.checked = true; try { sessionStorage.setItem("aipm_acc", JSON.stringify({ on: ACC.on })) } catch (e) { } renderNav(); if (S.view == "home" || S.view == "account") render() }).catch(() => { });
  if (!AU) return;
  try { const d = await acc({ action: "session", login: fresh }); AU.email = d.user.email; AU.name = d.user.name; AU.admin = !!d.admin; saveAuth(); ACC.on = true; if (fresh) { ev("login"); toast(`Signed in as ${AU.email} ✅`) } renderNav(); await pull(true); if (S.view == "admin") V.admin() }
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
function admH() {
  const d = ADM, k = d.kpi, el = $("#adm"); if (!el) return;
  const tile = (v, l) => `<div class="card flat"><div class=big>${v}</div><p class=sub>${l}</p></div>`;
  el.innerHTML = `<p class=mu style="margin-top:0">Signed-in learners only · days in ${esc(d.timezone)} · today is ${fmtD(d.today + "T12:00:00")}. <button class=lnk data-c=admReload>Refresh</button></p>
<div class="grid3 kpis">${tile(k.loginsToday, "sign-ins today")}${tile(k.activeToday, "active users today")}${tile(k.newToday, "new sign-ups today")}${tile(k.active7, "active in the last 7 days")}${tile(k.active30, "active in the last 30 days")}${tile(k.totalUsers, "accounts in total")}</div>
<div class=card><span class=eyebrow>Last 14 days</span><div class=legend style="justify-content:flex-start;margin:6px 0 4px"><span><i style="background:var(--c1)"></i>Active users</span><span><i style="background:var(--c2)"></i>Sign-ins</span></div>${admChart(d.series)}
<details><summary class=sub>Show as a table</summary><table class=tbl><tr><th>Day</th><th>Active users</th><th>Sign-ins</th><th>New sign-ups</th></tr>${d.series.slice().reverse().map((r) => `<tr><td>${fmtD(r.day + "T12:00:00")}</td><td>${r.active}</td><td>${r.logins}</td><td>${r.signups}</td></tr>`).join("")}</table></details></div>
<div class=card><span class=eyebrow>Learners (${d.users.length})</span><div class=tscroll><table class=tbl><tr><th>Learner</th><th>Joined</th><th>Last active</th><th>Active days (30d)</th><th>Lessons</th></tr>${d.users.map((u) => `<tr><td><b>${esc(u.name || "-")}</b><br><span class=sub>${esc(u.email)}</span></td><td>${fmtD(u.joined)}</td><td>${fmtD(u.lastActive || u.lastSignIn)}</td><td>${u.activeDays30}</td><td>${u.lessonsDone}/${u.lessonsTotal || "-"}</td></tr>`).join("") || '<tr><td colspan=5 class=sub>No accounts yet.</td></tr>'}</table></div></div>
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
initState(); applyTheme();
if (isAdminURL()) S.view = "admin"; else if (S.view == "admin") S.view = S.profile ? "home" : "land";
if (!S.view || (S.view == "land" && S.profile && S.road)) S.view = S.profile && S.road ? "home" : "land";
if (S.view == "quiz" && !S.draft) S.view = S.profile ? "prof" : "land";
render(); consentBanner(); loadPostHog(); checkAch(); startAccounts();
