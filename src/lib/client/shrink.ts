/**
 * Fotos im Browser verkleinern, bevor sie hochgeladen werden (Handy-Fotos sind oft 4–8 MB).
 * Längste Seite höchstens `max` Pixel, als JPEG. PDFs und Bilder, die der Browser nicht lesen kann, bleiben unverändert.
 */
export async function shrinkImage(file: File, max = 2200, quality = 0.85): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    if (k === 1 && file.size < 1_500_000 && file.type === "image/jpeg") return file;
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // z. B. HEIC in einem Browser, der es nicht kennt → Original hochladen
  } finally {
    URL.revokeObjectURL(url);
  }
}
