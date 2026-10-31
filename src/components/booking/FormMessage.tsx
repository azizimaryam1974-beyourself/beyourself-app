export function FormMessage({ state }: { state: { ok?: string; error?: string; warn?: string } }) {
  if (state.warn) return (<>{state.ok && <div className="alert alert-ok" role="status">{state.ok}</div>}<div className="alert alert-info" role="status">{state.warn}</div></>);
  if (state.error) return <div className="alert alert-error" role="alert">{state.error}</div>;
  if (state.ok) return <div className="alert alert-ok" role="status">{state.ok}</div>;
  return null;
}
