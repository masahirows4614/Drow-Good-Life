// POST /api/ai  { prompt, tier: "quick"|"default", json }
// Calls the Anthropic Messages API with the server-side ANTHROPIC_API_KEY.
import { requireUser, readBody } from "./_auth.js";

const MODELS = {
  default: process.env.AI_MODEL || "claude-sonnet-5-5",
  quick: process.env.AI_MODEL_QUICK || "claude-haiku-4-5-20251001",
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const user = await requireUser(req);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set" });

  const { prompt, tier, json } = readBody(req);
  const messages = Array.isArray(prompt)
    ? prompt.filter((m) => m && (m.role === "user" || m.role === "assistant")).map((m) => ({ role: m.role, content: String(m.content || "") }))
    : [{ role: "user", content: String(prompt || "") }];
  if (!messages.length || messages[messages.length - 1].role !== "user") return res.status(400).json({ error: "prompt" });
  const total = messages.reduce((n, m) => n + m.content.length, 0);
  if (total > 40000) return res.status(413).json({ error: "too long" });

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: tier === "quick" ? MODELS.quick : MODELS.default,
      max_tokens: json ? 600 : 1400,
      system: json ? "Reply with a single JSON object only. No prose, no code fences." : undefined,
      messages,
    }),
  });
  if (r.status === 429) return res.status(429).json({ error: "rate_limited" });
  if (!r.ok) { const t = await r.text(); console.error("anthropic", r.status, t); return res.status(502).json({ error: "upstream" }); }
  const data = await r.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return res.status(200).json({ text });
}
