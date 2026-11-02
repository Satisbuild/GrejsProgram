// Kør med: node --test tests/logic.test.js
const test = require("node:test");
const assert = require("node:assert");
require("../js/exercises.js");
require("../js/logic.js");
const TL = globalThis.TL;

const workout = (id, start, exercises) => ({ id, start, end: start + 3600000, exercises });
const set = (kg, reps, type = "n") => ({ type, kg, reps });
const wr = () => "wr";

test("num forstår dansk decimalkomma og afviser tomt", () => {
  assert.equal(TL.num("62,5"), 62.5);
  assert.equal(TL.num("62.5"), 62.5);
  assert.equal(TL.num(""), null);
  assert.equal(TL.num("abc"), null);
});

test("parseDuration og fmtClock er hinandens modsætninger", () => {
  assert.equal(TL.parseDuration("90"), 90);
  assert.equal(TL.parseDuration("1:30"), 90);
  assert.equal(TL.parseDuration("1:02:00"), 3720);
  assert.equal(TL.fmtClock(90), "1:30");
  assert.equal(TL.fmtClock(3720), "1:02:00");
});

test("første gang en øvelse logges er ikke en PR", () => {
  const { prs } = TL.computeRecords([workout("a", 1, [{ exId: "x", sets: [set(100, 5)] }])], wr);
  assert.deepEqual(prs, {});
});

test("PR gives kun for det der faktisk er slået", () => {
  const { prs, records } = TL.computeRecords([
    workout("a", 1, [{ exId: "x", sets: [set(100, 5)] }]),
    workout("b", 2, [{ exId: "x", sets: [set(100, 5), set(102.5, 1)] }]),
  ], wr);
  assert.equal(prs.b.length, 1);
  assert.equal(prs.b[0].setIndex, 1);
  assert.deepEqual(prs.b[0].kinds, ["kg"]);
  assert.equal(records.x.kg, 102.5);
});

test("opvarmning tæller hverken i volumen eller rekorder", () => {
  const w = workout("a", 1, [{ exId: "x", sets: [set(200, 5, "w"), set(50, 10)] }]);
  assert.equal(TL.workoutStats(w).volume, 500);
  assert.equal(TL.workoutStats(w).sets, 1);
  assert.equal(TL.computeRecords([w], wr).records.x.kg, 50);
});

test("rækkefølgen i listen er ligegyldig for PR-beregningen", () => {
  const { prs } = TL.computeRecords([
    workout("nyest", 2, [{ exId: "x", sets: [set(110, 5)] }]),
    workout("aeldst", 1, [{ exId: "x", sets: [set(100, 5)] }]),
  ], wr);
  assert.ok(prs.nyest);
  assert.ok(!prs.aeldst);
});

test("forrige sæt matcher opvarmning med opvarmning", () => {
  const ex = { sets: [set(40, 10, "w"), set(100, 5), set(100, 4)] };
  const prev = TL.previousSets(ex, [{ type: "n" }, { type: "w" }, { type: "n" }, { type: "n" }]);
  assert.equal(prev[0].kg, 100);
  assert.equal(prev[1].kg, 40);
  assert.equal(prev[2].reps, 4);
  assert.equal(prev[3], null);
});

test("sætnumre springer opvarmning og dropsæt over", () => {
  assert.deepEqual(TL.setLabels([{ type: "w" }, { type: "n" }, { type: "n" }, { type: "d" }, { type: "f" }]), ["V", "1", "2", "D", "F"]);
});

test("ugerække: tom indeværende uge bryder ikke rækken, et hul gør", () => {
  const now = new Date(2026, 10, 4, 12).getTime(); // Onsdag
  const weeksAgo = (n) => TL.addDays(TL.startOfWeek(now), -7 * n) + 3600000;
  const w = (n) => workout(`w${n}`, weeksAgo(n), []);
  assert.equal(TL.weekStreak([w(1), w(2)], now), 2);
  assert.equal(TL.weekStreak([w(0), w(1), w(3)], now), 2);
  assert.equal(TL.weekStreak([w(2)], now), 0);
});

test("ugenummer følger ISO 8601", () => {
  assert.equal(TL.weekNumber(new Date(2026, 10, 2).getTime()), 45);
  assert.equal(TL.weekNumber(new Date(2021, 0, 3).getTime()), 53);
  assert.equal(TL.weekNumber(new Date(2021, 0, 4).getTime()), 1);
});

test("skiveberegner regner pr. side og melder hvad der mangler", () => {
  assert.deepEqual(TL.platesPerSide(100, 20, [25, 20, 15, 10, 5, 2.5, 1.25]).plates, [25, 15]);
  assert.equal(TL.platesPerSide(21, 20, [25, 20, 1.25]).rest, 0.5);
  assert.equal(TL.platesPerSide(10, 20, [25]).invalid, true);
});

test("opvarmning holder sig over stangen og under arbejdsvægten", () => {
  const sets = TL.warmupSets(100, 20);
  assert.deepEqual(sets.map((s) => s.kg), [40, 60, 80]);
  assert.deepEqual(TL.warmupSets(25, 20).map((s) => s.kg), [20]);
});

test("CSV escaper semikolon og bruger decimalkomma", () => {
  const w = { ...workout("a", new Date(2026, 0, 5).getTime(), [{ exId: "x", sets: [set(62.5, 8)] }]), title: "Ben; tung" };
  const csv = TL.workoutsToCsv([w], () => "Squat");
  const line = csv.split("\r\n")[1];
  assert.equal(line, '2026-01-05;"Ben; tung";Squat;1;n;62,5;8;;');
});

test("biblioteket har unikke id'er og gyldige metadata", () => {
  const ids = new Set(TL.LIBRARY.map((e) => e.id));
  assert.equal(ids.size, TL.LIBRARY.length);
  for (const e of TL.LIBRARY) {
    assert.ok(TL.MUSCLES[e.muscle], e.name);
    assert.ok(TL.EQUIPMENT[e.equipment], e.name);
    assert.ok(TL.TYPES[e.type], e.name);
  }
  for (const r of TL.DEFAULT_ROUTINES) for (const [name] of r.exercises) assert.ok(ids.has(TL.slug(name)), name);
});
