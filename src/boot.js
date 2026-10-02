import "./style.css";
import { configured, supabase, signIn, signOut, rememberGoogleTokens, createBackend } from "./backend.js";

const $ = (id) => document.getElementById(id);

// Installable app: service worker (offline shell) + no pinch zoom.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
["gesturestart", "gesturechange"].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
let lastTouch = 0;
document.addEventListener("touchend", (e) => { const now = Date.now(); if (now - lastTouch < 300 && !e.target.closest("input,textarea,select")) e.preventDefault(); lastTouch = now; }, { passive: false });

function showLogin(msg) {
  $("login").hidden = false;
  $("loginErr").textContent = msg || "";
  $("googleLogin").onclick = async () => {
    $("googleLogin").disabled = true;
    const { error } = await signIn();
    if (error) { $("googleLogin").disabled = false; $("loginErr").textContent = "ログインを始められませんでした：" + error.message; }
  };
}

async function start() {
  if (!configured) { showLogin("Supabase の接続設定（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）がまだです。README の手順で設定してください。"); return; }
  supabase.auth.onAuthStateChange((_ev, session) => rememberGoogleTokens(session));
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) { showLogin(); return; }
  rememberGoogleTokens(session);

  const allowed = (import.meta.env.VITE_ALLOWED_EMAIL || "").toLowerCase();
  if (allowed && (session.user.email || "").toLowerCase() !== allowed) {
    await signOut();
    showLogin("このアカウントでは使えません。登録したGoogleアカウントでログインしてください。");
    return;
  }

  const backend = createBackend(session);
  window.__backend = backend;
  await import("./app.js");

  // Base: account + import
  $("accountEmail").textContent = (session.user.email || "") + " でログイン中";
  $("logout").onclick = async () => { await signOut(); location.reload(); };
  $("relogin").onclick = () => signIn();
  $("importGo").onclick = async () => {
    const f = $("importFile").files && $("importFile").files[0];
    if (!f) { $("importMsg").textContent = "Claude版から書き出したJSONファイルを選んでください。"; return; }
    $("importGo").disabled = true; $("importMsg").textContent = "取り込んでいます…";
    try {
      const obj = JSON.parse(await f.text());
      const n = await backend.db.importData(obj);
      $("importMsg").textContent = `${n}件を取り込みました。`;
    } catch (e) {
      console.error(e);
      $("importMsg").textContent = "取り込めませんでした。ファイルの中身を確認して、もう一度お試しください。";
    } finally { $("importGo").disabled = false; }
  };
}
start();
