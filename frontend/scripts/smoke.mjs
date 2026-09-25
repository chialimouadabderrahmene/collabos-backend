#!/usr/bin/env node
/**
 * Minimal production smoke test (no framework): login -> home data -> create
 * Opportunity -> save draft -> publish -> share link -> open share logged out
 * -> revoke -> logout, all through the same-origin proxy.
 *
 *   SMOKE_BASE_URL=https://app.neao.online \
 *   SMOKE_EMAIL=<disposable test account> SMOKE_PASSWORD=<its password> \
 *   node scripts/smoke.mjs
 *
 * Creates one disposable Opportunity in the account's first brand; never
 * deletes anything. Credentials come from the environment only.
 */
const BASE = (process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const { SMOKE_EMAIL: email, SMOKE_PASSWORD: password } = process.env;
if (!email || !password) {
  console.error("Set SMOKE_EMAIL and SMOKE_PASSWORD (disposable test account).");
  process.exit(2);
}

const jar = new Map();
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` ${detail}`}`);
};

async function call(method, path, body, useJar = true) {
  const res = await fetch(BASE + path, {
    method,
    redirect: "manual",
    headers: {
      ...(useJar ? { cookie: cookieHeader() } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair, ...attrs] = line.split(";");
    const i = pair.indexOf("=");
    const name = pair.slice(0, i).trim();
    const value = pair.slice(i + 1);
    if (!value || /max-age=0/i.test(attrs.join(";"))) jar.delete(name);
    else jar.set(name, value);
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, json };
}
const api = (m, p, b, j) => call(m, `/api/backend/${p}`, b, j);

let r = await call("POST", "/api/auth/login", { email, password });
check("login", r.status === 200 && !JSON.stringify(r.json).includes("eyJ"), String(r.status));
if (r.status !== 200) process.exit(1);

r = await api("GET", "brands/mine");
const brand = Array.isArray(r.json) ? r.json[0] : null;
check("home: brands/mine", r.status === 200 && !!brand, String(r.status));
if (!brand) process.exit(1);

r = await api("POST", "opportunities", { brandId: brand.id, title: "Smoke test", summary: "disposable" });
const id = r.json?.id;
check("create opportunity", r.status === 201 && !!id, String(r.status));
if (!id) process.exit(1);

r = await api("GET", `opportunities/${id}/draft`);
const doc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Smoke" }] }],
};
r = await api("PUT", `opportunities/${id}/draft`, {
  format: "tiptap",
  schemaVersion: 1,
  content: doc,
  baseRevision: r.json?.revision ?? 0,
});
check("studio: save draft", r.status === 200, String(r.status));

r = await api("POST", `opportunities/${id}/publish`, { notes: "smoke" });
const version = r.json?.versionNumber;
check("publish", r.status === 201 && version >= 1, String(r.status));

r = await api("POST", `opportunities/${id}/share-links`, { versionNumber: version, label: "smoke" });
const { token, id: linkId } = r.json ?? {};
check("share: create link", r.status === 201 && !!token, String(r.status));

r = await call("GET", `/api/backend/share/${token}`, undefined, false);
check("share: open logged out", r.status === 200 && r.json?.versionNumber === version, String(r.status));

r = await api("DELETE", `opportunities/${id}/share-links/${linkId}`);
check("share: revoke", r.status < 300, String(r.status));
r = await call("GET", `/api/backend/share/${token}`, undefined, false);
check("share: 404 after revoke", r.status === 404, String(r.status));

r = await call("POST", "/api/auth/logout");
check("logout", r.status === 204 && !jar.has("cos_at") && !jar.has("cos_rt"), String(r.status));
r = await api("GET", "auth/me");
check("session ended", r.status === 401, String(r.status));

process.exit(failed ? 1 : 0);
