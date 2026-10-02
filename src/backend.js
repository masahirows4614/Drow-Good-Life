// AuroLIFE backend adapters.
// Gives the ported app the same shapes it used inside Claude:
//   use("db")     -> collection/doc API with onSnapshot, backed by Supabase (table public.docs)
//   use("mcp")    -> callTool / watchTool for Google Calendar (list_events, create_event)
//   use("sample") -> AI calls through /api/ai (Anthropic API on the server)
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const supabase = configured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

const CAL_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const LS = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

// ---------- auth ----------
export async function signIn() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
      scopes: CAL_SCOPE,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
}
export async function signOut() {
  LS.del("aurolife.gtok"); LS.del("aurolife.gref");
  await supabase.auth.signOut();
}
export function rememberGoogleTokens(session) {
  if (!session) return;
  if (session.provider_token) LS.set("aurolife.gtok", { access: session.provider_token, exp: Date.now() + 55 * 60 * 1000 });
  if (session.provider_refresh_token) LS.set("aurolife.gref", session.provider_refresh_token);
}
async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

// ---------- db ----------
function createDb(userId) {
  const cache = new Map(); // collection -> Map(id -> data)
  const colListeners = new Map(); // collection -> Set(cb)
  const docListeners = new Map(); // "col/id" -> Set(cb)
  let ready;

  const bucket = (c) => { if (!cache.has(c)) cache.set(c, new Map()); return cache.get(c); };
  const colSnap = (c) => ({ docs: [...bucket(c).entries()].map(([id, data]) => ({ id, data: () => data })) });
  const docSnap = (c, id) => ({ id, exists: bucket(c).has(id), data: () => bucket(c).get(id) });
  const notify = (c, id) => {
    (colListeners.get(c) || []).forEach((cb) => { try { cb(colSnap(c)); } catch (e) { console.error(e); } });
    (docListeners.get(c + "/" + id) || []).forEach((cb) => { try { cb(docSnap(c, id)); } catch (e) { console.error(e); } });
  };
  const apply = (c, id, data) => { if (data === null) bucket(c).delete(id); else bucket(c).set(id, data); notify(c, id); };

  ready = (async () => {
    const { data, error } = await supabase.from("docs").select("collection,id,data").range(0, 9999);
    if (error) throw error;
    for (const r of data) bucket(r.collection).set(r.id, r.data);
  })();

  supabase
    .channel("docs-" + userId)
    .on("postgres_changes", { event: "*", schema: "public", table: "docs", filter: `user_id=eq.${userId}` }, (p) => {
      if (p.eventType === "DELETE") { const o = p.old || {}; if (o.collection && o.id) apply(o.collection, o.id, null); }
      else { const n = p.new; apply(n.collection, n.id, n.data); }
    })
    .subscribe();

  async function write(c, id, data) {
    const prev = bucket(c).get(id);
    apply(c, id, data);
    const { error } = await supabase.from("docs").upsert({ user_id: userId, collection: c, id, data, updated_at: new Date().toISOString() });
    if (error) { apply(c, id, prev === undefined ? null : prev); throw error; }
  }
  async function remove(c, id) {
    const prev = bucket(c).get(id);
    apply(c, id, null);
    const { error } = await supabase.from("docs").delete().eq("collection", c).eq("id", id);
    if (error) { if (prev !== undefined) apply(c, id, prev); throw error; }
  }
  const clean = (o) => JSON.parse(JSON.stringify(o ?? {}));

  function docRef(c, id) {
    return {
      id,
      set: (d) => write(c, id, clean(d)),
      update: (d) => write(c, id, { ...(bucket(c).get(id) || {}), ...clean(d) }),
      delete: () => remove(c, id),
      get: async () => { await ready; return docSnap(c, id); },
      onSnapshot(cb, onErr) {
        const k = c + "/" + id;
        if (!docListeners.has(k)) docListeners.set(k, new Set());
        docListeners.get(k).add(cb);
        ready.then(() => cb(docSnap(c, id)), (e) => onErr && onErr(e));
        return () => docListeners.get(k).delete(cb);
      },
    };
  }
  const api = {
    collection(c) {
      return {
        doc: (id) => docRef(c, id || crypto.randomUUID()),
        add: async (d) => { const id = crypto.randomUUID(); await write(c, id, clean(d)); return docRef(c, id); },
        onSnapshot(cb, onErr) {
          if (!colListeners.has(c)) colListeners.set(c, new Set());
          colListeners.get(c).add(cb);
          ready.then(() => cb(colSnap(c)), (e) => onErr && onErr(e));
          return () => colListeners.get(c).delete(cb);
        },
      };
    },
    doc(path) { const [c, id] = path.split("/"); return docRef(c, id); },
  };

  // bulk import (Claude version export): { collection: [{id, ...data}] | {id: data} }
  api.importData = async (obj) => {
    const rows = [];
    for (const [c, v] of Object.entries(obj || {})) {
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(c)) continue;
      const list = Array.isArray(v) ? v : Object.entries(v).map(([id, d]) => ({ id, ...d }));
      for (const item of list) {
        if (!item || typeof item !== "object" || !item.id) continue;
        const { id, ...data } = item;
        rows.push({ user_id: userId, collection: c, id: String(id), data: clean(data), updated_at: new Date().toISOString() });
      }
    }
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from("docs").upsert(rows.slice(i, i + 200));
      if (error) throw error;
    }
    rows.forEach((r) => apply(r.collection, r.id, r.data));
    return rows.length;
  };
  return api;
}

// ---------- Google Calendar (mcp-shaped) ----------
async function googleToken(force) {
  const t = LS.get("aurolife.gtok");
  if (!force && t && t.access && t.exp > Date.now()) return t.access;
  const ref = LS.get("aurolife.gref");
  if (!ref) throw { code: "needs_reauth", message: "Google login required" };
  const r = await fetch("/api/google-refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await accessToken()) },
    body: JSON.stringify({ refresh_token: ref }),
  });
  if (!r.ok) { LS.del("aurolife.gtok"); throw { code: "needs_reauth", message: "refresh failed" }; }
  const j = await r.json();
  LS.set("aurolife.gtok", { access: j.access_token, exp: Date.now() + (j.expires_in - 120) * 1000 });
  return j.access_token;
}
async function gfetch(url, init = {}, retry = true) {
  const tok = await googleToken(false);
  const r = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: "Bearer " + tok, "Content-Type": "application/json" } });
  if (r.status === 401 && retry) { LS.del("aurolife.gtok"); await googleToken(true); return gfetch(url, init, false); }
  if (r.status === 401 || r.status === 403) throw { code: "needs_reauth", message: "calendar permission" };
  if (!r.ok) throw { code: "tool_error", message: "calendar " + r.status };
  return r.json();
}
const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const tools = {
  async list_events(input) {
    const q = new URLSearchParams({ timeMin: input.startTime, timeMax: input.endTime, singleEvents: "true", orderBy: "startTime", timeZone: input.timeZone || "Asia/Tokyo", maxResults: String(input.pageSize || 50) });
    const j = await gfetch(CAL + "?" + q.toString());
    return { events: j.items || [] };
  },
  async create_event(input) {
    const tz = input.timeZone || "Asia/Tokyo";
    return gfetch(CAL, { method: "POST", body: JSON.stringify({ summary: input.summary, description: input.description || "", start: { dateTime: input.startTime, timeZone: tz }, end: { dateTime: input.endTime, timeZone: tz } }) });
  },
};
function createCalendar() {
  const watchers = new Set();
  const run = async (w) => {
    try { const payload = await tools[w.tool](w.input); w.handler({ type: "data", result: { payload, content: [] } }); }
    catch (e) { w.handler({ type: "error", error: e && e.code ? e : { code: "tool_error", message: String(e) } }); }
  };
  return {
    async callTool(_server, tool, input) {
      if (!tools[tool]) throw { code: "not_in_manifest", message: tool };
      try { const payload = await tools[tool](input); return { payload, content: [] }; }
      catch (e) { throw e && e.code ? e : { code: "tool_error", message: String(e) }; }
    },
    watchTool(_server, tool, input, handler, opts = {}) {
      const w = { tool, input, handler };
      watchers.add(w);
      run(w);
      const iv = setInterval(() => { if (!document.hidden) run(w); }, Math.max(60000, opts.refetchInterval || 300000));
      const vis = () => { if (!document.hidden) run(w); };
      document.addEventListener("visibilitychange", vis);
      return () => { clearInterval(iv); watchers.delete(w); document.removeEventListener("visibilitychange", vis); };
    },
    invalidate() { watchers.forEach(run); },
  };
}

// ---------- AI (sample-shaped) ----------
function createSample() {
  async function call(input, opts = {}, json = false) {
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await accessToken()) },
      body: JSON.stringify({ prompt: typeof input === "string" ? input : input, tier: opts.modelTier || "default", json }),
      signal: opts.signal,
    }).catch((e) => { throw { code: e && e.name === "AbortError" ? "cancelled" : "network", message: String(e) }; });
    if (r.status === 401 || r.status === 403) throw { code: "not_granted", message: "not allowed" };
    if (r.status === 429) throw { code: "rate_limited", message: "rate limited" };
    if (!r.ok) throw { code: "error", message: "ai " + r.status };
    const j = await r.json();
    return j.text || "";
  }
  const sample = async (input, opts = {}) => {
    const text = await call(input, opts, false);
    if (opts.onText) opts.onText({ text, delta: text });
    return { text, truncated: false };
  };
  sample.json = async (input, opts = {}) => {
    const text = await call(input, opts, true);
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw { code: "bad_json", message: "no json" };
    return JSON.parse(m[0]);
  };
  return sample;
}

// ---------- the backend object the app reads ----------
export function createBackend(session) {
  const db = createDb(session.user.id);
  const mcp = createCalendar();
  const sample = createSample();
  const map = { db, mcp, sample };
  return { db, use: async (name) => map[name] || null };
}
