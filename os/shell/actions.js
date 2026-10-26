/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
// Apeluri către acțiunile dominosd, separate de DOM și cu fetch injectabil ca să poată fi testate.

const DOWN = "Serviciul de sistem nu răspunde.";
const BAD = "Răspuns neașteptat de la serviciul de sistem.";
const FAILED = "Acțiunea a eșuat.";

// Antetul personalizat este protecția CSRF: un formular cross-site nu îl poate trimite,
// iar un fetch cross-origin ar cere preflight, pe care serverul nu îl acceptă.
export async function postAction(path, body, fetchImpl = fetch) {
  let res;
  try {
    res = await fetchImpl(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-DominosLand-Action": "1" },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return { ok: false, message: DOWN };
  }
  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, message: BAD };
  }
  if (!data || typeof data !== "object") return { ok: false, message: BAD };
  if (!res.ok || data.ok === false) {
    return { ok: false, message: String(data.error ?? data.message ?? FAILED) };
  }
  return { ok: true, message: String(data.message ?? "Gata.") };
}

export async function getGamemode(fetchImpl = fetch) {
  try {
    const res = await fetchImpl("/api/gamemode", { cache: "no-store" });
    if (!res.ok) return null;
    const { active } = await res.json();
    return typeof active === "boolean" ? active : null;
  } catch {
    return null;
  }
}

export function cleanJarvisText(s) {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length === 0 || t.length > 500 ? null : t;
}

// Numără cererile ca să recunoaștem un răspuns depășit de unul mai nou.
export function makeLatest() {
  let gen = 0;
  return { next: () => ++gen, isCurrent: (g) => g === gen };
}
