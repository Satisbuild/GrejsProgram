/* Ren logik uden DOM: tal, formatering, volumen, PR'er og statistik.
   Kører også i Node, så det kan testes (tests/logic.test.js). */
var TL = (globalThis.TL = globalThis.TL || {});

(() => {
  const DAY = 86400000;
  const LB = 2.20462;

  /* ---------- Tal og input ---------- */
  // Accepterer både 62,5 og 62.5. Tomt/ugyldigt giver null.
  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = parseFloat(String(v).trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  // "90" = 90 sek, "1:30" = 90 sek, "1:02:00" = 3720 sek
  function parseDuration(v) {
    if (v === null || v === undefined || v === "") return null;
    const s = String(v).trim();
    if (!s.includes(":")) { const n = num(s); return n === null ? null : Math.round(n); }
    const parts = s.split(":").map((p) => parseInt(p, 10));
    if (parts.some((p) => !Number.isFinite(p))) return null;
    return parts.reduce((acc, p) => acc * 60 + p, 0);
  }

  function fmtClock(secs) {
    if (secs === null || secs === undefined) return "";
    const s = Math.max(0, Math.round(secs));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
  }

  function fmtNum(n, decimals = 1) {
    if (n === null || n === undefined || !Number.isFinite(n)) return "–";
    return n.toLocaleString("da-DK", { maximumFractionDigits: decimals });
  }

  /* ---------- Enheder: alt gemmes i kg ---------- */
  const toDisplay = (kg, unit) => (kg === null || kg === undefined ? null : unit === "lb" ? kg * LB : kg);
  const fromDisplay = (val, unit) => (val === null || val === undefined ? null : unit === "lb" ? val / LB : val);
  const fmtWeight = (kg, unit) => fmtNum(toDisplay(kg, unit));

  function fmtVolume(kg, unit) {
    const v = toDisplay(kg, unit) || 0;
    if (v >= 100000) return `${fmtNum(v / 1000, 0)} t`;
    if (v >= 10000) return `${fmtNum(v / 1000, 1)} t`;
    return `${fmtNum(v, 0)} ${unit}`;
  }

  function fmtDuration(ms) {
    if (ms === null || ms === undefined) return "–";
    const min = Math.round(ms / 60000);
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)} t ${min % 60} min`;
  }

  /* ---------- Sæt ---------- */
  const isWorking = (set) => set.type !== "w";

  const e1rm = (kg, reps) => {
    if (!kg || !reps) return 0;
    return reps === 1 ? kg : kg * (1 + Math.min(reps, 30) / 30); // Epley
  };
  const setVolume = (set) => (set.kg && set.reps ? set.kg * set.reps : 0);

  function workoutStats(w) {
    let volume = 0, sets = 0;
    for (const ex of w.exercises) {
      for (const set of ex.sets) {
        if (!isWorking(set)) continue;
        sets++;
        volume += setVolume(set);
      }
    }
    return { volume, sets, duration: w.end ? w.end - w.start : null };
  }

  /* ---------- Rekorder ---------- */
  function emptyRecords() {
    return { kg: 0, e1rm: 0, volume: 0, reps: 0, secs: 0, km: 0 };
  }

  // Finder hvilke rekorder et sæt slår. Mutér ikke: kald absorb() bagefter.
  const PR_LABELS = { kg: "Tungeste vægt", e1rm: "Bedste 1RM", volume: "Bedste sætvolumen", reps: "Flest reps", secs: "Længste tid", km: "Længste distance" };

  function setMetrics(set, type) {
    const m = {};
    if (type === "wr" || type === "bwx") {
      if (set.kg) {
        m.kg = set.kg;
        if (set.reps) { m.e1rm = e1rm(set.kg, set.reps); m.volume = setVolume(set); }
      } else if (set.reps) m.reps = set.reps;
    } else if (type === "bw") { if (set.reps) m.reps = set.reps; }
    else if (type === "time") { if (set.secs) m.secs = set.secs; }
    else if (type === "cardio") { if (set.km) m.km = set.km; if (set.secs) m.secs = set.secs; }
    return m;
  }

  function beaten(set, type, records) {
    const m = setMetrics(set, type);
    return Object.keys(m).filter((k) => m[k] > records[k] + 1e-9);
  }

  function absorb(set, type, records) {
    const m = setMetrics(set, type);
    for (const k of Object.keys(m)) if (m[k] > records[k]) records[k] = m[k];
  }

  const byStart = (a, b) => a.start - b.start;

  /* Gennemgår alle træninger kronologisk.
     Første gang en øvelse logges tæller ikke som PR - der er intet at slå.
     Returnerer { records: {exId: rekorder}, prs: {workoutId: [{exId, setIndex, kinds}]} } */
  function computeRecords(workouts, typeOf) {
    const records = {}, prs = {};
    for (const w of [...workouts].sort(byStart)) {
      const list = [];
      for (const ex of w.exercises) {
        const type = typeOf(ex.exId);
        const seen = !!records[ex.exId];
        const rec = records[ex.exId] || (records[ex.exId] = emptyRecords());
        ex.sets.forEach((set, setIndex) => {
          if (!isWorking(set)) return;
          if (seen) {
            const kinds = beaten(set, type, rec);
            if (kinds.length) list.push({ exId: ex.exId, setIndex, kinds });
          }
          absorb(set, type, rec);
        });
      }
      if (list.length) prs[w.id] = list;
    }
    return { records, prs };
  }

  /* ---------- Forrige sæt ---------- */
  // Seneste træning med øvelsen. Opvarmning matches med opvarmning, arbejdssæt med arbejdssæt.
  function lastPerformance(workouts, exId, beforeStart) {
    let best = null;
    for (const w of workouts) {
      if (beforeStart && w.start >= beforeStart) continue;
      if (best && w.start <= best.start) continue;
      if (w.exercises.some((e) => e.exId === exId)) best = w;
    }
    return best ? { workout: best, exercise: best.exercises.find((e) => e.exId === exId) } : null;
  }

  function previousSets(exercise, sets) {
    if (!exercise) return sets.map(() => null);
    const warm = exercise.sets.filter((s) => s.type === "w");
    const work = exercise.sets.filter((s) => s.type !== "w");
    let wi = 0, ni = 0;
    return sets.map((s) => (s.type === "w" ? warm[wi++] : work[ni++]) || null);
  }

  /* ---------- Sætnumre: V, 1, 2, D, F ---------- */
  function setLabels(sets) {
    let n = 0;
    return sets.map((s) => {
      if (s.type === "w") return "V";
      if (s.type === "d") return "D";
      n++;
      return s.type === "f" ? "F" : String(n);
    });
  }

  /* ---------- Datoer ---------- */
  function startOfDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function startOfWeek(ts) { // Mandag
    const d = new Date(ts); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  }
  function addDays(ts, n) { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); }
  function isoDate(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function weekNumber(ts) { // ISO 8601
    const d = new Date(ts); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const jan4 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - jan4) / DAY - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  }

  /* ---------- Statistik ---------- */
  function weeklySeries(workouts, weeks, now = Date.now()) {
    const thisWeek = startOfWeek(now), rows = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const start = addDays(thisWeek, -7 * i);
      rows.push({ start, end: addDays(start, 7), week: weekNumber(start), workouts: 0, volume: 0, sets: 0, minutes: 0 });
    }
    for (const w of workouts) {
      const row = rows.find((r) => w.start >= r.start && w.start < r.end);
      if (!row) continue;
      const s = workoutStats(w);
      row.workouts++; row.volume += s.volume; row.sets += s.sets;
      row.minutes += s.duration ? s.duration / 60000 : 0;
    }
    return rows;
  }

  // Antal uger i træk med mindst én træning. En tom indeværende uge bryder ikke rækken.
  function weekStreak(workouts, now = Date.now()) {
    const weeks = new Set(workouts.map((w) => startOfWeek(w.start)));
    let cursor = startOfWeek(now), streak = 0;
    if (!weeks.has(cursor)) cursor = addDays(cursor, -7);
    while (weeks.has(cursor)) { streak++; cursor = addDays(cursor, -7); }
    return streak;
  }

  // Sekundære muskler tæller et halvt sæt.
  function muscleDistribution(workouts, exerciseOf, sinceTs) {
    const totals = {};
    for (const w of workouts) {
      if (sinceTs && w.start < sinceTs) continue;
      for (const ex of w.exercises) {
        const def = exerciseOf(ex.exId);
        if (!def) continue;
        const n = ex.sets.filter(isWorking).length;
        totals[def.muscle] = (totals[def.muscle] || 0) + n;
        for (const m of def.secondary || []) totals[m] = (totals[m] || 0) + n / 2;
      }
    }
    return Object.entries(totals).map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
  }

  // Ét punkt pr. træning for en øvelse - grundlag for graferne.
  function exerciseSeries(workouts, exId, type) {
    const rows = [];
    for (const w of [...workouts].sort(byStart)) {
      const ex = w.exercises.find((e) => e.exId === exId);
      if (!ex) continue;
      const row = { start: w.start, workoutId: w.id, kg: 0, e1rm: 0, volume: 0, reps: 0, secs: 0, km: 0 };
      for (const set of ex.sets) {
        if (!isWorking(set)) continue;
        const m = setMetrics(set, type);
        for (const k of ["kg", "e1rm", "secs", "km"]) if (m[k] > row[k]) row[k] = m[k];
        row.volume += setVolume(set);
        row.reps += set.reps || 0;
      }
      rows.push(row);
    }
    return rows;
  }

  /* ---------- Værktøjer ---------- */
  // Grådig skivefordeling pr. side.
  function platesPerSide(target, bar, plates) {
    let rest = (target - bar) / 2;
    if (rest < 0) return { plates: [], rest: 0, invalid: true };
    const out = [];
    for (const p of [...plates].sort((a, b) => b - a)) {
      while (rest + 1e-9 >= p) { out.push(p); rest -= p; }
    }
    return { plates: out, rest: Math.round(rest * 1000) / 1000, invalid: false };
  }

  // Opvarmningssæt op til arbejdsvægten, afrundet til nærmeste 2,5 kg.
  function warmupSets(workKg, barKg = 20) {
    const steps = [[0.4, 10], [0.6, 6], [0.8, 3]];
    const out = [];
    for (const [pct, reps] of steps) {
      const kg = Math.round((workKg * pct) / 2.5) * 2.5;
      if (kg >= barKg && kg < workKg && !out.some((s) => s.kg === kg)) out.push({ kg, reps });
    }
    return out;
  }

  // CSV med ét sæt pr. række. Semikolon og komma som Excel forventer på dansk.
  function workoutsToCsv(workouts, nameOf) {
    const cell = (v) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const dec = (v) => (v === null || v === undefined ? "" : String(Math.round(v * 1000) / 1000).replace(".", ","));
    const head = ["Dato", "Træning", "Øvelse", "Sæt", "Type", "Kg", "Reps", "Sekunder", "Km"];
    const rows = [head.join(";")];
    for (const w of [...workouts].sort(byStart)) {
      for (const ex of w.exercises) {
        const labels = setLabels(ex.sets);
        ex.sets.forEach((set, i) => {
          rows.push([isoDate(w.start), cell(w.title), cell(nameOf(ex.exId)), labels[i], set.type,
            dec(set.kg), set.reps ?? "", set.secs ?? "", dec(set.km)].join(";"));
        });
      }
    }
    return rows.join("\r\n");
  }

  Object.assign(TL, {
    DAY, num, parseDuration, fmtClock, fmtNum, toDisplay, fromDisplay, fmtWeight, fmtVolume, fmtDuration,
    isWorking, e1rm, setVolume, workoutStats, emptyRecords, PR_LABELS, setMetrics, beaten, absorb, computeRecords,
    lastPerformance, previousSets, setLabels, startOfDay, startOfWeek, addDays, isoDate, weekNumber,
    weeklySeries, weekStreak, muscleDistribution, exerciseSeries, platesPerSide, warmupSets, workoutsToCsv,
  });
})();
