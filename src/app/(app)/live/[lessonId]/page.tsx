import { notFound } from "next/navigation";
import { requireUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getLesson, listSegments } from "@/lib/server/repo";
import { listenerLanguage } from "@/lib/server/access";
import { speechConfigured } from "@/lib/server/live";
import { getLanguage } from "@/lib/languages";
import { LiveCaptions, type Caption } from "./LiveCaptions";
import { mayParticipate } from "@/lib/server/theory";
import { fmtDay, fmtTime } from "@/lib/time";

export const metadata = { title: "Live-Unterricht" };
export const dynamic = "force-dynamic";

export default async function LivePage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const user = await requireUser();
  const lesson = getLesson(db(), lessonId);
  if (!lesson || (lesson.status === "planned" && !lesson.scheduled_at)) notFound();
  const canAsk = user.role === "student" && mayParticipate(db(), lesson, user.id);

  const code = listenerLanguage(user);
  const lang = code ? getLanguage(code)! : null;
  // Bisherige Sätze (für Nachzügler und zum Nachlesen). Sätze, die vor dem
  // Beitritt nur in anderen Sprachen übersetzt wurden, erscheinen auf Deutsch.
  const initial: Caption[] = listSegments(db(), lessonId).slice(-400).map((s) => ({
    seq: s.seq,
    original: s.original,
    text: code ? s.translations[code] ?? null : s.original,
    ...(code && !s.translations[code] ? { error: "Vor deinem Beitritt nicht übersetzt" } : {}),
  }));

  return (
    <LiveCaptions
      lessonId={lesson.id}
      title={lesson.title}
      initialLive={lesson.status === "live"}
      initial={initial}
      language={lang && { code: lang.code, labelDe: lang.labelDe, nativeLabel: lang.nativeLabel, rtl: lang.rtl, ttsVoice: lang.ttsVoice }}
      canSpeak={speechConfigured()}
      canAsk={canAsk}
      notAllowedText={user.role === "teacher" ? "Du bist als Fahrschule angemeldet." : "Fragen können nur angemeldete Teilnehmer stellen. Melde dich unter „Theorie“ an."}
      startsAt={lesson.scheduled_at ? `${fmtDay(lesson.scheduled_at)} um ${fmtTime(lesson.scheduled_at)} Uhr` : null}
    />
  );
}
