import { db } from "@/lib/server/db";
import { hashToken } from "@/lib/server/password";
import { userForPasswordReset } from "@/lib/server/repo";
import { ResetForm } from "./ResetForm";

export const metadata = { title: "Neues Passwort" };
export const dynamic = "force-dynamic";

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = userForPasswordReset(db(), hashToken(token));
  return (
    <div className="narrow" style={{ margin: "0 auto" }}>
      <h1>Neues Passwort</h1>
      {user ? (
        <>
          <p className="hint">Für {user.email}</p>
          <ResetForm token={token} />
        </>
      ) : (
        <div className="alert alert-error">Der Link ist abgelaufen oder wurde schon benutzt. Bitte bei der Fahrschule einen neuen anfordern.</div>
      )}
    </div>
  );
}
