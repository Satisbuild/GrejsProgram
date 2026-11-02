/* Profil: statistik, målinger, værktøjer, indstillinger og backup. */
var TL = (globalThis.TL = globalThis.TL || {});

(() => {
  const { esc, icon } = TL;
  const S = () => TL.state;
  const unit = () => S().settings.unit;

  /* ---------- Profil ---------- */
  const WEEK_METRICS = [["workouts", "Træninger"], ["minutes", "Tid"], ["volume", "Volumen"], ["sets", "Sæt"]];
  let weekMetric = "workouts";

  function weekFormat(metric) {
    if (metric === "minutes") return (v) => (v >= 60 ? `${TL.fmtNum(v / 60)} t` : `${TL.fmtNum(v, 0)} min`);
    if (metric === "volume") return (v) => TL.fmtVolume(v, unit());
    return (v) => TL.fmtNum(v, 0);
  }

  function topLifts() {
    const { records } = TL.computeRecords(S().workouts, TL.typeOf);
    const u = unit();
    const rows = Object.entries(records).filter(([, r]) => r.e1rm > 0).sort((a, b) => b[1].e1rm - a[1].e1rm).slice(0, 5);
    if (!rows.length) return "";
    return `
      <div class="section-head"><h2>Stærkeste løft</h2><small>Estimeret 1RM</small></div>
      <section class="card row-card">
        ${rows.map(([id, r]) => `
          <a class="value-row" href="#/ovelse/${esc(id)}"><span>${esc(TL.exercise(id).name)}</span><strong>${TL.fmtWeight(r.e1rm, u)} ${u}</strong></a>`).join("")}
      </section>`;
  }

  function muscleBars() {
    const rows = TL.muscleDistribution(S().workouts, TL.exercise, Date.now() - 30 * TL.DAY).filter((r) => r.muscle !== "andet" && r.muscle !== "cardio");
    if (!rows.length) return "";
    const max = rows[0].sets;
    return `
      <div class="section-head"><h2>Muskelfordeling</h2><small>Sæt, sidste 30 dage</small></div>
      <section class="card muscle-card">
        ${rows.map((r) => `
          <div class="muscle-row">
            <span>${esc(TL.MUSCLES[r.muscle])}</span>
            <div class="muscle-track"><div style="width:${Math.max(3, (r.sets / max) * 100)}%"></div></div>
            <strong>${TL.fmtNum(r.sets, 0)}</strong>
          </div>`).join("")}
      </section>`;
  }

  TL.views.profile = () => {
    const w = S().workouts;
    const totals = w.reduce((acc, x) => {
      const s = TL.workoutStats(x);
      acc.volume += s.volume; acc.time += s.duration || 0;
      return acc;
    }, { volume: 0, time: 0 });
    const weeks = TL.weeklySeries(w, 12);
    const rows = weeks.map((r) => ({
      label: `${r.week}`, tip: `Uge ${r.week}`, value: r[weekMetric],
    }));
    return {
      html: `
        ${TL.pageHead("Profil")}
        ${TL.statTiles([["Træninger", w.length], ["Volumen", TL.fmtVolume(totals.volume, unit())], ["Tid", `${Math.round(totals.time / 3600000)} t`], ["Uger i træk", TL.weekStreak(w)]])}
        <div class="section-head"><h2>Sidste 12 uger</h2></div>
        <section class="card chart-card">
          ${TL.segment("week-metric", WEEK_METRICS, weekMetric)}
          <div data-chart></div>
        </section>
        ${muscleBars()}
        ${topLifts()}
        <div class="section-head"><h2>Mere</h2></div>
        <section class="card row-card">
          <a class="link-row" href="#/maal">${icon("ruler")}<span>Målinger</span><span class="chev">${icon("right")}</span></a>
          <button type="button" class="link-row" data-act="open-plates">${icon("calc")}<span>Skiveberegner</span><span class="chev">${icon("right")}</span></button>
          <button type="button" class="link-row" data-act="open-1rm">${icon("medal")}<span>1RM-beregner</span><span class="chev">${icon("right")}</span></button>
          <a class="link-row" href="#/indstillinger">${icon("gear")}<span>Indstillinger og backup</span><span class="chev">${icon("right")}</span></a>
        </section>`,
      after(root) {
        const fmt = weekFormat(weekMetric);
        TL.mountChart(root.querySelector("[data-chart]"), { kind: "bar", rows, format: fmt, xEvery: 2, label: "Uger" });
      },
    };
  };
  TL.actions["week-metric"] = (el) => { weekMetric = el.dataset.v; TL.renderKeep(); };

  /* ---------- Målinger ---------- */
  const FIELDS = [
    ["weight", "Kropsvægt", "kg"], ["fat", "Fedtprocent", "%"], ["waist", "Talje", "cm"],
    ["chest", "Bryst", "cm"], ["arm", "Overarm", "cm"], ["thigh", "Lår", "cm"],
  ];
  let measureField = "weight";

  const fmtField = (field, v) => {
    if (field === "weight") return `${TL.fmtWeight(v, unit())} ${unit()}`;
    const f = FIELDS.find((x) => x[0] === field);
    return `${TL.fmtNum(v)} ${f[2]}`;
  };

  TL.views.measurements = () => {
    const list = [...S().measurements].sort((a, b) => b.date.localeCompare(a.date));
    const used = FIELDS.filter(([k]) => list.some((m) => m[k] !== null && m[k] !== undefined));
    const field = used.some(([k]) => k === measureField) ? measureField : used[0] ? used[0][0] : "weight";
    const rows = [...list].reverse().filter((m) => m[field] !== null && m[field] !== undefined).map((m) => {
      const ts = new Date(`${m.date}T12:00:00`).getTime();
      return { label: TL.fmtShort(ts), tip: TL.fmtDay(ts), value: field === "weight" ? TL.toDisplay(m[field], unit()) : m[field] };
    });
    return {
      hideTabs: true,
      html: `
        ${TL.subHead("Målinger", "#/profil", `<button type="button" class="icon-btn" data-act="measure-add" aria-label="Tilføj måling">${icon("plus")}</button>`)}
        ${list.length ? `
          <section class="card chart-card">
            ${used.length > 1 ? TL.segment("measure-field", used.map(([k, l]) => [k, l]), field) : `<h3 class="chart-title">${esc((FIELDS.find((x) => x[0] === field) || [])[1] || "")}</h3>`}
            <div data-chart></div>
          </section>
          <div class="section-head"><h2>Alle målinger</h2></div>
          <section class="card row-card">
            ${list.map((m) => {
              const values = FIELDS.filter(([k]) => m[k] !== null && m[k] !== undefined).map(([k]) => fmtField(k, m[k])).join(" · ");
              return `<button type="button" class="value-row" data-act="measure-edit" data-id="${esc(m.id)}"><span>${TL.fmtShort(new Date(`${m.date}T12:00:00`).getTime())}</span><strong>${esc(values)}</strong></button>`;
            }).join("")}
          </section>` : `<div class="empty"><span class="empty-icon">${icon("ruler")}</span><p>Log din kropsvægt og dine mål for at følge udviklingen.</p><button type="button" class="btn btn-primary" data-act="measure-add">Tilføj måling</button></div>`}`,
      after(root) {
        const el = root.querySelector("[data-chart]");
        if (el) {
          const f = FIELDS.find((x) => x[0] === field);
          TL.mountChart(el, { kind: "line", rows, format: (v) => `${TL.fmtNum(v)} ${field === "weight" ? unit() : f[2]}`, label: f[1] });
        }
      },
    };
  };

  async function measureForm(existing) {
    const display = (k) => {
      const v = existing ? existing[k] : null;
      if (v === null || v === undefined) return "";
      return String(Math.round((k === "weight" ? TL.toDisplay(v, unit()) : v) * 10) / 10).replace(".", ",");
    };
    const res = await TL.formDialog({
      title: existing ? "Redigér måling" : "Ny måling",
      fields: [
        { name: "date", label: "Dato", type: "date", value: existing ? existing.date : TL.isoDate(Date.now()) },
        ...FIELDS.map(([k, label, u]) => ({ name: k, label: `${label} (${k === "weight" ? unit() : u})`, inputmode: "decimal", value: display(k) })),
      ],
    });
    if (!res) return;
    const entry = existing || { id: TL.uid() };
    entry.date = res.date || TL.isoDate(Date.now());
    let any = false;
    for (const [k] of FIELDS) {
      const v = TL.num(res[k]);
      entry[k] = k === "weight" ? TL.fromDisplay(v, unit()) : v;
      if (v !== null) any = true;
    }
    if (!any) { TL.toast("Udfyld mindst ét felt"); return; }
    if (!existing) S().measurements.push(entry);
    TL.persist();
    TL.renderKeep();
  }

  Object.assign(TL.actions, {
    "measure-add"() { measureForm(null); },
    "measure-field"(el) { measureField = el.dataset.v; TL.renderKeep(); },
    "measure-edit"(el) {
      const m = S().measurements.find((x) => x.id === el.dataset.id);
      TL.menu(TL.fmtShort(new Date(`${m.date}T12:00:00`).getTime()), [
        { label: "Redigér", icon: "edit", run() { measureForm(m); } },
        { label: "Slet", icon: "trash", danger: true, run() {
          const i = S().measurements.indexOf(m);
          S().measurements.splice(i, 1);
          TL.persist(); TL.renderKeep();
          TL.toast("Måling slettet", { undo() { S().measurements.splice(i, 0, m); TL.persist(); TL.renderKeep(); } });
        } },
      ]);
    },
  });

  /* ---------- Værktøjer ---------- */
  function openPlateCalc(displayValue) {
    const st = S().settings, u = unit();
    const wrap = TL.openSheet(`
      <h2 class="sheet-title">Skiveberegner</h2>
      <div class="form-row">
        <label class="field"><span>Samlet vægt (${u})</span><input data-target inputmode="decimal" value="${displayValue ?? ""}" placeholder="100"></label>
        <label class="field"><span>Stang (${u})</span><input data-bar inputmode="decimal" value="${TL.fmtNum(TL.toDisplay(st.barKg, u)).replace(/\./g, "")}"></label>
      </div>
      <div class="plates" data-out></div>`, { label: "Skiveberegner", noFocus: true });
    const out = wrap.querySelector("[data-out]");
    const target = wrap.querySelector("[data-target]"), bar = wrap.querySelector("[data-bar]");
    const draw = () => {
      const t = TL.fromDisplay(TL.num(target.value), u), b = TL.fromDisplay(TL.num(bar.value), u) ?? st.barKg;
      if (!t) { out.innerHTML = `<p class="hint">Indtast en vægt for at se skiverne pr. side.</p>`; return; }
      const r = TL.platesPerSide(t, b, st.plates);
      if (r.invalid) { out.innerHTML = `<p class="hint">Vægten er lettere end stangen.</p>`; return; }
      out.innerHTML = r.plates.length
        ? `<small>Pr. side (kg-skiver)</small>
           <div class="plate-bar">${r.plates.map((p) => `<span class="plate" style="--h:${28 + (p / 25) * 56}px">${TL.fmtNum(p, 2)}</span>`).join("")}</div>
           ${r.rest ? `<p class="hint">${TL.fmtNum(r.rest, 2)} kg pr. side kan ikke rammes med dine skiver.</p>` : ""}`
        : `<p class="hint">Kun stangen.</p>`;
    };
    target.addEventListener("input", draw); bar.addEventListener("input", draw);
    draw();
    if (!displayValue) setTimeout(() => target.focus(), 60);
  }
  TL.openPlateCalc = openPlateCalc;

  function open1rm(presetOneRm) {
    const u = unit();
    const wrap = TL.openSheet(`
      <h2 class="sheet-title">1RM-beregner</h2>
      <div class="form-row">
        <label class="field"><span>Vægt (${u})</span><input data-w inputmode="decimal" placeholder="100" value="${presetOneRm ? Math.round(presetOneRm * 10) / 10 : ""}"></label>
        <label class="field"><span>Reps</span><input data-r inputmode="numeric" placeholder="5" value="${presetOneRm ? 1 : ""}"></label>
      </div>
      <div data-out></div>`, { label: "1RM-beregner", noFocus: true });
    const out = wrap.querySelector("[data-out]");
    const draw = () => {
      const w = TL.num(wrap.querySelector("[data-w]").value), r = TL.num(wrap.querySelector("[data-r]").value);
      if (!w || !r) { out.innerHTML = `<p class="hint">Indtast et sæt for at estimere din 1RM.</p>`; return; }
      const one = TL.e1rm(w, r);
      out.innerHTML = `
        <div class="onerm-hero"><small>Estimeret 1RM</small><strong>${TL.fmtNum(one)} ${u}</strong></div>
        <div class="onerm-table">
          ${[[95, 2], [90, 4], [85, 6], [80, 8], [75, 10], [70, 12], [65, 15], [60, 20]].map(([pct, reps]) => `
            <div><span>${pct} %</span><span>≈ ${reps} reps</span><strong>${TL.fmtNum(one * pct / 100)} ${u}</strong></div>`).join("")}
        </div>`;
    };
    wrap.querySelectorAll("input").forEach((i) => i.addEventListener("input", draw));
    draw();
  }

  Object.assign(TL.actions, {
    "open-plates"() { openPlateCalc(null); },
    "open-1rm"(el) { open1rm(TL.num(el.dataset.v)); },
  });

  /* ---------- Indstillinger ---------- */
  const toggle = (key, label, hint) => {
    const on = S().settings[key];
    return `
      <button type="button" class="setting-row" role="switch" aria-checked="${!!on}" data-act="set-toggle" data-key="${key}">
        <span>${esc(label)}${hint ? `<small>${esc(hint)}</small>` : ""}</span>
        <span class="switch${on ? " on" : ""}"><i></i></span>
      </button>`;
  };

  TL.views.settings = () => {
    const s = S().settings;
    const backup = s.lastBackup ? TL.fmtRelative(s.lastBackup).toLowerCase() : "aldrig";
    return {
      hideTabs: true,
      html: `
        ${TL.subHead("Indstillinger", "#/profil")}
        <div class="section-head"><h2>Generelt</h2></div>
        <section class="card row-card">
          <div class="setting-row static"><span>Vægtenhed</span>${TL.segment("set-unit", [["kg", "kg"], ["lb", "lb"]], s.unit)}</div>
          <div class="setting-row static"><span>Tema</span>${TL.segment("set-theme", [["auto", "Auto"], ["dark", "Mørk"], ["light", "Lys"]], s.theme)}</div>
        </section>
        <div class="section-head"><h2>Pausetimer</h2></div>
        <section class="card row-card">
          ${toggle("restAuto", "Start automatisk", "Når du markerer et sæt som færdigt")}
          <button type="button" class="setting-row" data-act="set-rest"><span>Standardpause</span><strong>${TL.fmtClock(s.restDefault)}</strong></button>
          ${toggle("sound", "Lyd når pausen er slut", "Kun mens appen er åben")}
          ${toggle("vibrate", "Vibration", "Virker ikke på iPhone")}
        </section>
        <div class="section-head"><h2>Under træning</h2></div>
        <section class="card row-card">
          ${toggle("keepAwake", "Hold skærmen tændt")}
        </section>
        <div class="section-head"><h2>Dine data</h2></div>
        <p class="hint">Alt ligger kun på denne enhed, i denne browser. Tag en backup jævnligt, og altid før du skifter telefon. Seneste backup: ${esc(backup)}.</p>
        <section class="card row-card">
          <button type="button" class="link-row" data-act="export-json">${icon("download")}<span>Tag backup (JSON)</span></button>
          <button type="button" class="link-row" data-act="import-json">${icon("upload")}<span>Gendan fra backup</span></button>
          <button type="button" class="link-row" data-act="export-csv">${icon("download")}<span>Eksportér til Excel (CSV)</span></button>
        </section>
        <input type="file" id="importFile" accept="application/json,.json" hidden>`,
      after(root) {
        root.querySelector("#importFile").addEventListener("change", importFile);
      },
    };
  };

  async function importFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    let data = null;
    try { data = JSON.parse(await file.text()); } catch { TL.toast("Filen kunne ikke læses"); return; }
    const problem = TL.validateImport(data);
    if (problem) { TL.toast(problem); return; }
    const ok = await TL.confirmDialog({
      title: "Gendan backup?",
      body: `Filen indeholder ${data.workouts.length} træninger. Det erstatter alt, der ligger i appen nu (${S().workouts.length} træninger).`,
      ok: "Erstat", danger: true,
    });
    if (!ok) return;
    TL.replaceState(data);
    TL.applyTheme();
    TL.toast("Backup gendannet");
    TL.go("#/");
  }

  Object.assign(TL.actions, {
    "set-toggle"(el) {
      const k = el.dataset.key;
      S().settings[k] = !S().settings[k];
      TL.persist(); TL.renderKeep();
      if (k === "sound" && S().settings.sound) { TL.unlockAudio(); TL.beep(); }
      if (k === "keepAwake") { if (S().settings.keepAwake) TL.acquireWakeLock(); else TL.releaseWakeLock(); }
    },
    "set-unit"(el) { S().settings.unit = el.dataset.v; TL.persist(); TL.renderKeep(); },
    "set-theme"(el) { S().settings.theme = el.dataset.v; TL.persist(); TL.applyTheme(); TL.renderKeep(); },
    "set-rest"() {
      TL.menu("Standardpause", [30, 45, 60, 75, 90, 120, 150, 180, 240, 300].map((sec) => ({
        label: TL.fmtClock(sec), hint: S().settings.restDefault === sec ? "Valgt" : "",
        run() { S().settings.restDefault = sec; TL.persist(); TL.renderKeep(); },
      })));
    },
    "export-json"() {
      TL.download(`traeningslog-${TL.isoDate(Date.now())}.json`, TL.exportJson(), "application/json");
      S().settings.lastBackup = Date.now();
      TL.persist(); TL.renderKeep();
    },
    "import-json"() { document.getElementById("importFile").click(); },
    "export-csv"() {
      // BOM får Excel til at læse æ, ø og å rigtigt.
      TL.download(`traeningslog-${TL.isoDate(Date.now())}.csv`, `﻿${TL.workoutsToCsv(S().workouts, (id) => TL.exercise(id).name)}`, "text/csv;charset=utf-8");
    },
  });
})();
