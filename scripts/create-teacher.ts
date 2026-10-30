/**
 * Legt ein Lehrkraft-Konto an oder setzt dessen Passwort neu.
 *   npm run create-teacher -- maryam@fahrschule-beyourself.de "Maryam Azizi"
 * Das Passwort wird interaktiv abgefragt (oder über TEACHER_PASSWORD).
 */
import { createInterface } from "node:readline/promises";
import { openDatabase } from "../src/lib/server/db";
import { hashPassword } from "../src/lib/server/password";
import { createUser, findUserByEmail, setUserPassword, setUserRole } from "../src/lib/server/repo";

async function main() {
  const [email, ...nameParts] = process.argv.slice(2);
  if (!email) {
    console.error('Aufruf: npm run create-teacher -- <email> "<Name>"');
    process.exit(1);
  }
  let password = process.env.TEACHER_PASSWORD;
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("Passwort (mind. 10 Zeichen): ");
    rl.close();
  }
  if (!password || password.length < 10) throw new Error("Passwort zu kurz");

  const db = openDatabase(process.env.DATABASE_PATH || "./data/beyourself.db");
  const hash = await hashPassword(password);
  const existing = findUserByEmail(db, email);
  if (existing) {
    setUserPassword(db, existing.id, hash);
    setUserRole(db, existing.id, "teacher");
    console.log(`Lehrkraft aktualisiert: ${existing.email}`);
  } else {
    const u = createUser(db, { email, name: nameParts.join(" ") || "Lehrkraft", passwordHash: hash, role: "teacher" });
    console.log(`Lehrkraft angelegt: ${u.email}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
