/**
 * Legt ein Lehrkraft-Konto an oder setzt dessen Passwort neu.
 *   npm run create-teacher -- maryam@fahrschule-beyourself.de "Maryam Azizi"
 * Das Passwort wird interaktiv abgefragt (oder über TEACHER_PASSWORD).
 */
import { openDatabase } from "../src/lib/server/db";
import { hashPassword } from "../src/lib/server/password";
import { createUser, findUserByEmail, setUserPassword, setUserRole } from "../src/lib/server/repo";

let piped: Promise<string[]> | null = null;
let pipedIndex = 0;
async function nextPipedLine(): Promise<string> {
  piped ??= new Promise((resolve) => {
    let all = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (d) => (all += d));
    process.stdin.on("end", () => resolve(all.split(/\r?\n/)));
  });
  return (await piped)[pipedIndex++] ?? "";
}

/** Liest eine Eingabe, ohne sie anzuzeigen. */
function askHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stdout.write(prompt);
    if (!stdin.isTTY) {
      // ohne Terminal (z. B. Pipe): nächste Zeile aus dem gemeinsamen Puffer
      process.stdout.write("\n");
      nextPipedLine().then(resolve, reject);
      return;
    }
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false); stdin.pause(); stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(value);
        }
        if (ch === "\u0003") { stdin.setRawMode(false); process.stdout.write("\n"); return reject(new Error("Abgebrochen")); }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const [email, ...nameParts] = process.argv.slice(2);
  if (!email) {
    console.error('Aufruf: npm run create-teacher -- <email> "<Name>"');
    process.exit(1);
  }
  let password = process.env.TEACHER_PASSWORD;
  if (!password) {
    password = await askHidden("Passwort (mind. 10 Zeichen, bleibt unsichtbar): ");
    const again = await askHidden("Passwort wiederholen: ");
    if (password !== again) throw new Error("Die Passwörter sind nicht gleich.");
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
