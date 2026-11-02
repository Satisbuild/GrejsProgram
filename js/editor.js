/* Træningseditoren. Samme skærm i tre tilstande:
   live    - træning i gang (ur, pausetimer, flueben)
   edit    - redigér en gemt træning eller tilføj en tidligere
   routine - byg en rutine (ingen flueben, reps er et mål som "8-12") */
var TL = (globalThis.TL = globalThis.TL || {});

(() => {
  const { esc, icon, uid } = TL;
  const S = () => TL.state;

  let routineDraft = null;

  // Hvilket dokument arbejder vi på lige nu?
  const doc = () => (location.hash.startsWith("#/rutine") ? routineDraft : S().active);

  /* ---------- Opret dokumenter ---------- */
  function blankSet(type = "n", targets = {}) {
    return { id: uid(), type, kg: "", reps: "", secs: "", km: "", done: false, tKg: targets.tKg ?? null, tReps: targets.tReps ?? "" };
  }

  const inputNum = (v) => (v === null || v === undefined ? "" : String(Math.round(v * 100) / 100).replace(".", ","));

  function newLive({ title = "Træning", routine = null } = {}) {
    const drafts = routine ? S().legacyDrafts[routine.id] : null;
    const unit = S().settings.unit;
    const d = {
      id: uid(), mode: "live", routineId: routine ? routine.id : null, title, note: "", start: Date.now(), unit, rest: null,
      exercises: (routine ? routine.exercises : []).map((re) => ({
        uid: uid(), exId: re.exId, note: re.note || "", rest: re.rest ?? null, superset: re.superset ?? null,
        sets: re.sets.map((s, i) => {
          const set = blankSet(s.type, { tKg: s.kg, tReps: s.reps });
          const draft = drafts && drafts[re.exId] && drafts[re.exId].find((x) => x.si === i);
          if (draft) { set.kg = String(draft.kg).replace(".", ","); set.reps = String(draft.reps); }
          return set;
        }),
      })),
    };
    if (drafts) delete S().legacyDrafts[routine.id];
    return d;
  }

  function fromWorkout(w) {
    const unit = S().settings.unit;
    return {
      id: w.id, mode: "edit", editingId: w.id, routineId: w.routineId, title: w.title, note: w.note || "", start: w.start,
      durationMin: w.end ? Math.round((w.end - w.start) / 60000) : "", unit, imported: !!w.imported, rest: null,
      exercises: w.exercises.map((ex) => ({
        uid: uid(), exId: ex.exId, note: ex.note || "", rest: ex.rest ?? null, superset: ex.superset ?? null,
        sets: ex.sets.map((s) => ({
          ...blankSet(s.type), done: true,
          kg: inputNum(TL.toDisplay(s.kg, unit)), reps: s.reps ?? "", km: inputNum(s.km), secs: s.secs ? TL.fmtClock(s.secs) : "",
        })),
      })),
    };
  }

  function newPastWorkout() {
    return {
      id: uid(), mode: "edit", editingId: null, routineId: null, title: "Træning", note: "", start: Date.now() - 3600000, durationMin: 60,
      unit: S().settings.unit, rest: null, exercises: [],
    };
  }

  function routineToDoc(r) {
    return {
      id: r.id, mode: "routine", routineId: r.id, isNew: !!r.isNew, title: r.title, unit: S().settings.unit,
      exercises: r.exercises.map((re) => ({
        uid: uid(), exId: re.exId, note: re.note || "", rest: re.rest ?? null, superset: re.superset ?? null,
        sets: re.sets.map((s) => ({ ...blankSet(s.type), kg: inputNum(TL.toDisplay(s.kg, S().settings.unit)), reps: s.reps ?? "" })),
      })),
    };
  }

  /* ---------- Start / genoptag ---------- */
  function canStart() {
    if (!S().active) return true;
    TL.go("#/aktiv");
    TL.toast(S().active.mode === "edit" ? "Afslut redigeringen først" : "Du har allerede en træning i gang");
    return false;
  }

  function startWorkout(routine) {
    if (!canStart()) return;
    S().active = newLive(routine ? { title: routine.title, routine } : {});
    TL.persist();
    TL.acquireWakeLock();
    TL.go("#/aktiv");
  }

  function startFromWorkout(w) {
    if (!canStart()) return;
    const fake = {
      id: null, title: w.title,
      exercises: w.exercises.map((ex) => ({
        exId: ex.exId, note: ex.note, rest: ex.rest ?? null, superset: ex.superset,
        sets: ex.sets.map((s) => ({ type: s.type, kg: null, reps: "" })),
      })),
    };
    const d = newLive({ title: w.title, routine: fake });
    d.routineId = w.routineId || null;
    S().active = d;
    TL.persist();
    TL.go("#/aktiv");
  }

  function editWorkout(w) {
    if (!canStart()) return;
    S().active = fromWorkout(w);
    TL.persist();
    TL.go("#/aktiv");
  }

  function logPast() {
    if (!canStart()) return;
    S().active = newPastWorkout();
    TL.persist();
    TL.go("#/aktiv");
  }

  const routineSnapshot = (d) => JSON.stringify([d.title, d.exercises]);

  function editRoutine(r) {
    routineDraft = routineToDoc(r);
    routineDraft.snapshot = routineSnapshot(routineDraft);
    TL.go(`#/rutine/${r.id}`);
  }

  /* ---------- PR'er under træningen ---------- */
  // Rekorder fra historikken (uden den træning der redigeres), derefter sæt for sæt i dokumentet.
  function docPrs(d) {
    const others = S().workouts.filter((w) => w.id !== d.editingId && (d.mode !== "edit" || w.start < d.start));
    const { records } = TL.computeRecords(others, TL.typeOf);
    const out = {}, working = {};
    for (const ex of d.exercises) {
      const type = TL.typeOf(ex.exId);
      if (!records[ex.exId]) continue; // Første gang tæller ikke
      const rec = (working[ex.exId] = working[ex.exId] || { ...records[ex.exId] });
      for (const set of ex.sets) {
        if (!set.done || set.type === "w") continue;
        const parsed = parseSet(set, type, d.unit);
        const kinds = TL.beaten(parsed, type, rec);
        if (kinds.length) out[set.id] = kinds;
        TL.absorb(parsed, type, rec);
      }
    }
    return out;
  }

  function parseSet(set, type, unit) {
    const out = { type: set.type };
    if (type === "wr" || type === "bwx") {
      out.kg = TL.fromDisplay(TL.num(set.kg), unit);
      if (out.kg !== null) out.kg = Math.round(out.kg * 1000) / 1000;
      out.reps = TL.num(set.reps);
    } else if (type === "bw") out.reps = TL.num(set.reps);
    else if (type === "time") out.secs = TL.parseDuration(set.secs);
    else if (type === "cardio") { out.km = TL.num(set.km); out.secs = TL.parseDuration(set.secs); }
    return out;
  }

  function setIsComplete(set, type) {
    const p = parseSet(set, type, "kg");
    if (type === "wr") return p.kg !== null && p.reps !== null;
    if (type === "bwx" || type === "bw") return p.reps !== null;
    if (type === "time") return p.secs !== null;
    return p.km !== null || p.secs !== null;
  }

  const lowerBound = (t) => { const m = String(t || "").match(/\d+/); return m ? m[0] : ""; };

  // Tomme felter udfyldes fra forrige gang eller rutinens mål, som i Hevy.
  function fillFromHints(set, type, prev, unit) {
    const dec = (v) => (v === null || v === undefined ? "" : inputNum(TL.toDisplay(v, unit)));
    if ((type === "wr" || type === "bwx") && set.kg === "") set.kg = dec(prev?.kg ?? set.tKg);
    if ((type === "wr" || type === "bwx" || type === "bw") && set.reps === "") set.reps = String(prev?.reps ?? lowerBound(set.tReps));
    if ((type === "time" || type === "cardio") && set.secs === "" && prev?.secs) set.secs = TL.fmtClock(prev.secs);
    if (type === "cardio" && set.km === "" && prev?.km) set.km = inputNum(prev.km);
  }

  function prevFor(d, ex) {
    const before = d.mode === "edit" ? d.start : undefined;
    const others = d.editingId ? S().workouts.filter((w) => w.id !== d.editingId) : S().workouts;
    const last = TL.lastPerformance(others, ex.exId, before);
    return TL.previousSets(last && last.exercise, ex.sets);
  }

  /* ---------- Render ---------- */
  const SUPERSET_NAMES = "ABCDEFGH";
  function supersetLetters(d) {
    const seen = [];
    d.exercises.forEach((ex) => { if (ex.superset !== null && !seen.includes(ex.superset)) seen.push(ex.superset); });
    return Object.fromEntries(seen.map((g, i) => [g, i]));
  }

  function fmtPrev(p, type, unit) {
    if (!p) return "–";
    if (type === "wr" || type === "bwx") {
      if (p.kg && p.reps) return `${TL.fmtWeight(p.kg, unit)} × ${p.reps}`;
      if (p.reps) return `${p.reps} reps`;
      return p.kg ? `${TL.fmtWeight(p.kg, unit)} ${unit}` : "–";
    }
    if (type === "bw") return p.reps ? `${p.reps} reps` : "–";
    if (type === "time") return p.secs ? TL.fmtClock(p.secs) : "–";
    if (type === "cardio") return [p.km ? `${TL.fmtNum(p.km)} km` : "", p.secs ? TL.fmtClock(p.secs) : ""].filter(Boolean).join(" · ") || "–";
    return "–";
  }

  function columnsFor(type, d) {
    const kgLabel = type === "bwx" ? `+${d.unit}` : d.unit;
    if (type === "wr" || type === "bwx") return [["kg", kgLabel, "decimal"], ["reps", d.mode === "routine" ? "Mål" : "Reps", d.mode === "routine" ? "text" : "numeric"]];
    if (type === "bw") return [["reps", d.mode === "routine" ? "Mål" : "Reps", d.mode === "routine" ? "text" : "numeric"]];
    if (type === "time") return [["secs", "Tid", "text"]];
    return [["km", "Km", "decimal"], ["secs", "Tid", "text"]];
  }

  function placeholder(field, set, prev, d) {
    if (field === "kg") {
      const v = prev?.kg ?? set.tKg;
      return v ? inputNum(TL.toDisplay(v, d.unit)) : "";
    }
    if (field === "reps") {
      if (d.mode === "routine") return "8-12";
      return set.tReps && /\d/.test(set.tReps) ? set.tReps : prev?.reps ?? (set.tReps || "");
    }
    if (field === "secs") return prev?.secs ? TL.fmtClock(prev.secs) : "0:00";
    if (field === "km") return prev?.km ? inputNum(prev.km) : "";
    return "";
  }

  function renderSet(d, ex, set, i, labels, prevs, prs, type, cols) {
    const label = labels[i];
    const prev = prevs[i];
    const showCheck = d.mode === "live";
    const pr = prs[set.id];
    return `
      <div class="set-row cols-${cols.length} ${d.mode === "routine" ? "no-prev" : ""} ${showCheck ? "" : "no-check"} ${set.done && showCheck ? "done" : ""} ${set.id === justDone ? "pop" : ""}" data-set="${set.id}">
        <button type="button" class="set-label type-${set.type}" data-act="set-menu" data-ex="${ex.uid}" data-set-id="${set.id}" aria-label="Sæt ${esc(label)}: skift type eller slet">${esc(label)}${pr ? `<span class="pr-mark">${icon("trophy")}</span>` : ""}</button>
        ${d.mode === "routine" ? "" : `<button type="button" class="set-prev" data-act="use-prev" data-ex="${ex.uid}" data-set-id="${set.id}" ${prev ? "" : "disabled"} aria-label="Forrige: ${esc(fmtPrev(prev, type, d.unit))}. Tryk for at bruge">${esc(fmtPrev(prev, type, d.unit))}</button>`}
        ${cols.map(([field, name, mode]) => `
          <input class="set-input" data-field="${field}" data-ex="${ex.uid}" data-set-id="${set.id}" inputmode="${mode}" enterkeyhint="next" autocomplete="off"
            value="${esc(set[field])}" placeholder="${esc(placeholder(field, set, prev, d))}" aria-label="${esc(name)}, sæt ${esc(label)}">`).join("")}
        ${showCheck ? `<button type="button" class="set-check" data-act="toggle-set" data-ex="${ex.uid}" data-set-id="${set.id}" aria-pressed="${set.done}" aria-label="Markér sæt ${esc(label)} som færdigt">${icon("check")}</button>` : ""}
      </div>`;
  }

  function renderExercise(d, ex, letters, prs) {
    const def = TL.exercise(ex.exId);
    const type = def.type;
    const cols = columnsFor(type, d);
    const labels = TL.setLabels(ex.sets);
    const prevs = d.mode === "routine" ? [] : prevFor(d, ex);
    const groupIdx = ex.superset !== null ? letters[ex.superset] : null;
    const rest = ex.rest ?? S().settings.restDefault;
    return `
      <section class="ex-card ${groupIdx !== null ? `superset sg-${groupIdx % 4}` : ""}" data-ex-card="${ex.uid}">
        ${groupIdx !== null ? `<div class="superset-tag">${icon("link")} Superset ${SUPERSET_NAMES[groupIdx % 8]}</div>` : ""}
        <header class="ex-head">
          <span class="avatar">${TL.eqIcon(def.equipment)}</span>
          <a class="ex-name" href="#/ovelse/${esc(ex.exId)}">${esc(def.name)}</a>
          <button type="button" class="icon-btn" data-act="ex-menu" data-ex="${ex.uid}" aria-label="Flere valg for ${esc(def.name)}">${icon("dots")}</button>
        </header>
        <textarea class="ex-note" data-note="${ex.uid}" rows="1" placeholder="Tilføj note…" aria-label="Note til ${esc(def.name)}">${esc(ex.note)}</textarea>
        ${d.mode !== "edit" && type !== "cardio" ? `<button type="button" class="ex-rest" data-act="ex-rest" data-ex="${ex.uid}">${icon("timer")} Pause: ${rest ? TL.fmtClock(rest) : "fra"}</button>` : ""}
        <div class="set-table">
          <div class="set-row set-head cols-${cols.length} ${d.mode === "routine" ? "no-prev" : ""} ${d.mode === "live" ? "" : "no-check"}">
            <span>Sæt</span>
            ${d.mode === "routine" ? "" : "<span>Forrige</span>"}
            ${cols.map((c) => `<span>${esc(c[1])}</span>`).join("")}
            ${d.mode === "live" ? `<span class="head-check">${icon("check")}</span>` : ""}
          </div>
          ${ex.sets.map((set, i) => renderSet(d, ex, set, i, labels, prevs, prs, type, cols)).join("")}
        </div>
        <button type="button" class="btn btn-soft btn-wide btn-sm" data-act="add-set" data-ex="${ex.uid}">${icon("plus")} Tilføj sæt</button>
      </section>`;
  }

  function restBar(d) {
    if (d.mode !== "live" || !d.rest) return "";
    return `
      <div class="rest-bar" id="restBar">
        <div class="rest-progress"><div id="restFill"></div></div>
        <div class="rest-row">
          <button type="button" class="btn btn-soft btn-sm" data-act="rest-adjust" data-d="-15">−15</button>
          <div class="rest-time" id="restTime" role="timer">–:––</div>
          <button type="button" class="btn btn-soft btn-sm" data-act="rest-adjust" data-d="15">+15</button>
          <button type="button" class="btn btn-primary btn-sm" data-act="rest-skip">Spring over</button>
        </div>
      </div>`;
  }

  let justDone = null;

  function renderEditor(d) {
    const letters = supersetLetters(d);
    const prs = d.mode === "routine" ? {} : docPrs(d);
    let stats = "";
    if (d.mode === "live") {
      let vol = 0, sets = 0;
      d.exercises.forEach((ex) => {
        const t = TL.typeOf(ex.exId);
        ex.sets.forEach((s) => { if (s.done && s.type !== "w") { sets++; vol += TL.setVolume(parseSet(s, t, d.unit)); } });
      });
      stats = `
        <div class="live-stats">
          <div><small>Tid</small><strong data-clock>${TL.fmtClock((Date.now() - d.start) / 1000)}</strong></div>
          <div><small>Volumen</small><strong>${TL.fmtVolume(vol, S().settings.unit)}</strong></div>
          <div><small>Sæt</small><strong>${sets}</strong></div>
          <div><small>PR</small><strong>${Object.keys(prs).length}</strong></div>
        </div>`;
    }
    const titles = { live: "Træning", edit: d.editingId ? "Redigér træning" : "Tidligere træning", routine: d.isNew ? "Ny rutine" : "Redigér rutine" };
    const finishLabel = d.mode === "live" ? "Afslut" : "Gem";
    return `
      <div class="editor mode-${d.mode}">
        <header class="topbar">
          <button type="button" class="icon-btn" data-act="editor-back" aria-label="${d.mode === "live" ? "Minimér træning" : "Tilbage"}">${icon(d.mode === "live" ? "down" : "back")}</button>
          <h1 class="topbar-title">${titles[d.mode]}</h1>
          <button type="button" class="btn btn-primary btn-sm" data-act="editor-finish">${finishLabel}</button>
        </header>
        ${stats}
        <div class="editor-body">
          <input class="title-input" data-doc-field="title" value="${esc(d.title)}" placeholder="Navn" aria-label="Navn" autocomplete="off">
          ${d.mode === "edit" ? `
            <div class="edit-meta">
              <label class="field"><span>Dato og starttid</span><input type="datetime-local" data-doc-field="startLocal" value="${toLocalInput(d.start)}"></label>
              <label class="field"><span>Varighed (min)</span><input inputmode="numeric" data-doc-field="durationMin" value="${esc(d.durationMin)}" placeholder="Ukendt"></label>
            </div>` : ""}
          ${d.mode !== "routine" ? `<textarea class="ex-note workout-note" data-doc-field="note" rows="1" placeholder="Note til træningen…" aria-label="Note til træningen">${esc(d.note)}</textarea>` : ""}
          ${d.exercises.map((ex) => renderExercise(d, ex, letters, prs)).join("")}
          ${d.exercises.length ? "" : `<div class="empty"><span class="empty-icon">${icon("dumbbell")}</span><p>Ingen øvelser endnu</p></div>`}
          <button type="button" class="btn btn-primary-soft btn-wide" data-act="add-exercises">${icon("plus")} Tilføj øvelse</button>
          ${d.mode === "live" ? `<button type="button" class="btn btn-text-danger btn-wide" data-act="discard-workout">Kassér træning</button>` : ""}
          ${d.mode === "routine" && !d.isNew ? `<button type="button" class="btn btn-text-danger btn-wide" data-act="delete-routine">Slet rutine</button>` : ""}
          ${d.mode === "edit" ? `<button type="button" class="btn btn-text-danger btn-wide" data-act="discard-workout">Annullér ændringer</button>` : ""}
        </div>
        ${restBar(d)}
      </div>`;
  }

  function toLocalInput(ts) {
    const d = new Date(ts);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  function rerender() {
    const scroller = document.scrollingElement;
    const top = scroller.scrollTop;
    TL.render();
    scroller.scrollTop = top;
    autoSizeNotes();
    TL.tick();
    justDone = null;
  }

  function autoSizeNotes() {
    document.querySelectorAll("textarea.ex-note").forEach(sizeNote);
  }
  function sizeNote(el) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }

  TL.views.active = () => {
    const d = S().active;
    if (!d) { TL.go("#/", true); return { html: "" }; }
    return { html: renderEditor(d), hideTabs: true, after: autoSizeNotes };
  };
  TL.views.routineEditor = (id) => {
    if (!routineDraft || routineDraft.id !== id) {
      const r = S().routines.find((x) => x.id === id);
      if (!r) { TL.go("#/", true); return { html: "" }; }
      routineDraft = routineToDoc(r);
      routineDraft.snapshot = routineSnapshot(routineDraft);
    }
    return { html: renderEditor(routineDraft), hideTabs: true, after: autoSizeNotes };
  };

  /* ---------- Opslag ---------- */
  const exOf = (uidValue) => doc().exercises.find((e) => e.uid === uidValue);
  const setOf = (ex, id) => ex.sets.find((s) => s.id === id);
  function touch() {
    if (doc() === S().active) TL.persist();
  }

  /* ---------- Sæt-handlinger ---------- */
  Object.assign(TL.actions, {
    "add-set"(el) {
      const ex = exOf(el.dataset.ex);
      const last = ex.sets[ex.sets.length - 1];
      const d = doc();
      const next = blankSet(last && last.type !== "w" ? last.type : "n", last ? { tKg: last.tKg, tReps: last.tReps } : { tReps: TL.exercise(ex.exId).reps });
      if (d.mode === "routine") next.reps = last ? last.reps : TL.exercise(ex.exId).reps;
      ex.sets.push(next);
      touch(); rerender();
    },

    "toggle-set"(el) {
      TL.unlockAudio();
      const d = doc(), ex = exOf(el.dataset.ex), set = setOf(ex, el.dataset.setId);
      if (!ex || !set) return;
      if (set.done) { set.done = false; touch(); rerender(); return; }
      const type = TL.typeOf(ex.exId);
      const idx = ex.sets.indexOf(set);
      fillFromHints(set, type, prevFor(d, ex)[idx], d.unit);
      if (!setIsComplete(set, type)) {
        rerender();
        const row = document.querySelector(`[data-set="${set.id}"]`);
        row.classList.add("shake");
        const first = [...row.querySelectorAll(".set-input")].find((i) => !i.value);
        if (first) first.focus();
        TL.toast(type === "wr" ? "Indtast vægt og reps" : "Indtast en værdi");
        return;
      }
      set.done = true;
      justDone = set.id;
      if (S().settings.vibrate && navigator.vibrate) navigator.vibrate(15);
      if (shouldRest(d, ex)) startRest(d, set.type === "w" ? Math.min(60, restFor(ex)) : restFor(ex));
      touch(); rerender();
      const kinds = docPrs(d)[set.id];
      if (kinds) TL.toast(`Ny rekord: ${TL.PR_LABELS[kinds[0]]}`);
    },

    "use-prev"(el) {
      const d = doc(), ex = exOf(el.dataset.ex), set = setOf(ex, el.dataset.setId);
      if (!set || set.done) return;
      const type = TL.typeOf(ex.exId);
      const p = prevFor(d, ex)[ex.sets.indexOf(set)];
      if (!p) return;
      const dec = (v) => (v === null || v === undefined ? "" : inputNum(TL.toDisplay(v, d.unit)));
      if (type === "wr" || type === "bwx") { set.kg = dec(p.kg); set.reps = p.reps ?? ""; }
      if (type === "bw") set.reps = p.reps ?? "";
      if (type === "time" || type === "cardio") set.secs = p.secs ? TL.fmtClock(p.secs) : "";
      if (type === "cardio") set.km = p.km ? inputNum(p.km) : "";
      touch(); rerender();
    },

    "set-menu"(el) {
      const ex = exOf(el.dataset.ex), set = setOf(ex, el.dataset.setId);
      const apply = (type) => () => { set.type = type; touch(); rerender(); };
      TL.menu("Sættype", [
        { label: "Normalt sæt", hint: set.type === "n" ? "Valgt" : "", run: apply("n") },
        { label: "Opvarmning", hint: set.type === "w" ? "Valgt" : "Tæller ikke med i volumen og rekorder", run: apply("w") },
        { label: "Til failure", hint: set.type === "f" ? "Valgt" : "", run: apply("f") },
        { label: "Dropsæt", hint: set.type === "d" ? "Valgt" : "", run: apply("d") },
        { label: "Slet sæt", icon: "trash", danger: true, run() {
          ex.sets.splice(ex.sets.indexOf(set), 1);
          if (!ex.sets.length) removeExercise(ex);
          touch(); rerender();
        } },
      ]);
    },

    "ex-rest"(el) { pickRest(exOf(el.dataset.ex)); },

    "ex-menu"(el) {
      const d = doc(), ex = exOf(el.dataset.ex), def = TL.exercise(ex.exId);
      const i = d.exercises.indexOf(ex);
      const weighted = def.type === "wr" || def.type === "bwx";
      TL.menu(def.name, [
        i > 0 && { label: "Flyt op", icon: "up", run() { move(d, i, -1); } },
        i < d.exercises.length - 1 && { label: "Flyt ned", icon: "down", run() { move(d, i, 1); } },
        { label: "Erstat øvelse", icon: "swap", run() { replaceExercise(ex); } },
        d.exercises.length > 1 && (ex.superset !== null
          ? { label: "Fjern fra superset", icon: "link", run() { unlink(d, ex); touch(); rerender(); } }
          : { label: "Lav superset med…", icon: "link", run() { pickSuperset(d, ex); } }),
        d.mode === "live" && weighted && def.type === "wr" && { label: "Opvarmningssæt", icon: "flame", hint: "Beregnes ud fra din arbejdsvægt", run() { addWarmups(d, ex); } },
        weighted && def.type === "wr" && { label: "Skiveberegner", icon: "calc", run() { TL.openPlateCalc(TL.num(ex.sets.find((s) => s.kg)?.kg) ?? null); } },
        { label: "Fjern øvelse", icon: "trash", danger: true, run() { removeExercise(ex); touch(); rerender(); } },
      ]);
    },

    "add-exercises"() {
      TL.openPicker({
        multi: true,
        title: "Tilføj øvelser",
        onPick(ids) {
          const d = doc();
          for (const id of ids) {
            const def = TL.exercise(id);
            d.exercises.push({
              uid: uid(), exId: id, note: "", rest: null, superset: null,
              sets: Array.from({ length: 3 }, () => {
                const s = blankSet("n", { tReps: def.reps });
                if (d.mode === "routine") s.reps = def.reps;
                return s;
              }),
            });
          }
          touch(); rerender();
          requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
        },
      });
    },

    "rest-adjust"(el) {
      const d = doc();
      if (!d.rest) return;
      const delta = +el.dataset.d * 1000;
      d.rest.endsAt += delta;
      d.rest.total = Math.max(1000, d.rest.total + delta);
      TL.persist(); TL.tick();
    },
    "rest-skip"() { stopRest(); rerenderIfEditor(); },
    "rest-open"() { TL.go("#/aktiv"); },

    async "editor-back"() {
      const d = doc();
      if (d.mode === "live") { TL.go("#/"); return; }
      if (d.mode === "routine") {
        if (routineSnapshot(d) !== d.snapshot && !(await TL.confirmDialog({
          title: "Kassér ændringer?", body: "Det du har ændret i rutinen, bliver ikke gemt.", ok: "Kassér", cancel: "Fortsæt", danger: true,
        }))) return;
        routineDraft = null;
        TL.go("#/");
        return;
      }
      if (await TL.confirmDialog({ title: "Annullér ændringer?", body: "Det du har ændret her, bliver ikke gemt.", ok: "Annullér ændringer", cancel: "Fortsæt", danger: true })) {
        S().active = null; TL.persist();
        TL.go(d.editingId ? `#/traening/${d.editingId}` : "#/historik");
      }
    },

    async "discard-workout"() {
      const d = doc();
      if (d.mode === "edit") { TL.actions["editor-back"](); return; }
      const done = d.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);
      if (await TL.confirmDialog({
        title: "Kassér træningen?",
        body: done ? `Du har ${done} færdige sæt, som vil gå tabt.` : "Den bliver ikke gemt.",
        ok: "Kassér", cancel: "Fortsæt træning", danger: true,
      })) {
        stopRest();
        S().active = null; TL.persist();
        TL.releaseWakeLock();
        TL.go("#/");
      }
    },

    async "delete-routine"() {
      const d = doc();
      if (!(await TL.confirmDialog({ title: `Slet "${d.title}"?`, body: "Din historik bevares.", ok: "Slet", danger: true }))) return;
      TL.removeRoutine(d.routineId);
      routineDraft = null;
      TL.go("#/");
    },

    "editor-finish"() {
      const d = doc();
      if (d.mode === "routine") saveRoutineDoc(d);
      else if (d.mode === "edit") saveEdit(d);
      else finishLive(d);
    },
  });

  function move(d, i, delta) {
    const [ex] = d.exercises.splice(i, 1);
    d.exercises.splice(i + delta, 0, ex);
    touch(); rerender();
  }

  function removeExercise(ex) {
    const d = doc();
    d.exercises.splice(d.exercises.indexOf(ex), 1);
    cleanSupersets(d);
  }

  function unlink(d, ex) {
    ex.superset = null;
    cleanSupersets(d);
  }

  // En gruppe med kun én øvelse er ikke et superset længere.
  function cleanSupersets(d) {
    const counts = {};
    d.exercises.forEach((e) => { if (e.superset !== null) counts[e.superset] = (counts[e.superset] || 0) + 1; });
    d.exercises.forEach((e) => { if (e.superset !== null && counts[e.superset] < 2) e.superset = null; });
  }

  function pickSuperset(d, ex) {
    const others = d.exercises.filter((e) => e !== ex);
    TL.menu("Superset med", others.map((o) => ({
      label: TL.exercise(o.exId).name,
      hint: o.superset !== null ? "Allerede i et superset" : "",
      run() {
        // Øvelserne skal stå lige efter hinanden for at give mening.
        // Den valgte makker flyttes op til os; findes gruppen allerede, slutter vi os til den.
        if (o.superset === null) {
          const group = Math.max(0, ...d.exercises.map((e) => e.superset ?? 0)) + 1;
          o.superset = group;
          ex.superset = group;
          d.exercises.splice(d.exercises.indexOf(o), 1);
          d.exercises.splice(d.exercises.indexOf(ex) + 1, 0, o);
        } else {
          ex.superset = o.superset;
          d.exercises.splice(d.exercises.indexOf(ex), 1);
          const lastInGroup = d.exercises.map((e) => e.superset).lastIndexOf(o.superset);
          d.exercises.splice(lastInGroup + 1, 0, ex);
        }
        cleanSupersets(d);
        touch(); rerender();
      },
    })));
  }

  function replaceExercise(ex) {
    TL.openPicker({
      title: "Erstat øvelse",
      onPick([id]) {
        const def = TL.exercise(id);
        ex.exId = id;
        ex.sets.forEach((s) => { s.done = false; s.kg = ""; s.secs = ""; s.km = ""; s.reps = doc().mode === "routine" ? def.reps : ""; s.tKg = null; s.tReps = def.reps; });
        touch(); rerender();
      },
    });
  }

  function addWarmups(d, ex) {
    const prevs = prevFor(d, ex);
    const firstWork = ex.sets.findIndex((s) => s.type !== "w");
    const typed = firstWork >= 0 ? TL.fromDisplay(TL.num(ex.sets[firstWork].kg), d.unit) : null;
    const workKg = typed ?? prevs[firstWork]?.kg ?? null;
    if (!workKg) { TL.toast("Indtast din arbejdsvægt først"); return; }
    const sets = TL.warmupSets(workKg, S().settings.barKg);
    if (!sets.length) { TL.toast("Vægten er for lav til opvarmningssæt"); return; }
    const made = sets.map((w) => ({ ...blankSet("w"), kg: inputNum(TL.toDisplay(w.kg, d.unit)), reps: String(w.reps) }));
    ex.sets = [...made, ...ex.sets.filter((s) => !(s.type === "w" && !s.done))];
    touch(); rerender();
  }

  const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
  function pickRest(ex) {
    TL.menu("Pausetid", REST_OPTIONS.map((sec) => ({
      label: sec ? TL.fmtClock(sec) : "Ingen pause",
      hint: (ex.rest ?? S().settings.restDefault) === sec ? "Valgt" : "",
      run() { ex.rest = sec; touch(); rerender(); },
    })));
  }

  /* ---------- Pausetimer ---------- */
  const restFor = (ex) => ex.rest ?? S().settings.restDefault;

  function shouldRest(d, ex) {
    if (d.mode !== "live" || !S().settings.restAuto || !restFor(ex)) return false;
    if (ex.superset === null) return true;
    // I et superset holdes pausen først efter gruppens sidste øvelse.
    const members = d.exercises.filter((e) => e.superset === ex.superset);
    return members[members.length - 1] === ex;
  }

  function startRest(d, secs) {
    d.rest = { endsAt: Date.now() + secs * 1000, total: secs * 1000 };
  }
  function stopRest() {
    if (S().active) { S().active.rest = null; TL.persist(); }
  }
  function rerenderIfEditor() {
    if (location.hash.startsWith("#/aktiv")) rerender();
    else TL.renderChrome();
  }

  function restFinished() {
    const s = S().settings;
    if (s.sound) TL.beep();
    if (s.vibrate && navigator.vibrate) navigator.vibrate([200, 100, 200]);
    S().active.rest = null;
    TL.persist();
    rerenderIfEditor();
  }

  /* ---------- Lyd ---------- */
  let audio = null;
  TL.unlockAudio = () => {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
    } catch { audio = null; }
  };
  TL.beep = () => {
    if (!audio) return;
    [0, 0.22, 0.44].forEach((at) => {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, audio.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + at + 0.18);
      osc.connect(gain).connect(audio.destination);
      osc.start(audio.currentTime + at);
      osc.stop(audio.currentTime + at + 0.2);
    });
  };

  /* ---------- Hold skærmen tændt ---------- */
  let wakeLock = null;
  TL.acquireWakeLock = async () => {
    const a = S().active;
    if (!a || a.mode !== "live" || !S().settings.keepAwake || !navigator.wakeLock || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } catch { wakeLock = null; }
  };
  TL.releaseWakeLock = () => { if (wakeLock) wakeLock.release(); };

  /* ---------- Ur: opdaterer kun tekst, så felter ikke mister fokus ---------- */
  TL.tick = () => {
    const a = S().active;
    if (!a) return;
    if (a.mode === "live") {
      const clock = TL.fmtClock((Date.now() - a.start) / 1000);
      document.querySelectorAll("[data-clock]").forEach((el) => { el.textContent = clock; });
    }
    if (a.rest) {
      const left = a.rest.endsAt - Date.now();
      if (left <= 0) { restFinished(); return; }
      const txt = TL.fmtClock(Math.ceil(left / 1000));
      document.querySelectorAll("#restTime, [data-rest-time]").forEach((el) => { el.textContent = txt; });
      const fill = document.getElementById("restFill");
      if (fill) fill.style.width = `${Math.min(100, (left / a.rest.total) * 100)}%`;
    }
  };

  /* ---------- Input ---------- */
  document.addEventListener("input", (e) => {
    const el = e.target;
    const d = doc();
    if (!d) return;
    if (el.classList.contains("set-input")) {
      const ex = exOf(el.dataset.ex), set = ex && setOf(ex, el.dataset.setId);
      if (!set) return;
      set[el.dataset.field] = el.value;
      if (d === S().active) TL.save();
    } else if (el.dataset.note) {
      const ex = exOf(el.dataset.note);
      if (!ex) return;
      ex.note = el.value;
      sizeNote(el);
      if (d === S().active) TL.save();
    } else if (el.dataset.docField) {
      const f = el.dataset.docField;
      if (f === "startLocal") {
        const t = new Date(el.value).getTime();
        if (Number.isFinite(t)) d.start = t;
      } else d[f] = el.value;
      if (el.tagName === "TEXTAREA") sizeNote(el);
      if (d === S().active) TL.save();
    }
  });

  document.addEventListener("focusin", (e) => {
    if (e.target.classList && e.target.classList.contains("set-input")) e.target.select();
  });

  // Enter hopper til næste felt.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || !e.target.classList || !e.target.classList.contains("set-input")) return;
    e.preventDefault();
    const inputs = [...document.querySelectorAll(".set-input")];
    const next = inputs[inputs.indexOf(e.target) + 1];
    if (next) next.focus(); else e.target.blur();
  });

  /* ---------- Gem rutine ---------- */
  function saveRoutineDoc(d) {
    const title = d.title.trim();
    if (!title) { TL.toast("Giv rutinen et navn"); return; }
    if (!d.exercises.length) { TL.toast("Tilføj mindst én øvelse"); return; }
    const routine = {
      id: d.id, title,
      exercises: d.exercises.map((ex) => ({
        uid: ex.uid, exId: ex.exId, note: ex.note, rest: ex.rest, superset: ex.superset,
        sets: ex.sets.map((s) => {
          const kg = TL.fromDisplay(TL.num(s.kg), d.unit);
          return { type: s.type, kg, reps: String(s.reps ?? "") };
        }),
      })),
    };
    const i = S().routines.findIndex((r) => r.id === d.id);
    if (i >= 0) S().routines[i] = routine; else S().routines.push(routine);
    TL.persist();
    routineDraft = null;
    TL.toast("Rutine gemt");
    TL.go("#/");
  }

  /* ---------- Gem redigering ---------- */
  function toWorkoutExercises(d, keep) {
    return d.exercises.map((ex) => {
      const type = TL.typeOf(ex.exId);
      return {
        exId: ex.exId, note: ex.note, rest: ex.rest, superset: ex.superset,
        sets: ex.sets.filter((s) => keep(s, type)).map((s) => parseSet(s, type, d.unit)),
      };
    }).filter((ex) => ex.sets.length);
  }

  function saveEdit(d) {
    const exercises = toWorkoutExercises(d, (s, type) => setIsComplete(s, type));
    if (!exercises.length) { TL.toast("Træningen har ingen udfyldte sæt"); return; }
    const mins = TL.num(d.durationMin);
    const workout = {
      id: d.editingId || d.id, title: d.title.trim() || "Træning", routineId: d.routineId, start: d.start,
      end: mins ? d.start + mins * 60000 : null, note: d.note, exercises,
    };
    if (d.imported && !mins) workout.imported = true;
    const i = S().workouts.findIndex((w) => w.id === workout.id);
    if (i >= 0) S().workouts[i] = workout; else S().workouts.push(workout);
    S().workouts.sort((a, b) => b.start - a.start);
    S().active = null;
    TL.persist();
    TL.toast("Træning gemt");
    TL.go(`#/traening/${workout.id}`, true);
  }

  /* ---------- Afslut live-træning ---------- */
  async function finishLive(d) {
    const pending = [];
    d.exercises.forEach((ex) => {
      const type = TL.typeOf(ex.exId);
      ex.sets.forEach((s) => { if (!s.done) pending.push({ ex, s, type }); });
    });
    const doneCount = d.exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0);
    const fillable = pending.filter(({ s, type, ex }) => {
      const test = { ...s };
      fillFromHints(test, type, prevFor(d, ex)[ex.sets.indexOf(s)], d.unit);
      return setIsComplete(test, type);
    });

    if (!doneCount && !fillable.length) {
      TL.toast("Ingen sæt er udfyldt endnu");
      return;
    }
    if (pending.length) {
      const typed = pending.filter(({ s, type }) => setIsComplete(s, type));
      const choice = await new Promise((resolve) => {
        TL.menu(`${pending.length} sæt er ikke markeret`, [
          fillable.length && { label: `Markér ${fillable.length} sæt som færdige`, hint: "Tomme felter får forrige tal eller rutinens mål", icon: "check", run: () => resolve("fill") },
          typed.length && typed.length < fillable.length && { label: `Medtag kun de ${typed.length} jeg har tastet`, icon: "edit", run: () => resolve("typed") },
          doneCount && { label: "Fjern alle umarkerede sæt", hint: `Gem kun de ${doneCount} færdige`, icon: "trash", run: () => resolve("drop") },
          { label: "Tilbage til træningen", icon: "back", run: () => resolve(null) },
        ]);
      });
      if (!choice) return;
      if (choice === "typed") typed.forEach(({ s }) => { s.done = true; });
      if (choice === "fill") {
        fillable.forEach(({ s, type, ex }) => {
          fillFromHints(s, type, prevFor(d, ex)[ex.sets.indexOf(s)], d.unit);
          s.done = true;
        });
      }
    }
    saveLive(d);
  }

  function saveLive(d) {
    const exercises = toWorkoutExercises(d, (s) => s.done);
    if (!exercises.length) { TL.toast("Der er ingen færdige sæt at gemme"); return; }
    const workout = {
      id: d.id, title: d.title.trim() || "Træning", routineId: d.routineId, start: d.start, end: Date.now(),
      note: d.note, exercises,
    };
    S().workouts.unshift(workout);
    S().workouts.sort((a, b) => b.start - a.start);
    const routine = d.routineId && S().routines.find((r) => r.id === d.routineId);
    const changed = routine && routineChanged(routine, workout);
    S().active = null;
    TL.persist();
    TL.releaseWakeLock();
    TL.go(`#/opsummering/${workout.id}`, true);
    if (changed) offerRoutineUpdate(routine, workout);
  }

  function routineChanged(routine, workout) {
    const shape = (list) => list.map((e) => `${e.exId}:${e.sets.map((s) => s.type).join("")}:${e.superset ?? ""}`).join("|");
    return shape(routine.exercises) !== shape(workout.exercises);
  }

  async function offerRoutineUpdate(routine, workout) {
    const yes = await TL.confirmDialog({
      title: `Opdatér "${routine.title}"?`,
      body: "Du ændrede øvelser eller sæt undervejs. Skal rutinen følge med til næste gang?",
      ok: "Opdatér", cancel: "Behold",
    });
    if (!yes) return;
    const oldByEx = new Map(routine.exercises.map((e) => [e.exId, e]));
    routine.exercises = workout.exercises.map((ex) => {
      const old = oldByEx.get(ex.exId);
      const def = TL.exercise(ex.exId);
      return {
        uid: uid(), exId: ex.exId, note: ex.note, rest: ex.rest ?? (old ? old.rest : null), superset: ex.superset,
        sets: ex.sets.map((s, i) => ({ type: s.type, kg: old?.sets[i]?.kg ?? null, reps: old?.sets[i]?.reps ?? def.reps })),
      };
    });
    TL.persist();
    TL.toast("Rutine opdateret");
  }

  Object.assign(TL, { startWorkout, startFromWorkout, editWorkout, logPast, editRoutine, rerender, stopRest });
})();
