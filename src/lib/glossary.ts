import type { TargetLanguageCode } from "./languages";

/**
 * Fachbegriffe aus dem Theorieunterricht.
 *
 * 1. `de` wird an die Spracherkennung übergeben (Azure Phrase List), damit
 *    diese Wörter zuverlässig erkannt werden.
 * 2. Ist für eine Zielsprache eine feste Übersetzung hinterlegt, wird sie
 *    über das "dynamische Wörterbuch" von Azure Translator erzwungen.
 *
 * 3. Beim Übersetzer "claude" gehen die Begriffe als verbindliche Vorgaben
 *    in die Anweisung an das Sprachmodell (passt die Grammatik selbst an).
 *
 * Leere Felder = der Übersetzer entscheidet selbst.
 */
export interface GlossaryTerm {
  de: string;
  translations: Partial<Record<TargetLanguageCode, string>>;
}

/**
 * Stand 31.10.2026: Übersetzungen von Claude (KI) erstellt.
 * Geprüft: "rechts vor links" auf Farsi (Maryam). Alles andere bei
 * Gelegenheit von Muttersprachlern gegenlesen lassen.
 * Hintergrund: Ohne Glossar übersetzt Azure "rechts vor links" in allen
 * Sprachen sinnentstellt (RU "прямо перед левым поворотом" u. a.).
 */
export const DEFAULT_GLOSSARY: GlossaryTerm[] = [
  { de: "rechts vor links", translations: { en: "priority to the right", tr: "sağdan gelenin önceliği", ru: "помеха справа", ar: "الأولوية للقادم من اليمين", es: "prioridad a la derecha", fr: "priorité à droite", fa: "حق تقدم با سمت راست" } },
  { de: "Vorfahrt gewähren", translations: { en: "give way", tr: "yol ver", ru: "уступить дорогу", ar: "إعطاء الأولوية", es: "ceder el paso", fr: "céder le passage", fa: "حق تقدم دادن" } },
  { de: "Vorfahrtstraße", translations: { en: "priority road", tr: "ana yol", ru: "главная дорога", ar: "طريق ذو أولوية", es: "vía con prioridad", fr: "route prioritaire", fa: "خیابان اصلی دارای حق تقدم" } },
  { de: "Fahrstreifen", translations: { en: "lane", tr: "şerit", ru: "полоса движения", ar: "حارة السير", es: "carril", fr: "voie de circulation", fa: "خط عبور" } },
  { de: "Fußgängerüberweg", translations: { en: "pedestrian crossing", tr: "yaya geçidi", ru: "пешеходный переход", ar: "معبر المشاة", es: "paso de peatones", fr: "passage pour piétons", fa: "گذرگاه عابر پیاده" } },
  { de: "Zebrastreifen", translations: { en: "zebra crossing", tr: "yaya geçidi", ru: "«зебра»", ar: "ممر المشاة المخطط", es: "paso de cebra", fr: "passage piéton", fa: "خط عابر پیاده" } },
  { de: "Lichtzeichenanlage", translations: { en: "traffic lights", tr: "trafik ışıkları", ru: "светофор", ar: "إشارة المرور الضوئية", es: "semáforo", fr: "feux de signalisation", fa: "چراغ راهنمایی" } },
  { de: "Haltelinie", translations: { en: "stop line", tr: "durma çizgisi", ru: "стоп-линия", ar: "خط التوقف", es: "línea de detención", fr: "ligne d'arrêt", fa: "خط ایست" } },
  { de: "Sicherheitsabstand", translations: { en: "safe following distance", tr: "güvenli takip mesafesi", ru: "безопасная дистанция", ar: "مسافة الأمان", es: "distancia de seguridad", fr: "distance de sécurité", fa: "فاصله ایمنی" } },
  { de: "Anhalteweg", translations: { en: "stopping distance", tr: "durma mesafesi", ru: "остановочный путь", ar: "مسافة التوقف", es: "distancia de detención", fr: "distance d'arrêt", fa: "مسافت توقف" } },
  { de: "Bremsweg", translations: { en: "braking distance", tr: "fren mesafesi", ru: "тормозной путь", ar: "مسافة الكبح", es: "distancia de frenado", fr: "distance de freinage", fa: "مسافت ترمز" } },
  { de: "Reaktionsweg", translations: { en: "reaction distance", tr: "reaksiyon mesafesi", ru: "путь за время реакции", ar: "مسافة رد الفعل", es: "distancia de reacción", fr: "distance de réaction", fa: "مسافت واکنش" } },
  { de: "Schulterblick", translations: { en: "shoulder check", tr: "omuz kontrolü", ru: "взгляд через плечо", ar: "النظر من فوق الكتف", es: "mirada por encima del hombro", fr: "contrôle de l'angle mort", fa: "نگاه از روی شانه" } },
  { de: "Probezeit", translations: { en: "probationary period", tr: "deneme süresi", ru: "испытательный срок", ar: "فترة الاختبار", es: "período de prueba", fr: "période probatoire", fa: "دوره آزمایشی" } },
  { de: "Punkte in Flensburg", translations: { en: "penalty points (Flensburg register)", tr: "Flensburg ceza puanları", ru: "штрафные баллы во Фленсбурге", ar: "نقاط المخالفات في سجل فلنسبورغ", es: "puntos en Flensburgo", fr: "points au registre de Flensburg", fa: "امتیاز منفی در فلنزبورگ" } },
  { de: "Verkehrszeichen", translations: { en: "traffic sign", tr: "trafik işareti", ru: "дорожный знак", ar: "إشارة مرور", es: "señal de tráfico", fr: "panneau de signalisation", fa: "تابلوی راهنمایی و رانندگی" } },
  { de: "Zusatzzeichen", translations: { en: "additional sign", tr: "ek levha", ru: "дополнительная табличка", ar: "لوحة إضافية", es: "panel complementario", fr: "panonceau", fa: "تابلوی تکمیلی" } },
  { de: "Gefahrzeichen", translations: { en: "warning sign", tr: "tehlike uyarı işareti", ru: "предупреждающий знак", ar: "إشارة تحذير", es: "señal de peligro", fr: "panneau de danger", fa: "تابلوی هشدار" } },
  { de: "Vorschriftzeichen", translations: { en: "regulatory sign", tr: "düzenleyici işaret", ru: "предписывающий знак", ar: "إشارة تنظيمية", es: "señal de reglamentación", fr: "panneau de prescription", fa: "تابلوی انتظامی" } },
  { de: "Richtzeichen", translations: { en: "informational sign", tr: "bilgi işareti", ru: "информационный знак", ar: "إشارة إرشادية", es: "señal de indicación", fr: "panneau d'indication", fa: "تابلوی اخباری" } },
  { de: "Kreisverkehr", translations: { en: "roundabout", tr: "döner kavşak", ru: "круговое движение", ar: "دوار", es: "rotonda", fr: "rond-point", fa: "میدان" } },
  { de: "Autobahn", translations: { en: "motorway", tr: "otoyol", ru: "автобан", ar: "الطريق السريع (أوتوبان)", es: "autopista", fr: "autoroute", fa: "بزرگراه" } },
  { de: "Kraftfahrstraße", translations: { en: "motorway-style road", tr: "motorlu taşıt yolu", ru: "дорога для автомобилей", ar: "طريق مخصص للسيارات", es: "vía para automóviles", fr: "voie express", fa: "جاده مخصوص خودرو" } },
  { de: "Rettungsgasse", translations: { en: "emergency corridor", tr: "kurtarma koridoru", ru: "коридор для спецтранспорта", ar: "ممر الطوارئ", es: "pasillo de emergencia", fr: "couloir de secours", fa: "مسیر امدادی" } },
  { de: "Reißverschlussverfahren", translations: { en: "zipper merge", tr: "fermuar sistemi", ru: "принцип застёжки-молнии", ar: "الاندماج بالتناوب", es: "incorporación en cremallera", fr: "insertion en fermeture éclair", fa: "ادغام زیپی" } },
  { de: "Überholverbot", translations: { en: "no overtaking", tr: "sollama yasağı", ru: "обгон запрещён", ar: "ممنوع التجاوز", es: "prohibido adelantar", fr: "interdiction de dépasser", fa: "سبقت ممنوع" } },
  { de: "Halteverbot", translations: { en: "no stopping", tr: "duraklama yasağı", ru: "остановка запрещена", ar: "ممنوع الوقوف", es: "prohibido detenerse", fr: "arrêt interdit", fa: "توقف ممنوع" } },
  { de: "Parkverbot", translations: { en: "no parking", tr: "park yasağı", ru: "стоянка запрещена", ar: "ممنوع الانتظار", es: "prohibido aparcar", fr: "stationnement interdit", fa: "پارک ممنوع" } },
  { de: "Promillegrenze", translations: { en: "blood alcohol limit", tr: "promil sınırı", ru: "допустимый уровень алкоголя в крови", ar: "الحد المسموح لنسبة الكحول في الدم", es: "límite de alcoholemia", fr: "taux d'alcoolémie maximal", fa: "حد مجاز الکل خون" } },
  { de: "Fahrerlaubnis", translations: { en: "driving licence", tr: "sürücü belgesi", ru: "право на управление транспортным средством", ar: "رخصة القيادة", es: "permiso de conducir", fr: "permis de conduire", fa: "گواهینامه رانندگی" } },
  { de: "Führerschein", translations: { en: "driving licence", tr: "ehliyet", ru: "водительское удостоверение", ar: "رخصة القيادة", es: "carné de conducir", fr: "permis de conduire", fa: "گواهینامه" } },
  { de: "Umschreibung", translations: { en: "conversion of a foreign licence", tr: "yabancı ehliyetin dönüştürülmesi", ru: "замена иностранного удостоверения", ar: "تحويل رخصة القيادة الأجنبية", es: "canje del permiso extranjero", fr: "échange du permis étranger", fa: "تبدیل گواهینامه خارجی" } },
  { de: "Theorieprüfung", translations: { en: "theory test", tr: "teori sınavı", ru: "теоретический экзамен", ar: "الامتحان النظري", es: "examen teórico", fr: "examen théorique du code", fa: "آزمون تئوری" } },
  { de: "Fehlerpunkte", translations: { en: "error points", tr: "hata puanları", ru: "штрафные баллы на экзамене", ar: "نقاط الخطأ", es: "puntos de error", fr: "points de faute", fa: "امتیاز خطا" } },
  { de: "Bahnübergang", translations: { en: "level crossing", tr: "hemzemin geçit", ru: "железнодорожный переезд", ar: "معبر السكة الحديدية", es: "paso a nivel", fr: "passage à niveau", fa: "تقاطع راه‌آهن" } },
  { de: "Andreaskreuz", translations: { en: "St Andrew's cross (railway crossing sign)", tr: "Andreas haçı (hemzemin geçit işareti)", ru: "Андреевский крест", ar: "صليب أندراوس (إشارة معبر السكة)", es: "cruz de San Andrés", fr: "croix de Saint-André", fa: "علامت صلیب تقاطع راه‌آهن" } },
  { de: "verkehrsberuhigter Bereich", translations: { en: "traffic-calmed area", tr: "trafiği sakinleştirilmiş alan", ru: "жилая зона", ar: "منطقة تهدئة المرور", es: "zona de tráfico calmado", fr: "zone de rencontre", fa: "محدوده آرام‌سازی ترافیک" } },
  { de: "Tempo-30-Zone", translations: { en: "30 km/h zone", tr: "30 km/s bölgesi", ru: "зона 30 км/ч", ar: "منطقة سرعة 30 كم/س", es: "zona 30", fr: "zone 30", fa: "محدوده سرعت ۳۰" } },
  { de: "Abblendlicht", translations: { en: "dipped headlights", tr: "kısa far", ru: "ближний свет", ar: "الضوء المنخفض", es: "luz de cruce", fr: "feux de croisement", fa: "نور پایین" } },
  { de: "Fernlicht", translations: { en: "full beam", tr: "uzun far", ru: "дальний свет", ar: "الضوء العالي", es: "luz de carretera", fr: "feux de route", fa: "نور بالا" } },
  { de: "Warnblinklicht", translations: { en: "hazard lights", tr: "dörtlü flaşör", ru: "аварийная сигнализация", ar: "أضواء التحذير", es: "luces de emergencia", fr: "feux de détresse", fa: "چراغ فلاشر" } },
  { de: "Warndreieck", translations: { en: "warning triangle", tr: "uyarı üçgeni", ru: "знак аварийной остановки", ar: "مثلث التحذير", es: "triángulo de emergencia", fr: "triangle de signalisation", fa: "مثلث خطر" } },
];

/** Deutsche Begriffe für die Phrase List der Spracherkennung. */
export function recognitionPhrases(glossary: GlossaryTerm[] = DEFAULT_GLOSSARY): string[] {
  return [...new Set(glossary.map((t) => t.de))];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Der Text wird als Plain Text übersetzt; Azure wertet dort nur das
 * mstrans-Markup aus. Spitze Klammern und Anführungszeichen entfernen wir
 * aus Begriffen/Übersetzungen, damit das Markup nicht zerbricht.
 */
function safeAttr(s: string): string {
  return s.replace(/["<>]/g, "");
}

function escapeText(s: string): string {
  return s;
}

/**
 * Markiert gefundene Fachbegriffe für eine Zielsprache mit dem dynamischen
 * Wörterbuch von Azure Translator:
 *   <mstrans:dictionary translation="give way">Vorfahrt gewähren</mstrans:dictionary>
 *
 * Längere Begriffe zuerst, damit "Vorfahrt gewähren" vor "Vorfahrt" greift.
 * Gibt `changed=false` zurück, wenn kein Begriff vorkommt; dann kann der
 * Text gemeinsam für mehrere Sprachen übersetzt werden.
 */
export function applyGlossary(
  text: string,
  target: TargetLanguageCode,
  glossary: GlossaryTerm[] = DEFAULT_GLOSSARY,
): { text: string; changed: boolean } {
  const terms = glossary
    .filter((t) => t.translations[target])
    .sort((a, b) => b.de.length - a.de.length);
  if (terms.length === 0) return { text, changed: false };

  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(${terms.map((t) => escapeRegExp(t.de)).join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );
  let changed = false;
  let out = "";
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const term = terms.find((t) => t.de.toLowerCase() === m[0].toLowerCase());
    if (!term) continue;
    changed = true;
    out += escapeText(text.slice(last, m.index));
    out += `<mstrans:dictionary translation="${safeAttr(term.translations[target]!)}">${escapeText(m[0])}</mstrans:dictionary>`;
    last = m.index! + m[0].length;
  }
  if (!changed) return { text, changed: false };
  out += escapeText(text.slice(last));
  return { text: out, changed: true };
}
