import { notFound } from "next/navigation";
import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getLesson, listSegments } from "@/lib/server/repo";
import { speechConfigured, translator } from "@/lib/server/live";
import { recognitionPhrases } from "@/lib/glossary";
import { SOURCE_LANGUAGE, TARGET_LANGUAGES } from "@/lib/languages";
import { TeacherConsole } from "./TeacherConsole";
import { TeacherQa } from "@/components/qa/TeacherQa";

export const metadata = { title: "Unterrichtskonsole" };
export const dynamic = "force-dynamic";

export default async function ConsolePage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  await requireTeacher();
  const lesson = getLesson(db(), lessonId);
  if (!lesson) notFound();
  const sent = listSegments(db(), lessonId).slice(-50).map((s) => ({ seq: s.seq, text: s.original }));
  const labels = Object.fromEntries(TARGET_LANGUAGES.map((l) => [l.code, l.labelDe]));

  return (
    <>
    <TeacherConsole
      lesson={{ id: lesson.id, title: lesson.title, status: lesson.status }}
      initialSent={sent}
      phrases={recognitionPhrases()}
      speechLocale={SOURCE_LANGUAGE.speechLocale}
      speechReady={speechConfigured()}
      provider={translator().name}
      languageLabels={labels}
    />
    <TeacherQa lessonId={lesson.id} />
    </>
  );
}
