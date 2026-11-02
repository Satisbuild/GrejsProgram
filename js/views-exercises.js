/* Øvelsesbibliotek, øvelsesvælger og øvelsesdetaljer med grafer og rekorder. */
var TL = (globalThis.TL = globalThis.TL || {});

(() => {
  const { esc, icon } = TL;
  const S = () => TL.state;
  const unit = () => S().settings.unit;

  const fold = (s) => s.toLowerCase().normalize("NFKD");

  function filterExercises({ q = "", muscle = "", equipment = "" }) {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    return TL.allExercises()
      .filter((e) => !muscle || e.muscle === muscle || (e.secondary || []).includes(muscle))
      .filter((e) => !equipment || e.equipment === equipment)
      .filter((e) => {
        const hay = fold(`${e.name} ${TL.MUSCLES[e.muscle] || ""} ${TL.EQUIPMENT[e.equipment] || ""}`);
        return terms.every((t) => hay.includes(t));
      })
      .sort((a, b) => a.name.localeCompare(b.name, "da"));
  }

  function recentIds(limit = 8) {
    const out = [];
    for (const w of S().workouts) {
      for (const ex of w.exercises) if (!out.includes(ex.exId)) out.push(ex.exId);
      if (out.length >= limit) break;
    }
    return out.slice(0, limit);
  }

  function row(e, mode, selected) {
    const meta = `${TL.MUSCLES[e.muscle] || "Andet"} · ${TL.EQUIPMENT[e.equipment] || "Andet"}`;
    const inner = `
      <span class="avatar">${TL.eqIcon(e.equipment)}</span>
      <span class="ex-row-text"><strong>${esc(e.name)}</strong><small>${esc(meta)}${e.custom ? " · Egen" : ""}</small></span>`;
    if (mode === "link") return `<a class="ex-row" href="#/ovelse/${esc(e.id)}">${inner}<span class="chev">${icon("right")}</span></a>`;
    return `<button type="button" class="ex-row${selected ? " selected" : ""}" data-pick="${esc(e.id)}" aria-pressed="${!!selected}">${inner}<span class="pick-mark">${icon("check")}</span></button>`;
  }

  function filterBar(f) {
    return `
      <div class="search-box">${icon("search")}<input type="search" data-filter="q" value="${esc(f.q)}" placeholder="Søg i øvelser" aria-label="Søg i øvelser" autocomplete="off"></div>
      <div class="filter-row">
        <select data-filter="muscle" aria-label="Muskelgruppe">
          <option value="">Alle muskler</option>
          ${Object.entries(TL.MUSCLES).map(([k, v]) => `<option value="${k}"${f.muscle === k ? " selected" : ""}>${v}</option>`).join("")}
        </select>
        <select data-filter="equipment" aria-label="Udstyr">
          <option value="">Alt udstyr</option>
          ${Object.entries(TL.EQUIPMENT).map(([k, v]) => `<option value="${k}"${f.equipment === k ? " selected" : ""}>${v}</option>`).join("")}
        </select>
      </div>`;
  }

  function listHtml(f, mode, selected = new Set()) {
    const list = filterExercises(f);
    if (!list.length) return `<div class="empty"><p>Ingen øvelser matcher.</p><button type="button" class="btn btn-soft" data-act="custom-new" data-name="${esc(f.q)}">Opret "${esc(f.q) || "ny øvelse"}"</button></div>`;
    const isFiltered = f.q || f.muscle || f.equipment;
    let html = "";
    if (!isFiltered) {
      const recents = recentIds().map((id) => TL.exercise(id)).filter((e) => !e.missing);
      if (recents.length) html += `<h3 class="list-head">Seneste</h3>${recents.map((e) => row(e, mode, selected.has(e.id))).join("")}<h3 class="list-head">Alle øvelser</h3>`;
    }
    return html + list.map((e) => row(e, mode, selected.has(e.id))).join("");
  }

  /* ---------- Biblioteket som fane ---------- */
  const libFilter = { q: "", muscle: "", equipment: "" };

  function bindFilters(root, f, redraw) {
    root.querySelectorAll("[data-filter]").forEach((el) => {
      el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => { f[el.dataset.filter] = el.value; redraw(); });
    });
  }

  TL.views.exercises = () => ({
    html: `
      ${TL.pageHead("Øvelser", `<button type="button" class="btn-link" data-act="custom-new">${icon("plus")} Egen øvelse</button>`)}
      <div class="sticky-filter">${filterBar(libFilter)}</div>
      <div id="exList" class="ex-list">${listHtml(libFilter, "link")}</div>`,
    after(root) {
      bindFilters(root, libFilter, () => { root.querySelector("#exList").innerHTML = listHtml(libFilter, "link"); });
    },
  });

  /* ---------- Vælger ---------- */
  function openPicker({ title, multi = false, onPick }) {
    const f = { q: "", muscle: "", equipment: "" };
    const selected = new Set();
    const wrap = TL.openSheet(`
      <div class="picker-head">
        <h2 class="sheet-title">${esc(title)}</h2>
        <button type="button" class="btn-link" data-act="custom-new">${icon("plus")} Egen</button>
      </div>
      ${filterBar(f)}
      <div class="picker-list ex-list"></div>
      ${multi ? `<div class="picker-foot"><button type="button" class="btn btn-primary btn-wide" data-confirm disabled>Vælg øvelser</button></div>` : ""}
    `, { tall: true, label: title, noFocus: true });
    const list = wrap.querySelector(".picker-list");
    const confirmBtn = wrap.querySelector("[data-confirm]");
    const draw = () => {
      const top = list.scrollTop;
      list.innerHTML = listHtml(f, "pick", selected);
      list.scrollTop = top;
      if (confirmBtn) {
        confirmBtn.disabled = !selected.size;
        confirmBtn.textContent = selected.size ? `Tilføj ${selected.size} ${selected.size === 1 ? "øvelse" : "øvelser"}` : "Vælg øvelser";
      }
    };
    draw();
    bindFilters(wrap, f, () => { list.scrollTop = 0; draw(); });
    pickerRefresh = draw;
    list.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-pick]");
      if (!btn) return;
      const id = btn.dataset.pick;
      if (!multi) { TL.closeSheet(); onPick([id]); return; }
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      draw();
    });
    if (confirmBtn) confirmBtn.onclick = () => { TL.closeSheet(); onPick([...selected]); };
  }
  let pickerRefresh = null;
  TL.openPicker = openPicker;

  /* ---------- Egne øvelser ---------- */
  async function customForm(existing, presetName) {
    const res = await TL.formDialog({
      title: existing ? "Redigér øvelse" : "Ny øvelse",
      fields: [
        { name: "name", label: "Navn", value: existing ? existing.name : presetName || "" },
        { name: "muscle", label: "Primær muskel", type: "select", value: existing ? existing.muscle : "bryst", options: Object.entries(TL.MUSCLES) },
        { name: "equipment", label: "Udstyr", type: "select", value: existing ? existing.equipment : "stang", options: Object.entries(TL.EQUIPMENT) },
        // Typen kan ikke ændres bagefter: gamle sæt ville miste deres mening.
        ...(existing ? [] : [{ name: "type", label: "Hvad logger du?", type: "select", value: "wr", options: Object.entries(TL.TYPES).map(([k, v]) => [k, v.label]) }]),
        { name: "reps", label: "Standard reps (valgfrit)", value: existing ? existing.reps : "", placeholder: "8-12" },
      ],
    });
    if (!res) return null;
    const name = res.name.trim();
    if (!name) { TL.toast("Øvelsen skal have et navn"); return null; }
    if (existing) {
      Object.assign(existing, { name, muscle: res.muscle, equipment: res.equipment, reps: res.reps.trim() });
      TL.persist();
      return existing;
    }
    if (TL.allExercises().some((e) => e.name.toLowerCase() === name.toLowerCase())) {
      TL.toast("Der findes allerede en øvelse med det navn");
      return null;
    }
    const custom = { id: `c-${TL.uid()}`, name, muscle: res.muscle, equipment: res.equipment, type: res.type, reps: res.reps.trim(), secondary: [], custom: true };
    S().customExercises.push(custom);
    TL.persist();
    return custom;
  }

  TL.actions["custom-new"] = async (el) => {
    const made = await customForm(null, el.dataset.name);
    if (!made) return;
    TL.toast("Øvelse oprettet");
    if (document.querySelector(".picker-list") && pickerRefresh) pickerRefresh();
    else TL.renderKeep();
  };

  /* ---------- Øvelsesdetaljer ---------- */
  const METRICS = {
    wr: [["kg", "Tungeste"], ["e1rm", "Est. 1RM"], ["volume", "Volumen"]],
    bwx: [["reps", "Reps"], ["kg", "Ekstra vægt"], ["e1rm", "Est. 1RM"]],
    bw: [["reps", "Reps"]],
    time: [["secs", "Tid"]],
    cardio: [["km", "Distance"], ["secs", "Tid"]],
  };
  const RANGES = [["90", "3 mdr"], ["365", "1 år"], ["0", "Alt"]];
  const detailState = { metric: {}, range: "365", tab: "overview" };

  function metricFormat(metric) {
    const u = unit();
    if (metric === "kg" || metric === "e1rm") return (v) => `${TL.fmtWeight(v, u)} ${u}`;
    if (metric === "volume") return (v) => TL.fmtVolume(v, u);
    if (metric === "reps") return (v) => `${TL.fmtNum(v, 0)} reps`;
    if (metric === "secs") return (v) => TL.fmtClock(v);
    return (v) => `${TL.fmtNum(v)} km`;
  }

  function recordTiles(rec, type) {
    if (!rec) return "";
    const u = unit();
    const rows = {
      wr: [["Tungeste vægt", `${TL.fmtWeight(rec.kg, u)} ${u}`], ["Bedste 1RM", `${TL.fmtWeight(rec.e1rm, u)} ${u}`], ["Bedste sæt", TL.fmtVolume(rec.volume, u)]],
      bwx: [["Flest reps", rec.reps ? String(rec.reps) : "–"], ["Mest ekstra vægt", rec.kg ? `${TL.fmtWeight(rec.kg, u)} ${u}` : "–"], ["Bedste 1RM", rec.e1rm ? `${TL.fmtWeight(rec.e1rm, u)} ${u}` : "–"]],
      bw: [["Flest reps", String(rec.reps)]],
      time: [["Længste tid", TL.fmtClock(rec.secs)]],
      cardio: [["Længste distance", `${TL.fmtNum(rec.km)} km`], ["Længste tid", TL.fmtClock(rec.secs)]],
    }[type];
    return `<div class="section-head"><h2>Rekorder</h2></div>${TL.statTiles(rows)}`;
  }

  const seg = (act, options, value) => `
    <div class="segment" role="group">
      ${options.map(([v, l]) => `<button type="button" data-act="${act}" data-v="${esc(v)}" class="${v === value ? "on" : ""}" aria-pressed="${v === value}">${esc(l)}</button>`).join("")}
    </div>`;
  TL.segment = seg;

  TL.views.exercise = (id) => {
    const def = TL.exercise(id);
    const type = def.type;
    const workouts = S().workouts;
    const { records } = TL.computeRecords(workouts, TL.typeOf);
    const series = TL.exerciseSeries(workouts, id, type);
    const metrics = METRICS[type];
    const metric = detailState.metric[id] && metrics.some((m) => m[0] === detailState.metric[id]) ? detailState.metric[id] : metrics[0][0];
    const since = +detailState.range ? Date.now() - +detailState.range * TL.DAY : 0;
    const rows = series.filter((r) => r.start >= since && r[metric]).map((r) => ({
      label: TL.fmtShort(r.start), tip: TL.fmtDay(r.start), value: r[metric],
    }));

    const history = workouts.filter((w) => w.exercises.some((e) => e.exId === id));
    const historyHtml = history.map((w) => {
      const ex = w.exercises.find((e) => e.exId === id);
      const labels = TL.setLabels(ex.sets);
      return `
        <a class="card history-ex" href="#/traening/${esc(w.id)}">
          <strong>${esc(w.title)}</strong><small>${TL.fmtDay(w.start)}</small>
          <div class="detail-sets">
            ${ex.sets.map((s, i) => `<div class="detail-set"><span class="set-label static type-${s.type}">${esc(labels[i])}</span><span class="detail-val">${esc(TL.setText(s, type))}</span></div>`).join("")}
          </div>
        </a>`;
    }).join("");

    const meta = [TL.MUSCLES[def.muscle], TL.EQUIPMENT[def.equipment]].filter(Boolean).join(" · ");
    const secondary = (def.secondary || []).map((m) => TL.MUSCLES[m]).join(", ");
    const tab = detailState.tab;
    const u = unit();

    return {
      hideTabs: true,
      html: `
        ${TL.subHead("Øvelse", null, def.custom ? `<button type="button" class="icon-btn" data-act="custom-menu" data-id="${esc(id)}" aria-label="Flere valg">${icon("dots")}</button>` : "")}
        <div class="exercise-hero">
          <span class="avatar avatar-lg">${TL.eqIcon(def.equipment)}</span>
          <div>
            <h2>${esc(def.name)}</h2>
            <small>${esc(meta)}${secondary ? `<br>Også: ${esc(secondary)}` : ""}</small>
          </div>
        </div>
        ${seg("ex-tab", [["overview", "Oversigt"], ["history", `Historik (${history.length})`]], tab)}
        ${tab === "overview" ? (series.length ? `
          <section class="card chart-card">
            ${seg("ex-metric", metrics, metric)}
            <div data-chart></div>
            ${seg("ex-range", RANGES, detailState.range)}
          </section>
          ${recordTiles(records[id], type)}
          ${type === "wr" && records[id] && records[id].e1rm ? `
            <button type="button" class="btn btn-soft btn-wide" data-act="open-1rm" data-v="${TL.toDisplay(records[id].e1rm, u)}">${icon("calc")} Se procenter af din 1RM</button>` : ""}
        ` : `<div class="empty"><span class="empty-icon">${icon("dumbbell")}</span><p>Du har ikke logget denne øvelse endnu.</p></div>`)
        : (historyHtml || `<div class="empty"><p>Ingen historik endnu.</p></div>`)}
      `,
      after(root) {
        const el = root.querySelector("[data-chart]");
        if (el) TL.mountChart(el, { kind: "line", rows, format: metricFormat(metric), label: def.name });
      },
    };
  };

  Object.assign(TL.actions, {
    "ex-tab"(el) { detailState.tab = el.dataset.v; TL.renderKeep(); },
    "ex-range"(el) { detailState.range = el.dataset.v; TL.renderKeep(); },
    "ex-metric"(el) {
      const id = decodeURIComponent(location.hash.split("/")[2]);
      detailState.metric[id] = el.dataset.v;
      TL.renderKeep();
    },
    "custom-menu"(el) {
      const def = TL.exercise(el.dataset.id);
      const used = S().workouts.some((w) => w.exercises.some((e) => e.exId === def.id))
        || S().routines.some((r) => r.exercises.some((e) => e.exId === def.id))
        || (S().active && S().active.exercises.some((e) => e.exId === def.id));
      TL.menu(def.name, [
        { label: "Redigér", icon: "edit", async run() { if (await customForm(def)) TL.renderKeep(); } },
        { label: "Slet", icon: "trash", danger: true, hint: used ? "Bruges i din historik eller en rutine" : "", run() {
          if (used) { TL.toast("Øvelsen er i brug og kan ikke slettes"); return; }
          S().customExercises.splice(S().customExercises.indexOf(def), 1);
          TL.persist();
          TL.go("#/ovelser", true);
        } },
      ]);
    },
  });
})();
