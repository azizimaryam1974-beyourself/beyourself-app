import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Einloggen" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const u = await currentUser();
  if (u) redirect(u.role === "teacher" ? "/unterricht" : "/konto");
  return (
    <div className="narrow" style={{ margin: "0 auto" }}>
      <h1>Einloggen</h1>
      <LoginForm />
      <p className="hint">Neu bei uns? <Link href="/anmelden">Fahrschüler werden</Link></p>
      <p className="hint">Passwort vergessen? Melde dich bei der Fahrschule – du bekommst einen Link für ein neues Passwort.</p>
    </div>
  );
}
