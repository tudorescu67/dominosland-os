/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
import test from "node:test";
import assert from "node:assert/strict";
import { formatUptime, formatMemory, memoryUsage, formatLoad, formatClock } from "../format.js";

test("formatUptime", () => {
  assert.equal(formatUptime(null), "—");
  assert.equal(formatUptime(0), "acum");
  assert.equal(formatUptime(59), "acum");
  assert.equal(formatUptime(60), "1 min");
  assert.equal(formatUptime(300), "5 min");
  assert.equal(formatUptime(3600), "1 h 0 min");
  assert.equal(formatUptime(7500), "2 h 5 min");
  assert.equal(formatUptime(86400), "1 zi 0 h");
  assert.equal(formatUptime(90061), "1 zi 1 h");
  assert.equal(formatUptime(3 * 86400 + 4 * 3600), "3 zile 4 h");
});

test("formatMemory", () => {
  assert.equal(formatMemory(null), "—");
  assert.equal(formatMemory(0), "0 MB");
  assert.equal(formatMemory(512 * 1024), "512 MB");
  assert.equal(formatMemory(1023 * 1024), "1023 MB");
  assert.equal(formatMemory(1024 * 1024), "1,0 GB");
  assert.equal(formatMemory(3355443), "3,2 GB");
});

test("memoryUsage", () => {
  assert.equal(memoryUsage(null), null);
  assert.equal(memoryUsage({ total_kb: 0, available_kb: 0 }), null);
  assert.deepEqual(memoryUsage({ total_kb: 1000, available_kb: 250 }), { usedKb: 750, percent: 75 });
  assert.deepEqual(memoryUsage({ total_kb: 1000, available_kb: 2000 }), { usedKb: 0, percent: 0 });
  assert.deepEqual(memoryUsage({ total_kb: 1000, available_kb: 0 }), { usedKb: 1000, percent: 100 });
});

test("formatLoad", () => {
  assert.equal(formatLoad(null), "—");
  assert.equal(formatLoad([0.52, 0.4, 0.33]), "0,52 · 0,40 · 0,33");
  assert.equal(formatLoad([0, 0, 0]), "0,00 · 0,00 · 0,00");
});

test("formatClock", () => {
  assert.equal(formatClock(new Date(2026, 0, 1, 9, 5)), "09:05");
  assert.equal(formatClock(new Date(2026, 0, 1, 0, 0)), "00:00");
  assert.equal(formatClock(new Date(2026, 0, 1, 23, 59)), "23:59");
});
