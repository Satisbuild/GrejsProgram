/* Tilstand og lagring. Alt ligger i én localStorage-nøgle.
   De gamle tl_*-nøgler slettes aldrig: de er sikkerhedsnet, hvis migreringen skulle ramme forkert. */
var TL = (globalThis.TL = globalThis.TL || {});

(() => {
  const KEY = "tl2_state";
  const VERSION = 1;

  const DEFAULT_SETTINGS = {
    unit: "kg", theme: "auto", restDefault: 120, restAuto: true, sound: true, vibrate: true,
    keepAwake: true, barKg: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25], lastBackup: null,
  };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function freshState() {
    return {
      version: VERSION, customExercises: [], routines: [], workouts: [], measurements: [],
      settings: { ...DEFAULT_SETTINGS }, active: null, legacyDrafts: {},
    };
  }

  /* ---------- Øvelsesopslag ---------- */
  let state = null;
  const libById = new Map(TL.LIBRARY.map((e) => [e.id, e]));
  const libByName = new Map(TL.LIBRARY.map((e) => [e.name, e]));

  function exercise(id) {
    return libById.get(id) || state.customExercises.find((e) => e.id === id)
      || { id, name: "Ukendt øvelse", muscle: "andet", equipment: "andet", type: "wr", reps: "", secondary: [], missing: true };
  }
  const allExercises = () => [...TL.LIBRARY, ...state.customExercises];
  const typeOf = (id) => exercise(id).type;

  /* ---------- Rutiner ---------- */
  function routineExercise(exId, nSets, repsOverride, superset, note, rest) {
    const def = libById.get(exId) || exercise(exId);
    const reps = repsOverride ?? def.reps ?? "";
    return {
      uid: uid(), exId, superset: superset ?? null, note: note || "", rest: rest ?? null,
      sets: Array.from({ length: nSets }, () => ({ type: "n", kg: null, reps })),
    };
  }

  function defaultRoutines() {
    return TL.DEFAULT_ROUTINES.map((r) => ({
      id: r.id, title: r.title,
      exercises: r.exercises.map(([name, n, reps, sup, note]) => routineExercise(TL.slug(name), n, reps, sup, note)),
    }));
  }

  /* ---------- Migrering fra den gamle version (tl_log_*, tl_plan_*) ---------- */
  function readLegacy(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }

  function hasLegacyData() {
    return ["bryst", "ben", "ryg"].some((d) => localStorage.getItem(`tl_log_${d}`) || localStorage.getItem(`tl_plan_${d}`));
  }

  function migrateLegacy(s) {
    const LABELS = { bryst: "Bryst", ben: "Ben", ryg: "Ryg" };
    const customByName = new Map();

    const idForName = (name, reps) => {
      const lib = libByName.get(name);
      if (lib) return lib.id;
      if (!customByName.has(name)) {
        const custom = { id: `c-${TL.slug(name) || uid()}`, name, muscle: "andet", equipment: "andet", type: "wr", reps: reps || "", secondary: [], custom: true };
        customByName.set(name, custom);
        s.customExercises.push(custom);
      }
      return customByName.get(name).id;
    };

    const toSet = (exId, w, r) => {
      const kg = TL.num(w), reps = TL.num(r), type = (libById.get(exId) || { type: "wr" }).type;
      if (type === "time") return { type: "n", secs: reps };
      return { type: "n", kg, reps };
    };

    for (const day of ["bryst", "ben", "ryg"]) {
      const defaults = TL.DEFAULT_ROUTINES.find((r) => r.id === day);
      const legacyPlan = readLegacy(`tl_plan_${day}`);
      const log = readLegacy(`tl_log_${day}`) || {};

      // Rutine: gammel egen plan hvis den findes, ellers standarden
      if (Array.isArray(legacyPlan) && legacyPlan.length) {
        const groups = {};
        s.routines.push({
          id: day, title: LABELS[day],
          exercises: legacyPlan.map((ex) => {
            const group = ex.superset ? (groups[ex.superset] = groups[ex.superset] || Object.keys(groups).length + 1) : null;
            return routineExercise(idForName(ex.name, ex.reps), Math.max(1, ex.n || 3), ex.reps, group, ex.note);
          }),
        });
      } else {
        s.routines.push({
          id: day, title: LABELS[day],
          exercises: defaults.exercises.map(([name, n, reps, sup, note]) => routineExercise(TL.slug(name), n, reps, sup, note)),
        });
      }

      // Historik: "Sidst"-tallene grupperes pr. dato til rigtige træninger
      const byDate = {}, drafts = {};
      for (const [key, e] of Object.entries(log)) {
        const m = key.match(/^(.*)#(\d+)$/);
        if (!m || !e) continue;
        const [, name, si] = m;
        const exId = idForName(name);
        if (e.pd && (TL.num(e.pw) !== null || TL.num(e.pr) !== null)) {
          const bucket = (byDate[e.pd] = byDate[e.pd] || {});
          (bucket[exId] = bucket[exId] || []).push({ si: +si, set: toSet(exId, e.pw, e.pr) });
        }
        if (TL.num(e.w) !== null || TL.num(e.r) !== null) {
          (drafts[exId] = drafts[exId] || []).push({ si: +si, kg: e.w ?? "", reps: e.r ?? "" });
        }
      }

      const routine = s.routines[s.routines.length - 1];
      const order = routine.exercises.map((x) => x.exId);
      for (const [date, bucket] of Object.entries(byDate)) {
        const start = new Date(`${date}T12:00:00`).getTime();
        if (!Number.isFinite(start)) continue;
        const ids = Object.keys(bucket).sort((a, b) => {
          const ia = order.indexOf(a), ib = order.indexOf(b);
          return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
        });
        s.workouts.push({
          id: `legacy-${day}-${date}`, title: LABELS[day], routineId: day, start, end: null, note: "", imported: true,
          exercises: ids.map((exId) => ({
            exId, note: "", superset: null,
            sets: bucket[exId].sort((a, b) => a.si - b.si).map((x) => x.set),
          })),
        });
      }

      // Indtastede tal, der aldrig blev gemt: udfyldes når rutinen startes første gang
      if (Object.keys(drafts).length) s.legacyDrafts[day] = drafts;
    }
    s.workouts.sort((a, b) => b.start - a.start);
  }

  /* ---------- Indlæs og gem ---------- */
  function normalize(s) {
    const out = { ...freshState(), ...s };
    out.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
    return out;
  }

  let storageFailed = false;
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch { storageFailed = true; }
    if (raw) {
      try {
        state = normalize(JSON.parse(raw));
        return state;
      } catch {
        // Beskadiget data overskrives ikke: læg den til side, så den kan reddes manuelt.
        localStorage.setItem(`${KEY}_corrupt_${Date.now()}`, raw);
      }
    }
    state = freshState();
    if (!storageFailed && hasLegacyData()) migrateLegacy(state);
    else state.routines = defaultRoutines();
    persist();
    return state;
  }

  let saveTimer = null;
  let onSaveError = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      if (onSaveError) onSaveError();
    }
  }
  // Tastetryk samles, men alle andre ændringer kan gemmes med flush().
  function save() {
    if (!saveTimer) saveTimer = setTimeout(persist, 200);
  }
  const flush = () => { if (saveTimer) persist(); };

  /* ---------- Import / eksport ---------- */
  function exportJson() {
    return JSON.stringify({ app: "traeningslog", exportedAt: new Date().toISOString(), ...state, active: null }, null, 1);
  }

  function validateImport(data) {
    if (!data || typeof data !== "object") return "Filen indeholder ikke gyldige data.";
    if (!Array.isArray(data.workouts) || !Array.isArray(data.routines)) return "Filen ligner ikke en backup fra Træningslog.";
    const validExercise = (ex) => typeof ex.exId === "string" && Array.isArray(ex.sets) && ex.sets.every((s) => ["n", "w", "f", "d"].includes(s.type));
    for (const w of data.workouts) {
      if (typeof w.start !== "number" || !Array.isArray(w.exercises) || !w.exercises.every(validExercise)) return "En af træningerne i filen er ugyldig.";
    }
    for (const r of data.routines) {
      if (!Array.isArray(r.exercises) || !r.exercises.every(validExercise)) return "En af rutinerne i filen er ugyldig.";
    }
    return null;
  }

  function replaceState(data) {
    const { app, exportedAt, ...rest } = data;
    state = normalize({ ...rest, active: null });
    persist();
    return state;
  }

  Object.assign(TL, {
    uid, exercise, allExercises, typeOf, routineExercise, load, save, flush, persist,
    exportJson, validateImport, replaceState, DEFAULT_SETTINGS,
    setSaveErrorHandler(fn) { onSaveError = fn; },
  });
  // Getter, da replaceState udskifter hele objektet. Object.assign ville kopiere værdien.
  Object.defineProperty(TL, "state", { get: () => state });
})();
