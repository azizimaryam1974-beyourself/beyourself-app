import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Login" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const u = await currentUser();
  if (u) redirect(u.role === "teacher" ? "/unterricht" : "/konto");
  return (
    <div className="narrow" style={{ margin: "0 auto" }}>
      <h1>Login</h1>
      <LoginForm />
      <p className="hint">Noch kein Konto? <Link href="/anmelden">Jetzt anmelden</Link></p>
    </div>
  );
}
