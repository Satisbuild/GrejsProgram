/* Forside (rutiner), historik, træningsdetaljer og opsummering. */
var TL = (globalThis.TL = globalThis.TL || {});

(() => {
  const { esc, icon } = TL;
  const S = () => TL.state;
  const unit = () => S().settings.unit;
  const prsFor = () => TL.computeRecords(S().workouts, TL.typeOf).prs;

  const pageHead = (title, right = "") => `<header class="page-head"><h1>${esc(title)}</h1>${right}</header>`;
  const subHead = (title, backHash, right = "") => `
    <header class="topbar">
      ${backHash ? `<a class="icon-btn" href="${esc(backHash)}" aria-label="Tilbage">${icon("back")}</a>` : `<button type="button" class="icon-btn" data-act="go-back" aria-label="Tilbage">${icon("back")}</button>`}
      <h1 class="topbar-title">${esc(title)}</h1>
      ${right || '<span class="icon-btn-spacer"></span>'}
    </header>`;
  Object.assign(TL, { pageHead, subHead });

  /* ---------- Forside ---------- */
  function nextRoutineId() {
    const routines = S().routines;
    if (!routines.length) return null;
    const last = S().workouts.find((w) => w.routineId && routines.some((r) => r.id === w.routineId));
    if (!last) return routines[0].id;
    const i = routines.findIndex((r) => r.id === last.routineId);
    return routines[(i + 1) % routines.length].id;
  }

  function weekStrip() {
    const now = Date.now();
    const start = TL.startOfWeek(now);
    const done = new Set(S().workouts.map((w) => TL.startOfDay(w.start)));
    const days = ["M", "T", "O", "T", "F", "L", "S"].map((name, i) => {
      const day = TL.addDays(start, i);
      const isToday = day === TL.startOfDay(now);
      return `<div class="week-day${done.has(day) ? " hit" : ""}${isToday ? " today" : ""}"><small>${name}</small><span>${done.has(day) ? icon("check") : new Date(day).getDate()}</span></div>`;
    }).join("");
    const count = S().workouts.filter((w) => w.start >= start).length;
    const streak = TL.weekStreak(S().workouts, now);
    return `
      <section class="card week-card">
        <div class="week-top">
          <strong>Uge ${TL.weekNumber(now)}</strong>
          <span>${count} ${count === 1 ? "træning" : "træninger"}${streak > 1 ? ` · ${streak} uger i træk` : ""}</span>
        </div>
        <div class="week-days">${days}</div>
      </section>`;
  }

  function routineCard(r, nextId) {
    const last = S().workouts.find((w) => w.routineId === r.id);
    const names = r.exercises.map((e) => TL.exercise(e.exId).name).join(", ");
    return `
      <article class="card routine-card">
        <div class="routine-top">
          <button type="button" class="routine-title" data-act="routine-open" data-id="${esc(r.id)}">
            <strong>${esc(r.title)}</strong>
            ${r.id === nextId ? '<span class="tag">Næste</span>' : ""}
          </button>
          <button type="button" class="icon-btn" data-act="routine-menu" data-id="${esc(r.id)}" aria-label="Flere valg for ${esc(r.title)}">${icon("dots")}</button>
        </div>
        <p class="routine-list">${esc(names) || "Ingen øvelser"}</p>
        <div class="routine-foot">
          <small>${r.exercises.length} øvelser${last ? ` · ${TL.fmtRelative(last.start).toLowerCase()}` : ""}</small>
          <button type="button" class="btn btn-primary btn-sm" data-act="routine-start" data-id="${esc(r.id)}">Start</button>
        </div>
      </article>`;
  }

  TL.views.home = () => {
    const routines = S().routines;
    const nextId = nextRoutineId();
    return { html: `
      ${pageHead("Træning")}
      ${weekStrip()}
      <button type="button" class="btn btn-soft btn-wide btn-lg" data-act="start-empty">${icon("plus")} Start tom træning</button>
      <div class="section-head">
        <h2>Rutiner</h2>
        <button type="button" class="btn-link" data-act="routine-new">${icon("plus")} Ny rutine</button>
      </div>
      ${routines.map((r) => routineCard(r, nextId)).join("") || `<div class="empty"><span class="empty-icon">${icon("list")}</span><p>Lav din første rutine for at komme hurtigt i gang.</p></div>`}
    ` };
  };

  const routineById = (id) => S().routines.find((r) => r.id === id);

  TL.removeRoutine = (id) => {
    const i = S().routines.findIndex((r) => r.id === id);
    if (i >= 0) S().routines.splice(i, 1);
    TL.persist();
  };

  Object.assign(TL.actions, {
    "start-empty"() { TL.unlockAudio(); TL.startWorkout(null); },
    "routine-start"(el) { TL.unlockAudio(); TL.startWorkout(routineById(el.dataset.id)); },
    "routine-open"(el) { TL.editRoutine(routineById(el.dataset.id)); },
    "routine-new"() { TL.editRoutine({ id: TL.uid(), title: "", exercises: [], isNew: true }); },
    "routine-menu"(el) {
      const r = routineById(el.dataset.id);
      const i = S().routines.indexOf(r);
      const list = S().routines;
      const shift = (delta) => () => { list.splice(i, 1); list.splice(i + delta, 0, r); TL.persist(); TL.render(); };
      TL.menu(r.title, [
        { label: "Redigér", icon: "edit", run() { TL.editRoutine(r); } },
        { label: "Duplikér", icon: "copy", run() {
          const copy = JSON.parse(JSON.stringify(r));
          copy.id = TL.uid(); copy.title = `${r.title} (kopi)`;
          list.splice(i + 1, 0, copy);
          TL.persist(); TL.render();
        } },
        i > 0 && { label: "Flyt op", icon: "up", run: shift(-1) },
        i < list.length - 1 && { label: "Flyt ned", icon: "down", run: shift(1) },
        { label: "Slet", icon: "trash", danger: true, run() {
          list.splice(i, 1);
          TL.persist(); TL.render();
          TL.toast("Rutine slettet", { undo() { list.splice(i, 0, r); TL.persist(); TL.render(); } });
        } },
      ]);
    },
  });

  /* ---------- Træningskort ---------- */
  const statLine = (w) => {
    const s = TL.workoutStats(w);
    return [s.duration !== null ? TL.fmtDuration(s.duration) : null, s.volume ? TL.fmtVolume(s.volume, unit()) : null, `${s.sets} sæt`].filter(Boolean).join(" · ");
  };

  function bestSetText(ex) {
    const type = TL.typeOf(ex.exId);
    const work = ex.sets.filter(TL.isWorking);
    const list = work.length ? work : ex.sets;
    if (type === "wr" || type === "bwx") {
      const best = [...list].sort((a, b) => TL.e1rm(b.kg, b.reps) - TL.e1rm(a.kg, a.reps) || (b.reps || 0) - (a.reps || 0))[0];
      return best ? setText(best, type) : "";
    }
    if (type === "bw") return `${Math.max(...list.map((s) => s.reps || 0))} reps`;
    const best = [...list].sort((a, b) => (b.km || 0) - (a.km || 0) || (b.secs || 0) - (a.secs || 0))[0];
    return best ? setText(best, type) : "";
  }

  function setText(s, type) {
    if (type === "wr") return `${TL.fmtWeight(s.kg, unit())} ${unit()} × ${s.reps ?? "–"}`;
    if (type === "bwx") return s.kg ? `+${TL.fmtWeight(s.kg, unit())} ${unit()} × ${s.reps ?? "–"}` : `${s.reps ?? "–"} reps`;
    if (type === "bw") return `${s.reps ?? "–"} reps`;
    if (type === "time") return TL.fmtClock(s.secs);
    return [s.km ? `${TL.fmtNum(s.km)} km` : "", s.secs ? TL.fmtClock(s.secs) : ""].filter(Boolean).join(" · ");
  }
  TL.setText = setText;

  function workoutCard(w, prs) {
    const prCount = (prs[w.id] || []).length;
    return `
      <a class="card workout-card" href="#/traening/${esc(w.id)}">
        <div class="workout-top">
          <strong>${esc(w.title)}</strong>
          ${prCount ? `<span class="tag tag-pr">${icon("trophy")} ${prCount} PR</span>` : ""}
        </div>
        <small>${TL.fmtDay(w.start)} · ${statLine(w)}</small>
        <ul class="workout-sum">
          ${w.exercises.slice(0, 4).map((ex) => `
            <li><span>${ex.sets.length} × ${esc(TL.exercise(ex.exId).name)}</span><span class="dim">${esc(bestSetText(ex))}</span></li>`).join("")}
          ${w.exercises.length > 4 ? `<li class="dim">+ ${w.exercises.length - 4} flere øvelser</li>` : ""}
        </ul>
      </a>`;
  }

  /* ---------- Historik ---------- */
  let calMonth = null;
  let listLimit = 30;

  function calendar() {
    const first = new Date(calMonth);
    const y = first.getFullYear(), m = first.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7;
    const byDay = {};
    S().workouts.forEach((w) => { (byDay[TL.startOfDay(w.start)] = byDay[TL.startOfDay(w.start)] || []).push(w); });
    const today = TL.startOfDay(Date.now());
    let count = 0, cells = "";
    for (let i = 0; i < offset; i++) cells += "<span></span>";
    for (let d = 1; d <= days; d++) {
      const ts = new Date(y, m, d).getTime();
      const hits = byDay[ts];
      if (hits) count += hits.length;
      cells += hits
        ? `<button type="button" class="cal-day hit${ts === today ? " today" : ""}" data-act="cal-day" data-ts="${ts}" aria-label="${d}. ${hits.length} træning">${d}</button>`
        : `<span class="cal-day${ts === today ? " today" : ""}">${d}</span>`;
    }
    const canNext = new Date(y, m + 1, 1).getTime() <= Date.now();
    return `
      <section class="card cal-card">
        <div class="cal-head">
          <button type="button" class="icon-btn" data-act="cal-move" data-d="-1" aria-label="Forrige måned">${icon("back")}</button>
          <div><strong>${TL.fmtMonth(calMonth)}</strong><small>${count} ${count === 1 ? "træning" : "træninger"}</small></div>
          <button type="button" class="icon-btn" data-act="cal-move" data-d="1" ${canNext ? "" : "disabled"} aria-label="Næste måned">${icon("right")}</button>
        </div>
        <div class="cal-grid cal-names">${["M", "T", "O", "T", "F", "L", "S"].map((n) => `<small>${n}</small>`).join("")}</div>
        <div class="cal-grid">${cells}</div>
      </section>`;
  }

  TL.views.history = () => {
    if (calMonth === null) { const d = new Date(); calMonth = new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }
    const prs = prsFor();
    const all = S().workouts;
    let lastMonth = "";
    const rows = all.slice(0, listLimit).map((w) => {
      const month = TL.fmtMonth(w.start);
      const head = month !== lastMonth ? `<h2 class="month-head">${esc(month)}</h2>` : "";
      lastMonth = month;
      return head + workoutCard(w, prs);
    }).join("");
    return { html: `
      ${pageHead("Historik", `<button type="button" class="btn-link" data-act="log-past">${icon("plus")} Tilføj</button>`)}
      ${calendar()}
      ${rows || `<div class="empty"><span class="empty-icon">${icon("history")}</span><p>Her kommer dine træninger, når du har gennemført den første.</p></div>`}
      ${all.length > listLimit ? `<button type="button" class="btn btn-soft btn-wide" data-act="more-history">Vis flere</button>` : ""}
    ` };
  };

  Object.assign(TL.actions, {
    "log-past"() { TL.logPast(); },
    "more-history"() { listLimit += 30; TL.renderKeep(); },
    "cal-move"(el) {
      const d = new Date(calMonth);
      calMonth = new Date(d.getFullYear(), d.getMonth() + +el.dataset.d, 1).getTime();
      TL.renderKeep();
    },
    "cal-day"(el) {
      const ts = +el.dataset.ts;
      const hits = S().workouts.filter((w) => TL.startOfDay(w.start) === ts);
      if (hits.length === 1) { TL.go(`#/traening/${hits[0].id}`); return; }
      TL.menu(TL.fmtDay(ts), hits.map((w) => ({ label: w.title, hint: statLine(w), run() { TL.go(`#/traening/${w.id}`); } })));
    },
  });

  /* ---------- Træningsdetaljer ---------- */
  const workoutById = (id) => S().workouts.find((w) => w.id === id);

  function exerciseBlocks(w, prList) {
    const prBySet = new Map(prList.map((p) => [`${p.exId}#${p.setIndex}`, p.kinds]));
    return w.exercises.map((ex) => {
      const def = TL.exercise(ex.exId);
      const labels = TL.setLabels(ex.sets);
      return `
        <section class="card detail-ex">
          <header class="ex-head">
            <span class="avatar">${TL.eqIcon(def.equipment)}</span>
            <a class="ex-name" href="#/ovelse/${esc(ex.exId)}">${esc(def.name)}</a>
          </header>
          ${ex.note ? `<p class="ex-note-text">${esc(ex.note)}</p>` : ""}
          <div class="detail-sets">
            ${ex.sets.map((s, i) => {
              const kinds = prBySet.get(`${ex.exId}#${i}`);
              return `
                <div class="detail-set">
                  <span class="set-label static type-${s.type}">${esc(labels[i])}</span>
                  <span class="detail-val">${esc(setText(s, def.type))}</span>
                  ${kinds ? `<span class="tag tag-pr">${icon("trophy")} ${esc(TL.PR_LABELS[kinds[0]])}</span>` : ""}
                </div>`;
            }).join("")}
          </div>
        </section>`;
    }).join("");
  }

  const statTiles = (tiles) => `<div class="stat-tiles">${tiles.map(([k, v]) => `<div class="stat-tile"><small>${esc(k)}</small><strong>${esc(v)}</strong></div>`).join("")}</div>`;
  TL.statTiles = statTiles;

  TL.views.workout = (id) => {
    const w = workoutById(id);
    if (!w) return { html: `${subHead("Træning", "#/historik")}<div class="empty"><p>Træningen findes ikke længere.</p></div>`, hideTabs: true };
    const s = TL.workoutStats(w);
    const prList = prsFor()[w.id] || [];
    return { hideTabs: true, html: `
      ${subHead("Træning", "#/historik", `<button type="button" class="icon-btn" data-act="workout-menu" data-id="${esc(w.id)}" aria-label="Flere valg">${icon("dots")}</button>`)}
      <div class="detail-head">
        <h2>${esc(w.title)}</h2>
        <small>${TL.fmtDay(w.start)}${w.imported ? "" : ` kl. ${TL.fmtTime(w.start)}`}</small>
      </div>
      ${statTiles([["Tid", s.duration !== null ? TL.fmtDuration(s.duration) : "–"], ["Volumen", TL.fmtVolume(s.volume, unit())], ["Sæt", s.sets], ["PR", prList.length]])}
      ${w.note ? `<p class="workout-note-text">${esc(w.note)}</p>` : ""}
      ${w.imported ? `<p class="hint">Hentet fra den gamle version af appen, derfor mangler tiden.</p>` : ""}
      ${exerciseBlocks(w, prList)}
      <button type="button" class="btn btn-primary btn-wide" data-act="workout-repeat" data-id="${esc(w.id)}">Gentag træning</button>
    ` };
  };

  function workoutAsText(w) {
    const lines = [`${w.title} – ${TL.fmtDay(w.start)}`, statLine(w), ""];
    w.exercises.forEach((ex) => {
      const def = TL.exercise(ex.exId), labels = TL.setLabels(ex.sets);
      lines.push(def.name);
      ex.sets.forEach((s, i) => lines.push(`  ${labels[i]}: ${setText(s, def.type)}`));
    });
    return lines.join("\n");
  }

  function saveAsRoutine(w) {
    TL.formDialog({ title: "Gem som rutine", ok: "Gem", fields: [{ name: "title", label: "Navn", value: w.title }] }).then((res) => {
      if (!res) return;
      S().routines.push({
        id: TL.uid(), title: res.title.trim() || w.title,
        exercises: w.exercises.map((ex) => ({
          uid: TL.uid(), exId: ex.exId, note: ex.note || "", rest: ex.rest ?? null, superset: ex.superset ?? null,
          sets: ex.sets.map((s) => ({ type: s.type, kg: null, reps: TL.exercise(ex.exId).reps })),
        })),
      });
      TL.persist();
      TL.toast("Rutine oprettet");
    });
  }

  Object.assign(TL.actions, {
    "workout-repeat"(el) { TL.unlockAudio(); TL.startFromWorkout(workoutById(el.dataset.id)); },
    "workout-menu"(el) {
      const w = workoutById(el.dataset.id);
      TL.menu(w.title, [
        { label: "Redigér", icon: "edit", run() { TL.editWorkout(w); } },
        { label: "Gem som rutine", icon: "list", run() { saveAsRoutine(w); } },
        { label: "Kopiér som tekst", icon: "copy", async run() {
          try { await navigator.clipboard.writeText(workoutAsText(w)); TL.toast("Kopieret"); }
          catch { TL.toast("Kunne ikke kopiere"); }
        } },
        { label: "Slet", icon: "trash", danger: true, run() {
          const i = S().workouts.indexOf(w);
          S().workouts.splice(i, 1);
          TL.persist();
          TL.go("#/historik");
          // Vises efter skiftet, så det ikke ryger med sheet-oprydningen.
          setTimeout(() => TL.toast("Træning slettet", { undo() {
            S().workouts.splice(i, 0, w); TL.persist(); TL.render();
          } }), 50);
        } },
      ]);
    },
  });

  /* ---------- Opsummering efter træning ---------- */
  TL.views.summary = (id) => {
    const w = workoutById(id);
    if (!w) { TL.go("#/", true); return { html: "" }; }
    const s = TL.workoutStats(w);
    const prList = prsFor()[w.id] || [];
    const rank = [...S().workouts].sort((a, b) => a.start - b.start).indexOf(w) + 1;
    return { hideTabs: true, html: `
      <div class="summary">
        <div class="summary-hero">
          <span class="summary-badge">${icon("check")}</span>
          <h1>Godt arbejde!</h1>
          <p>Det var din træning nr. ${rank}</p>
        </div>
        <h2 class="summary-title">${esc(w.title)}</h2>
        ${statTiles([["Tid", s.duration !== null ? TL.fmtDuration(s.duration) : "–"], ["Volumen", TL.fmtVolume(s.volume, unit())], ["Sæt", s.sets], ["PR", prList.length]])}
        ${prList.length ? `
          <section class="card pr-list">
            <h3>${icon("trophy")} Nye rekorder</h3>
            ${prList.map((p) => {
              const ex = w.exercises.find((e) => e.exId === p.exId);
              return `<div class="pr-row"><span>${esc(TL.exercise(p.exId).name)}<small>${esc(TL.PR_LABELS[p.kinds[0]])}</small></span><strong>${esc(setText(ex.sets[p.setIndex], TL.typeOf(p.exId)))}</strong></div>`;
            }).join("")}
          </section>` : ""}
        <section class="card summary-list">
          ${w.exercises.map((ex) => `<div class="pr-row"><span>${ex.sets.length} × ${esc(TL.exercise(ex.exId).name)}</span><strong class="dim">${esc(bestSetText(ex))}</strong></div>`).join("")}
        </section>
        <a class="btn btn-primary btn-wide btn-lg" href="#/">Færdig</a>
        <a class="btn btn-soft btn-wide" href="#/traening/${esc(w.id)}">Se hele træningen</a>
      </div>
    ` };
  };
})();
