export interface QaQuestion {
  id: string; name: string; german: string; original: string; lang: string;
  status: "visible" | "blocked" | "hidden" | "answered"; onBeamer: boolean; createdAt: number; mine: boolean; reason?: string; userId?: string;
}
export interface QaState { questions: QaQuestion[]; hands: Array<{ name: string; raisedAt: number; userId?: string }>; myHand: boolean; muted: boolean; muted_ids?: string[] }
export const EMPTY_QA: QaState = { questions: [], hands: [], myHand: false, muted: false };

export async function qaPost(lessonId: string, body: Record<string, unknown>): Promise<{ ok?: boolean; error?: string; shown?: boolean }> {
  try {
    const r = await fetch(`/api/live/${lessonId}/qa`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await r.json();
  } catch {
    return { error: "Keine Verbindung. Bitte noch einmal versuchen." };
  }
}
