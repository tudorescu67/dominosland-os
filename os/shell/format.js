/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
// Funcții pure de formatare, separate de DOM ca să poată fi testate cu `node --test`.

const DASH = "—";

// Separatorul zecimal românesc este virgula; toFixed produce punct.
const comma = (n, digits) => n.toFixed(digits).replace(".", ",");

export function formatUptime(seconds) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return DASH;
  const s = Math.floor(seconds);
  if (s < 60) return "acum";
  const mins = Math.floor(s / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ${mins % 60} min`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "zi" : "zile"} ${hours % 24} h`;
}

export function formatMemory(kb) {
  if (kb == null || !Number.isFinite(kb) || kb < 0) return DASH;
  if (kb < 1024 * 1024) return `${Math.round(kb / 1024)} MB`;
  return `${comma(kb / (1024 * 1024), 1)} GB`;
}

export function memoryUsage(memory) {
  if (!memory || !memory.total_kb) return null;
  const usedKb = Math.min(Math.max(memory.total_kb - memory.available_kb, 0), memory.total_kb);
  return { usedKb, percent: Math.round((usedKb / memory.total_kb) * 100) };
}

export function formatLoad(load) {
  if (!Array.isArray(load) || load.length === 0 || load.some((n) => !Number.isFinite(n))) return DASH;
  return load.map((n) => comma(n, 2)).join(" · ");
}

export function formatClock(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
