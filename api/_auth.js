// Shared check for API routes: the caller must send a valid Supabase access token,
// and (when ALLOWED_EMAIL is set) belong to that one Google account.
export async function requireUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const r = await fetch(url + "/auth/v1/user", { headers: { apikey: anon, Authorization: "Bearer " + token } });
  if (!r.ok) return null;
  const user = await r.json();
  const allowed = (process.env.ALLOWED_EMAIL || "").toLowerCase();
  if (allowed && (user.email || "").toLowerCase() !== allowed) return null;
  return user;
}

export function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}
