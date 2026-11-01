import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/lib/server/db";
import { createUser } from "../src/lib/server/repo";
import { addressLine, detailsMissing, getDetails, saveDetails, setPhone, setPhoto, upcomingBirthdays } from "../src/lib/server/user-details";

test("Angaben: fehlen erst, dann vollständig; Geburtstage der nächsten Tage", () => {
  const db = openDatabase(":memory:");
  const u = createUser(db, { email: "a@b.de", name: "Lona Scholz", passwordHash: "x", role: "student" });
  assert.equal(detailsMissing(db, { id: u.id, phone: null }), true);
  saveDetails(db, u.id, { birthday: "2005-11-03", street: "Königsplatz 1", zip: "34117", city: "Kassel" });
  setPhone(db, u.id, "0561 123456");
  assert.equal(detailsMissing(db, { id: u.id, phone: "0561 123456" }), false);
  assert.equal(addressLine(getDetails(db, u.id)), "Königsplatz 1, 34117 Kassel");
  const b = upcomingBirthdays(db, "2026-11-01", 7);
  assert.equal(b.length, 1);
  assert.equal(b[0].inDays, 2);
  assert.equal(b[0].age, 21);
  assert.equal(upcomingBirthdays(db, "2026-11-04", 7).length, 0);
  assert.equal(upcomingBirthdays(db, "2026-11-03", 0)[0].age, 21);
  assert.equal(setPhoto(db, u.id, "avatars/x.jpg"), null);
  assert.equal(setPhoto(db, u.id, null), "avatars/x.jpg");
  assert.equal(getDetails(db, u.id).birthday, "2005-11-03"); // Foto ändern lässt Angaben stehen
});
