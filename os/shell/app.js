/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
import { postAction, getGamemode, cleanJarvisText } from "./actions.js";
import { formatUptime, formatMemory, memoryUsage, formatLoad, formatClock } from "./format.js";

const $ = (id) => document.getElementById(id);
// Doar textContent: datele vin din serviciu, dar nu avem de ce să le tratăm ca HTML (XSS).
const set = (id, text) => { $(id).textContent = text; };
const dash = (v) => (v == null || v === "" ? "—" : String(v));

function tickClock() {
  const now = new Date();
  set("clock", formatClock(now));
  set("date", now.toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
}

function render(s) {
  set("s-os", dash(s.os));
  set("s-host", dash(s.hostname));
  set("s-kernel", dash(s.kernel));
  set("s-uptime", formatUptime(s.uptime_seconds));
  set("s-load", formatLoad(s.load));
  set("s-cpus", dash(s.cpus));
  const usage = memoryUsage(s.memory);
  if (usage) {
    set("s-mem", `${formatMemory(usage.usedKb)} din ${formatMemory(s.memory.total_kb)} (${usage.percent}%)`);
    $("s-mem-fill").style.width = `${usage.percent}%`;
    $("s-mem-bar").setAttribute("aria-valuenow", String(usage.percent));
  } else {
    set("s-mem", "—");
    $("s-mem-fill").style.width = "0%";
  }
}

// O singură cerere deodată per buton: busy blochează dublul click și Enter repetat.
async function withBusy(btn, fn) {
  if (btn.disabled) return;
  btn.disabled = true;
  btn.setAttribute("aria-busy", "true");
  try { return await fn(); } finally {
    btn.removeAttribute("aria-busy");
    btn.disabled = false;
  }
}

let toastTimer;
function toast(r) {
  const el = $("toast");
  el.textContent = r.message;
  el.dataset.state = r.ok ? "ok" : "error";
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 6000);
}

let gameMode = null;
let gmPending = false;
function renderGamemode() {
  set("gm-state", gameMode === null ? "Necunoscut" : gameMode ? "Pornit" : "Oprit");
  const t = $("t-gamemode");
  t.dataset.on = String(gameMode === true);
  t.disabled = gameMode === null || gmPending;
}
async function refreshGamemode() {
  if (gmPending) return;
  gameMode = await getGamemode();
  renderGamemode();
}

async function toggleGamemode() {
  if (gmPending || gameMode === null) return;
  gmPending = true;
  const t = $("t-gamemode");
  t.setAttribute("aria-busy", "true");
  renderGamemode();
  toast(await postAction("/api/actions/gamemode", { on: !gameMode }));
  gmPending = false;
  t.removeAttribute("aria-busy");
  await refreshGamemode();
}

function initJarvis() {
  const dlg = $("jarvis"), input = $("j-input"), send = $("j-send"), tile = $("t-jarvis");
  const close = () => { if (dlg.open) dlg.close(); };
  tile.addEventListener("click", () => { dlg.showModal(); input.focus(); });
  $("j-close").addEventListener("click", close);
  // Escape închide nativ dialogul; la închidere focusul revine pe dală.
  dlg.addEventListener("close", () => tile.focus());
  $("j-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = cleanJarvisText(input.value);
    if (!text) { set("j-answer", "Scrie o întrebare (maximum 500 de caractere)."); return; }
    withBusy(send, async () => {
      set("j-answer", "Jarvis se gândește…");
      const r = await postAction("/api/actions/jarvis", { text });
      set("j-answer", r.message);
    });
  });
}

async function poll() {
  const status = $("status");
  try {
    const res = await fetch("/api/status", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    render(await res.json());
    status.textContent = "Conectat la serviciul de sistem";
    status.dataset.state = "ok";
  } catch {
    // Nu aruncăm: ecranul rămâne utilizabil și reîncercăm la următorul ciclu.
    status.textContent = "Serviciul de sistem nu răspunde";
    status.dataset.state = "error";
  }
}

$("t-launcher").addEventListener("click", (e) => withBusy(e.currentTarget, async () => toast(await postAction("/api/actions/launcher", {}))));
$("t-gamemode").addEventListener("click", toggleGamemode);
initJarvis();

tickClock();
setInterval(tickClock, 1000);
const refresh = () => { poll(); refreshGamemode(); };
refresh();
setInterval(refresh, 5000);
