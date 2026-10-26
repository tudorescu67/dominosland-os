/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
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

tickClock();
setInterval(tickClock, 1000);
poll();
setInterval(poll, 5000);
