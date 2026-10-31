import { db } from "./db";
import { purgeExpiredSessions } from "./repo";

export function purgeAuthSessionsSafe(): void {
  purgeExpiredSessions(db());
  db().prepare(`DELETE FROM password_resets WHERE expires_at < ?`).run(Date.now() - 7 * 24 * 60 * 60 * 1000);
}
