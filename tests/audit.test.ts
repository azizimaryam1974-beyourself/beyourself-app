import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/lib/server/db";
import { listAudit, purgeAudit, sanitize, verifyAudit, writeAudit } from "../src/lib/server/audit";

test("Protokoll: Geheimes wird geschwärzt, Texte nur als Länge", () => {
  const f = new FormData();
  f.set("email", "a@b.de"); f.set("password", "geheim123"); f.set("body", "Hallo, das ist privat"); f.set("$ACTION_ID_x", "");
  const s = sanitize(f) as Record<string, unknown>;
  assert.equal(s.email, "a@b.de");
  assert.equal(s.password, "[geheim]");
  assert.match(String(s.body), /Text, 21 Zeichen/);
  assert.equal("$ACTION_ID_x" in s, false);
  assert.deepEqual(sanitize({ stripe_key: "sk_live_x", nested: { token: "t" } }), { stripe_key: "[geheim]", nested: { token: "[geheim]" } });
});

test("Protokoll: Hash-Kette erkennt nachträgliche Änderungen", () => {
  const db = openDatabase(":memory:");
  for (let i = 0; i < 5; i++) writeAudit(db, { kind: "action", action: `Test ${i}`, details: { i } });
  assert.deepEqual(verifyAudit(db), { checked: 5, brokenAt: null });
  db.prepare(`UPDATE audit_log SET action = 'gefälscht' WHERE id = 3`).run();
  assert.equal(verifyAudit(db).brokenAt, 3);
  assert.equal(listAudit(db, { q: "gefälscht" }).total, 1);
});

test("Protokoll: alte Einträge werden gelöscht, Kette bleibt prüfbar", () => {
  const db = openDatabase(":memory:");
  const now = Date.now();
  writeAudit(db, { kind: "system", action: "alt", at: now - 400 * 86_400_000 });
  writeAudit(db, { kind: "system", action: "neu1", at: now });
  writeAudit(db, { kind: "system", action: "neu2", at: now });
  assert.equal(purgeAudit(db, 365, now), 1);
  assert.equal(verifyAudit(db).brokenAt, null);
});
