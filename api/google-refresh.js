// POST /api/google-refresh  { refresh_token }
// Trades the Google refresh token (kept on the user's device) for a fresh access token.
import { requireUser, readBody } from "./_auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  const { refresh_token } = readBody(req);
  if (!refresh_token) return res.status(400).json({ error: "refresh_token" });
  const id = process.env.GOOGLE_CLIENT_ID || "330140649807-amlm66c7s69uhr2klmdvu3o09dqtc54t.apps.googleusercontent.com"; // public client id
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) return res.status(500).json({ error: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set" });

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token, grant_type: "refresh_token" }),
  });
  if (!r.ok) return res.status(401).json({ error: "refresh_failed" });
  const j = await r.json();
  return res.status(200).json({ access_token: j.access_token, expires_in: j.expires_in || 3600 });
}
