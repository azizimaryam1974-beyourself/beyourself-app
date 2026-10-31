import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireTeacher } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getLesson } from "@/lib/server/repo";
import { BeamerView } from "@/components/qa/BeamerView";

export const metadata = { title: "Beamer" };
export const dynamic = "force-dynamic";

export default async function BeamerPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  await requireTeacher();
  const lesson = getLesson(db(), lessonId);
  if (!lesson) notFound();
  const joinUrl = `${(process.env.APP_URL || "").replace(/\/$/, "")}/live/${lesson.id}`;
  const qrSvg = await QRCode.toString(joinUrl, { type: "svg", margin: 1, color: { dark: "#0f1a2c", light: "#f6f0e6" } });
  return <BeamerView lessonId={lesson.id} title={lesson.title} qrSvg={qrSvg} joinUrl={joinUrl.replace(/^https?:\/\//, "")} />;
}
