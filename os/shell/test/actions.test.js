/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  makeLatest, postAction, getGamemode, cleanJarvisText } from "../actions.js";

const fake = (status, body, calls = []) => async (url, init) => {
  calls.push({ url, init });
  return { ok: status >= 200 && status < 300, status, json: async () => { if (body === undefined) throw new SyntaxError("x"); return body; } };
};

test("postAction trimite metoda, antetele și corpul corecte", async () => {
  const calls = [];
  const r = await postAction("/api/actions/gamemode", { on: true }, fake(200, { ok: true, message: "Pornit" }, calls));
  assert.deepEqual(r, { ok: true, message: "Pornit" });
  assert.equal(calls[0].url, "/api/actions/gamemode");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  assert.equal(calls[0].init.headers["X-DominosLand-Action"], "1");
  assert.equal(calls[0].init.body, '{"on":true}');
});

test("postAction launcher și jarvis", async () => {
  const calls = [];
  await postAction("/api/actions/launcher", {}, fake(200, { ok: true, message: "ok" }, calls));
  await postAction("/api/actions/jarvis", { text: "salut" }, fake(200, { ok: true, message: "ok" }, calls));
  assert.equal(calls[0].init.body, "{}");
  assert.equal(calls[1].init.body, '{"text":"salut"}');
});

test("postAction: eroare de server cu câmpul error", async () => {
  const r = await postAction("/x", {}, fake(403, { ok: false, error: "Interzis" }));
  assert.deepEqual(r, { ok: false, message: "Interzis" });
});

test("postAction: ok:false cu message pe 200", async () => {
  const r = await postAction("/x", {}, fake(200, { ok: false, message: "Jarvis indisponibil" }));
  assert.deepEqual(r, { ok: false, message: "Jarvis indisponibil" });
});

test("postAction: eroare de rețea", async () => {
  const r = await postAction("/x", {}, async () => { throw new TypeError("fail"); });
  assert.deepEqual(r, { ok: false, message: "Serviciul de sistem nu răspunde." });
});

test("postAction: răspuns non-JSON", async () => {
  const r = await postAction("/x", {}, fake(502, undefined));
  assert.equal(r.ok, false);
  assert.match(r.message, /neașteptat/);
});

test("getGamemode", async () => {
  assert.equal(await getGamemode(fake(200, { active: true })), true);
  assert.equal(await getGamemode(fake(200, { active: false })), false);
  assert.equal(await getGamemode(fake(200, { active: null })), null);
  assert.equal(await getGamemode(fake(500, { active: true })), null);
  assert.equal(await getGamemode(fake(200, undefined)), null);
  assert.equal(await getGamemode(async () => { throw new Error("x"); }), null);
});

test("cleanJarvisText", () => {
  assert.equal(cleanJarvisText("   "), null);
  assert.equal(cleanJarvisText(""), null);
  assert.equal(cleanJarvisText(null), null);
  assert.equal(cleanJarvisText("  salut "), "salut");
  assert.equal(cleanJarvisText("a".repeat(500)).length, 500);
  assert.equal(cleanJarvisText("a".repeat(501)), null);
});

test("makeLatest: un răspuns vechi nu mai este curent după o cerere nouă", () => {
  const latest = makeLatest();
  const pollVechi = latest.next();
  const comutare = latest.next();
  assert.equal(latest.isCurrent(pollVechi), false);
  assert.equal(latest.isCurrent(comutare), true);
  const pollNou = latest.next();
  assert.equal(latest.isCurrent(comutare), false);
  assert.equal(latest.isCurrent(pollNou), true);
});
