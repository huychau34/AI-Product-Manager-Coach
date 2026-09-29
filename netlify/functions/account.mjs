// AI PM Coach - accounts, cloud progress and sign-in tracking (Netlify Function)
//
// Learners sign in with Google through Supabase Auth. Their progress is stored in your
// Supabase database, and every sign-in and every day they use the app is recorded, so the
// admin dashboard (/admin) can show sign-ins and active users per day.
// All database access happens here, with the secret key, so it never reaches the browser.
//
// Settings (Netlify > Project configuration > Environment variables):
//   SUPABASE_URL          required  e.g. https://abcd1234.supabase.co
//   SUPABASE_ANON_KEY     required  the project's "anon" / "publishable" key
//   SUPABASE_SERVICE_KEY  required  the project's "service_role" / "secret" key (mark as secret!)
//   ADMIN_EMAILS          required for /admin  comma-separated emails allowed to see the dashboard
//   STATS_TIMEZONE        optional  timezone for "today" in stats (default Europe/Helsinki)
//   ALLOWED_ORIGINS       optional  extra origins allowed to call this API, comma-separated

const env = (k) => (process.env[k] || "").trim();
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const configured = () => env("SUPABASE_URL") && env("SUPABASE_ANON_KEY") && env("SUPABASE_SERVICE_KEY");
const base = () => env("SUPABASE_URL").replace(/\/+$/, "");
function keyHeaders(key) { const h = { apikey: key }; if (key.startsWith("eyJ")) h.Authorization = `Bearer ${key}`; return h }
const svc = () => ({ ...keyHeaders(env("SUPABASE_SERVICE_KEY")), "Content-Type": "application/json" });
function dayIn(tz, d = new Date()) { try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d) } catch { return d.toISOString().slice(0, 10) } }
const TZ = () => env("STATS_TIMEZONE") || "Europe/Helsinki";

function originAllowed(req) {
  const origin = req.headers.get("origin"); if (!origin) return false;
  try { const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host; if (new URL(origin).host === host) return true } catch { return false }
  return env("ALLOWED_ORIGINS").split(",").map((s) => s.trim()).filter(Boolean).includes(origin);
}

// Verifies the learner's access token with Supabase and returns their user record.
async function verify(req) {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i); if (!m) return null;
  const r = await fetch(`${base()}/auth/v1/user`, { headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: `Bearer ${m[1]}` } });
  if (!r.ok) return null;
  const u = await r.json(); if (!u || !u.id) return null;
  const md = u.user_metadata || {};
  return { id: u.id, email: (u.email || "").toLowerCase(), name: md.full_name || md.name || "" };
}
const isAdmin = (u) => !!u && !!u.email && env("ADMIN_EMAILS").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean).includes(u.email);

async function rest(path, opts = {}) {
  const r = await fetch(`${base()}/rest/v1/${path}`, { ...opts, headers: { ...svc(), ...(opts.headers || {}) } });
  const text = await r.text(); let data = null; try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!r.ok) { console.error("Supabase REST error", r.status, path.split("?")[0], String(text).slice(0, 300)); throw new Error("db_error") }
  return data;
}
async function track(uid, isLogin) {
  try { await rest("rpc/track_activity", { method: "POST", body: JSON.stringify({ uid, d: dayIn(TZ()), is_login: !!isLogin }) }) } catch (e) { console.warn("track_activity failed") }
}
// Keep synced state reasonably small: the local analytics log isn't needed in the cloud.
function cleanState(s) {
  if (!s || typeof s !== "object" || Array.isArray(s)) return null;
  const out = { ...s }; delete out.ev; delete out.view;
  const str = JSON.stringify(out); if (str.length > 1_500_000) return null;
  return out;
}

async function dashboard() {
  const tz = TZ(), today = dayIn(tz), since = dayIn(tz, new Date(Date.now() - 29 * 864e5));
  // Users (Supabase Auth admin API), activity for the last 30 days, and a progress summary.
  let users = [], page = 1;
  for (; page <= 20; page++) {
    const r = await fetch(`${base()}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: svc() });
    if (!r.ok) { console.error("Auth admin error", r.status, (await r.text()).slice(0, 300)); throw new Error("auth_admin_error") }
    const d = await r.json(), list = d.users || d || []; users = users.concat(list); if (list.length < 1000) break;
  }
  const act = await rest(`activity?day=gte.${since}&select=user_id,day,logins,pings,last_seen&limit=100000`);
  const prog = await rest(`progress?select=user_id,updated_at,done:state->done,road:state->road&limit=100000`);
  const days = []; for (let i = 13; i >= 0; i--) days.push(dayIn(tz, new Date(Date.now() - i * 864e5)));
  const byDay = Object.fromEntries(days.map((d) => [d, { day: d, active: 0, logins: 0, signups: 0 }]));
  const lastActive = {}, activeDays = {};
  for (const a of act) {
    if (byDay[a.day]) { byDay[a.day].active++; byDay[a.day].logins += a.logins || 0 }
    activeDays[a.user_id] = (activeDays[a.user_id] || 0) + 1;
    if (!lastActive[a.user_id] || a.last_seen > lastActive[a.user_id]) lastActive[a.user_id] = a.last_seen;
  }
  for (const u of users) { const d = dayIn(tz, new Date(u.created_at)); if (byDay[d]) byDay[d].signups++ }
  const pmap = Object.fromEntries((prog || []).map((p) => [p.user_id, p]));
  const inLast = (n) => { const from = dayIn(tz, new Date(Date.now() - (n - 1) * 864e5)); return new Set(act.filter((a) => a.day >= from).map((a) => a.user_id)).size };
  const t = byDay[today] || { active: 0, logins: 0, signups: 0 };
  return {
    today, timezone: tz,
    kpi: { loginsToday: t.logins, activeToday: t.active, newToday: t.signups, active7: inLast(7), active30: inLast(30), totalUsers: users.length },
    series: days.map((d) => byDay[d]),
    users: users.map((u) => {
      const p = pmap[u.id] || {}, md = u.user_metadata || {}, done = p.done && typeof p.done === "object" ? Object.keys(p.done).length : 0, road = Array.isArray(p.road) ? p.road.length : 0;
      return { email: u.email || "", name: md.full_name || md.name || "", joined: u.created_at, lastSignIn: u.last_sign_in_at, lastActive: lastActive[u.id] || null, activeDays30: activeDays[u.id] || 0, lessonsDone: done, lessonsTotal: road };
    }).sort((a, b) => String(b.lastActive || b.lastSignIn || "").localeCompare(String(a.lastActive || a.lastSignIn || ""))).slice(0, 500),
  };
}

export default async (req) => {
  const url = new URL(req.url);

  // 1) Start Google sign-in: send the browser to Supabase, which returns it to the site afterwards.
  if (req.method === "GET" && url.pathname.endsWith("/login")) {
    if (!configured()) return new Response("Sign-in isn't set up yet on this site (Supabase settings missing).", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    const back = `${url.origin}/`;
    return new Response(null, { status: 302, headers: { Location: `${base()}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(back)}`, "Cache-Control": "no-store" } });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!originAllowed(req)) return json({ error: "forbidden_origin" }, 403);
  let body; try { body = await req.json() } catch { return json({ error: "bad_json" }, 400) }
  if (body.action === "status") return json({ accounts: !!configured() });   // lets the app hide "Sign in" until set up
  if (!configured()) return json({ error: "accounts_not_configured" }, 503);

  try {
    // 2) Refresh an expired session (no user check needed: Supabase validates the refresh token).
    if (body.action === "refresh") {
      const r = await fetch(`${base()}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { apikey: env("SUPABASE_ANON_KEY"), "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: String(body.refresh_token || "").slice(0, 500) }) });
      if (!r.ok) return json({ error: "session_expired" }, 401);
      const d = await r.json();
      return json({ access_token: d.access_token, refresh_token: d.refresh_token, expires_in: d.expires_in });
    }

    const user = await verify(req);
    if (!user) return json({ error: "session_expired" }, 401);

    switch (body.action) {
      case "session": {                          // called after sign-in and when the app opens
        await track(user.id, body.login === true);
        return json({ user: { email: user.email, name: user.name }, admin: isAdmin(user) });
      }
      case "load": {
        const rows = await rest(`progress?user_id=eq.${user.id}&select=state,updated_at`);
        return json(rows && rows[0] ? rows[0] : { state: null, updated_at: null });
      }
      case "save": {
        const state = cleanState(body.state); if (!state) return json({ error: "bad_state" }, 400);
        const now = new Date().toISOString(), row = { state, updated_at: now };
        if (body.base) {                         // only overwrite the version this device last saw
          const upd = await rest(`progress?user_id=eq.${user.id}&updated_at=eq.${encodeURIComponent(body.base)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(row) });
          if (upd && upd.length) return json({ updated_at: upd[0].updated_at });
          const cur = await rest(`progress?user_id=eq.${user.id}&select=state,updated_at`);
          if (cur && cur[0] && !body.force) return json({ error: "conflict", state: cur[0].state, updated_at: cur[0].updated_at }, 409);
        }
        const ins = await rest(`progress?on_conflict=user_id`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ user_id: user.id, ...row }) });
        return json({ updated_at: ins && ins[0] ? ins[0].updated_at : now });
      }
      case "delete": {                           // the learner deletes their account and all data
        await rest(`progress?user_id=eq.${user.id}`, { method: "DELETE" });
        await rest(`activity?user_id=eq.${user.id}`, { method: "DELETE" });
        const r = await fetch(`${base()}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers: svc() });
        if (!r.ok) console.error("Delete auth user failed", r.status);
        return json({ ok: true });
      }
      case "admin": {
        if (!isAdmin(user)) return json({ error: "not_admin" }, 403);
        return json(await dashboard());
      }
    }
    return json({ error: "bad_action" }, 400);
  } catch (e) {
    console.error("Account function error", e && e.message);
    return json({ error: "server_error" }, 500);
  }
};

export const config = {
  path: ["/api/account", "/api/account/login"],
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
