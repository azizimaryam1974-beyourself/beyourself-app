import { test } from "node:test";
import assert from "node:assert/strict";
import { closedReason, darkStart, easter, frameFor, hessenHolidays, startTimes, subtract, sunsetMs, workIntervals } from "../src/lib/calendar";
import { berlinToMs, fmtTime } from "../src/lib/time";

test("Arbeitsrahmen: Okt–Apr bis 21 Uhr, Mai–Sep bis 23 Uhr", () => {
  assert.deepEqual(frameFor("2026-11-03"), { from: 540, to: 1260 });
  assert.deepEqual(frameFor("2027-04-30"), { from: 540, to: 1260 });
  assert.deepEqual(frameFor("2027-05-03"), { from: 540, to: 1380 });
  assert.deepEqual(frameFor("2027-09-30"), { from: 540, to: 1380 });
});

test("Feiertage Hessen inkl. Ostern/Fronleichnam, Sonntage zu", () => {
  assert.equal(easter(2027), "2027-03-28");
  assert.equal(easter(2026), "2026-04-05");
  const h = hessenHolidays(2027);
  assert.equal(h.get("2027-03-26"), "Karfreitag");
  assert.equal(h.get("2027-03-29"), "Ostermontag");
  assert.equal(h.get("2027-05-06"), "Christi Himmelfahrt");
  assert.equal(h.get("2027-05-17"), "Pfingstmontag");
  assert.equal(h.get("2027-05-27"), "Fronleichnam");
  assert.equal(h.size, 10);
  assert.equal(closedReason("2026-11-01"), "Sonntag");
  assert.equal(closedReason("2026-12-25"), "1. Weihnachtstag");
  assert.equal(closedReason("2026-11-02"), null);
  assert.deepEqual(workIntervals("2026-12-25", [{ from: 540, to: 1260 }]), []);
});

test("Sonnenuntergang Kassel plausibel (±10 Min)", () => {
  const near = (ms: number, hhmm: string, day: string) => Math.abs(ms - berlinToMs(day, hhmm)) <= 10 * 60_000;
  assert.ok(near(sunsetMs("2026-12-21"), "16:16", "2026-12-21"), fmtTime(sunsetMs("2026-12-21")));
  assert.ok(near(sunsetMs("2027-06-21"), "21:42", "2027-06-21"), fmtTime(sunsetMs("2027-06-21")));
  assert.ok(near(sunsetMs("2027-03-20"), "18:33", "2027-03-20"), fmtTime(sunsetMs("2027-03-20")));
  // Beleuchtung im Dezember ab ca. 16:30, nie mittags
  assert.ok(darkStart("2026-12-21") > berlinToMs("2026-12-21", "16:15"));
  assert.ok(darkStart("2026-12-21") < berlinToMs("2026-12-21", "17:00"));
});

test("Freie Zeiten: Rahmen schneidet Vorlage ab, belegte Zeit wird abgezogen", () => {
  const day = "2026-11-03";
  const free = workIntervals(day, [{ from: 8 * 60, to: 12 * 60 }, { from: 13 * 60, to: 22 * 60 }]);
  assert.equal(fmtTime(free[0].start), "09:00");
  assert.equal(fmtTime(free[1].end), "21:00");
  const busy = [{ start: berlinToMs(day, "10:00"), end: berlinToMs(day, "11:30") }];
  const rest = subtract(free, busy);
  assert.deepEqual(rest.slice(0, 2).map((i) => `${fmtTime(i.start)}-${fmtTime(i.end)}`), ["09:00-10:00", "11:30-12:00"]);
});

test("Startzeiten: keine unbrauchbaren Lücken", () => {
  const day = "2026-11-03";
  const free = [{ start: berlinToMs(day, "09:00"), end: berlinToMs(day, "12:00") }]; // 180 Min
  const t90 = startTimes(free, 90).map(fmtTime);
  // 9:00 (Rest 90 danach) und 10:30 (90 davor) – 10:00 würde 30 unbrauchbare Minuten übrig lassen
  assert.deepEqual(t90, ["09:00", "10:30"]);
  const t60 = startTimes(free, 60).map(fmtTime);
  assert.deepEqual(t60, ["09:00", "10:00", "11:00"]);
  assert.deepEqual(startTimes(free, 60, { notBefore: berlinToMs(day, "09:30") }).map(fmtTime), ["10:00", "11:00"]);
});
