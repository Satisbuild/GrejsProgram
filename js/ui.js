/* Fælles UI: ikoner, toast, sheets, dialoger og grafer. */
var TL = (globalThis.TL = globalThis.TL || {});

(() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const svg = (d, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
  const ICONS = {
    dumbbell: svg('<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>'),
    history: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3.5 2"/>'),
    list: svg('<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    check: svg('<path d="M5 12.5 10 17.5 19.5 7"/>'),
    dots: svg('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>'),
    back: svg('<path d="m15 5-7 7 7 7"/>'),
    down: svg('<path d="m5 9 7 7 7-7"/>'),
    up: svg('<path d="m5 15 7-7 7 7"/>'),
    right: svg('<path d="m9 5 7 7-7 7"/>'),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    timer: svg('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 1.5M9.5 2.5h5"/>'),
    trophy: svg('<path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H4.5v1.5A3.5 3.5 0 0 0 8 11M16 6h3.5v1.5A3.5 3.5 0 0 1 16 11M12 14v4M8 20.5h8M9.5 18h5"/>'),
    edit: svg('<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>'),
    copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'),
    trash: svg('<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/>'),
    swap: svg('<path d="M4 8h14l-3-3M20 16H6l3 3"/>'),
    link: svg('<path d="M10 14a4 4 0 0 0 6 .5l3-3a4 4 0 0 0-5.7-5.7l-1.3 1.3"/><path d="M14 10a4 4 0 0 0-6-.5l-3 3a4 4 0 0 0 5.7 5.7l1.3-1.3"/>'),
    flame: svg('<path d="M12 3c1 3.5 5.5 5.5 5.5 11a5.5 5.5 0 0 1-11 0c0-2.2 1-3.7 2.2-5 .3 1.5 1 2.3 1.8 2.8C10 9 10.5 6 12 3z"/>'),
    calendar: svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>'),
    ruler: svg('<rect x="2.5" y="8" width="19" height="8" rx="1.5"/><path d="M7 8v3M11 8v4M15 8v3M19 8v3"/>'),
    gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>'),
    calc: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 7h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>'),
    note: svg('<path d="M5 4h14v11l-5 5H5zM14 20v-5h5M8.5 9h7M8.5 12.5h4"/>'),
    download: svg('<path d="M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 20h14"/>'),
    upload: svg('<path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 20h14"/>'),
    medal: svg('<circle cx="12" cy="15" r="5.5"/><path d="M8.5 10.5 6 3h4l2 5M15.5 10.5 18 3h-4l-2 5"/>'),
    // Udstyr
    eq_stang: svg('<path d="M2 12h20M6 8v8M9 6v12M15 6v12M18 8v8"/>'),
    eq_haandvaegt: svg('<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>'),
    eq_maskine: svg('<rect x="4" y="3" width="6" height="18" rx="1"/><path d="M10 8h6l4 4"/><circle cx="19" cy="14" r="2.5"/><path d="M4 9h6M4 15h6"/>'),
    eq_kabel: svg('<path d="M5 3v9a6 6 0 0 0 6 6h6"/><circle cx="18.5" cy="18" r="2.5"/><path d="M2.5 3h5"/>'),
    eq_smith: svg('<path d="M5 3v18M19 3v18M2 11h20M8 8v6M16 8v6"/>'),
    eq_kropsvaegt: svg('<circle cx="12" cy="5" r="2.5"/><path d="M12 8v7M12 15l-4 6M12 15l4 6M5 10.5l7 1.5 7-1.5"/>'),
    eq_kettlebell: svg('<path d="M9 8.5C7.5 4 9 3 12 3s4.5 1 3 5.5"/><circle cx="12" cy="14.5" r="6.5"/>'),
    eq_elastik: svg('<path d="M4 7c4 0 4 10 8 10s4-10 8-10"/><circle cx="4" cy="7" r="1.5"/><circle cx="20" cy="7" r="1.5"/>'),
    eq_cardio: svg('<path d="M3 12h4l2-5 4 10 2-5h6"/>'),
    eq_andet: svg('<path d="M6.5 6.500v11M17.5 6.500v11M6.5 12h11"/>'),
  };
  const icon = (name) => ICONS[name] || "";
  const eqIcon = (equipment) => ICONS[`eq_${equipment}`] || ICONS.eq_andet;

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg, opts = {}) {
    const el = document.getElementById("toast");
    el.innerHTML = `<span>${esc(msg)}</span>${opts.undo ? `<button type="button" class="toast-undo">Fortryd</button>` : ""}`;
    el.classList.add("show");
    if (opts.undo) {
      el.querySelector(".toast-undo").onclick = () => { el.classList.remove("show"); opts.undo(); };
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), opts.undo ? 6000 : 2800);
  }

  /* ---------- Sheets ---------- */
  const stack = [];

  function openSheet(html, opts = {}) {
    const root = document.getElementById("sheets");
    const wrap = document.createElement("div");
    wrap.className = `sheet-wrap${opts.tall ? " tall" : ""}${opts.center ? " center" : ""}`;
    wrap.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-modal="true"${opts.label ? ` aria-label="${esc(opts.label)}"` : ""} tabindex="-1">${opts.center ? "" : '<div class="sheet-grip"></div>'}${html}</div>`;
    root.appendChild(wrap);
    const entry = { wrap, onClose: opts.onClose, prevFocus: document.activeElement };
    stack.push(entry);
    wrap.querySelector(".sheet-backdrop").addEventListener("click", () => closeSheet());
    requestAnimationFrame(() => {
      wrap.classList.add("open");
      if (!opts.noFocus) wrap.querySelector(".sheet").focus({ preventScroll: true });
    });
    return wrap;
  }

  function closeSheet() {
    const entry = stack.pop();
    if (!entry) return;
    entry.wrap.classList.remove("open");
    setTimeout(() => entry.wrap.remove(), 220);
    if (entry.onClose) entry.onClose();
    if (entry.prevFocus && entry.prevFocus.focus && document.contains(entry.prevFocus)) entry.prevFocus.focus({ preventScroll: true });
  }
  function closeAllSheets() { while (stack.length) closeSheet(); }

  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && stack.length) closeSheet(); });

  function confirmDialog({ title, body, ok = "OK", cancel = "Annullér", danger = false }) {
    return new Promise((resolve) => {
      let answer = false;
      const wrap = openSheet(`
        <h2 class="dialog-title">${esc(title)}</h2>
        ${body ? `<p class="dialog-body">${esc(body)}</p>` : ""}
        <div class="dialog-actions">
          <button type="button" class="btn btn-soft" data-no>${esc(cancel)}</button>
          <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-yes>${esc(ok)}</button>
        </div>`, { center: true, label: title, onClose: () => resolve(answer) });
      wrap.querySelector("[data-no]").onclick = () => closeSheet();
      wrap.querySelector("[data-yes]").onclick = () => { answer = true; closeSheet(); };
    });
  }

  // items: [{label, icon, danger, hint, run}]
  function menu(title, items) {
    const list = items.filter(Boolean);
    const wrap = openSheet(`
      ${title ? `<h2 class="sheet-title">${esc(title)}</h2>` : ""}
      <div class="menu-list">
        ${list.map((it, i) => `
          <button type="button" class="menu-item${it.danger ? " danger" : ""}" data-i="${i}">
            ${it.icon ? `<span class="menu-icon">${icon(it.icon)}</span>` : ""}
            <span class="menu-label">${esc(it.label)}${it.hint ? `<small>${esc(it.hint)}</small>` : ""}</span>
          </button>`).join("")}
      </div>`, { label: title || "Menu" });
    wrap.querySelectorAll(".menu-item").forEach((btn) => {
      btn.onclick = () => { closeSheet(); list[+btn.dataset.i].run(); };
    });
  }

  // Lille formular med ét eller flere felter. Løser med {name: værdi} eller null.
  function formDialog({ title, fields, ok = "Gem" }) {
    return new Promise((resolve) => {
      let result = null;
      const wrap = openSheet(`
        <h2 class="sheet-title">${esc(title)}</h2>
        <form class="form-stack">
          ${fields.map((f) => `
            <label class="field"><span>${esc(f.label)}</span>
              ${f.type === "select"
                ? `<select name="${esc(f.name)}">${f.options.map(([v, l]) => `<option value="${esc(v)}"${v === f.value ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`
                : f.type === "textarea"
                  ? `<textarea name="${esc(f.name)}" rows="3" placeholder="${esc(f.placeholder || "")}">${esc(f.value ?? "")}</textarea>`
                  : `<input name="${esc(f.name)}" type="${f.type || "text"}" inputmode="${esc(f.inputmode || "text")}" value="${esc(f.value ?? "")}" placeholder="${esc(f.placeholder || "")}" autocomplete="off">`}
            </label>`).join("")}
          <button class="btn btn-primary btn-wide" type="submit">${esc(ok)}</button>
        </form>`, { label: title, noFocus: true, onClose: () => resolve(result) });
      const form = wrap.querySelector("form");
      form.onsubmit = (e) => {
        e.preventDefault();
        result = Object.fromEntries(new FormData(form).entries());
        closeSheet();
      };
      const first = form.querySelector("input,textarea");
      if (first) setTimeout(() => { first.focus(); if (first.select) first.select(); }, 60);
    });
  }

  /* ---------- Grafer ----------
     Én serie, én akse. Tooltip følger nærmeste datapunkt på touch, mus og piletaster.
     rows: [{label, value, tip}] */
  function niceMax(max) {
    if (max <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(max)));
    const n = max / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * pow;
  }

  function mountChart(el, { kind = "line", rows, format = (v) => TL.fmtNum(v), xEvery, label = "Graf" }) {
    if (!el) return;
    if (!rows.length) { el.innerHTML = `<div class="chart-empty">Ingen data i perioden</div>`; return; }

    const W = Math.max(280, el.clientWidth || 320), H = 188;
    const pad = { l: 40, r: 10, t: 12, b: 24 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const vals = rows.map((r) => r.value);
    const rawMax = Math.max(...vals);
    let lo = 0;
    if (kind === "line") {
      const rawMin = Math.min(...vals);
      if (rawMax > rawMin && rawMin > 0 && (rawMax - rawMin) / rawMax < 0.5) {
        // Linjer må zoome ind på udviklingen; søjler starter altid i nul.
        const p = Math.pow(10, Math.floor(Math.log10(Math.max(rawMax - rawMin, 1e-6))));
        lo = Math.floor(rawMin / p) * p;
      }
    }
    const span = niceMax(rawMax - lo || rawMax || 1);
    const hi = lo + span;
    const y = (v) => pad.t + ih - ((v - lo) / (hi - lo)) * ih;
    const n = rows.length;
    const band = iw / n;
    const x = kind === "bar"
      ? (i) => pad.l + band * (i + 0.5)
      : (i) => (n === 1 ? pad.l + iw / 2 : pad.l + (iw * i) / (n - 1));

    // Små heltal giver ellers samme etiket to gange (0, 1, 1).
    const ticks = [0, 0.5, 1].map((t) => lo + (hi - lo) * t)
      .filter((t, i, all) => all.findIndex((o) => format(o, true) === format(t, true)) === i);
    const grid = ticks.map((t) => `
      <line class="chart-grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"></line>
      <text class="chart-tick" x="${pad.l - 6}" y="${y(t) + 3.5}" text-anchor="end">${esc(format(t, true))}</text>`).join("");

    const every = xEvery || Math.max(1, Math.ceil(n / 5));
    const xlabels = rows.map((r, i) => {
      if (kind === "line" && n > 1) {
        if (i !== 0 && i !== n - 1 && !(n >= 5 && i === Math.floor((n - 1) / 2))) return "";
      } else if ((n - 1 - i) % every !== 0) return "";
      const anchor = kind === "line" && n > 1 ? (i === 0 ? "start" : i === n - 1 ? "end" : "middle") : "middle";
      return `<text class="chart-tick" x="${x(i)}" y="${H - 7}" text-anchor="${anchor}">${esc(r.label)}</text>`;
    }).join("");

    let marks = "";
    if (kind === "bar") {
      const bw = Math.min(22, Math.max(5, band - 4));
      marks = rows.map((r, i) => {
        if (!r.value) return "";
        const top = y(r.value), h = Math.max(2, pad.t + ih - top), left = x(i) - bw / 2, rad = Math.min(4, bw / 2, h);
        return `<path class="chart-bar" data-mark="${i}" d="M${left} ${top + h}V${top + rad}Q${left} ${top} ${left + rad} ${top}H${left + bw - rad}Q${left + bw} ${top} ${left + bw} ${top + rad}V${top + h}Z"></path>`;
      }).join("");
    } else {
      const pts = rows.map((r, i) => `${x(i)},${y(r.value)}`).join(" ");
      marks = (n > 1 ? `<polyline class="chart-line" points="${pts}"></polyline>` : "")
        + (n <= 24 ? rows.map((r, i) => `<circle class="chart-dot" cx="${x(i)}" cy="${y(r.value)}" r="4"></circle>`).join("") : "");
    }

    const summary = `${label}: ${rows.map((r) => `${r.tip || r.label} ${format(r.value)}`).slice(-12).join(", ")}`;
    el.innerHTML = `
      <div class="chart" tabindex="0" role="img" aria-label="${esc(summary)}">
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none">
          ${grid}${marks}${xlabels}
          <line class="chart-cross" y1="${pad.t}" y2="${pad.t + ih}" style="display:none"></line>
          <circle class="chart-focus" r="5" style="display:none"></circle>
        </svg>
        <div class="chart-tip" hidden></div>
      </div>`;

    const box = el.querySelector(".chart");
    const tip = box.querySelector(".chart-tip");
    const cross = box.querySelector(".chart-cross");
    const focus = box.querySelector(".chart-focus");
    let current = -1;

    function show(i) {
      current = i;
      const r = rows[i];
      tip.textContent = "";
      const strong = document.createElement("strong");
      strong.textContent = format(r.value);
      const small = document.createElement("span");
      small.textContent = r.tip || r.label;
      tip.append(strong, small);
      tip.hidden = false;
      const px = x(i);
      tip.style.left = `${Math.min(Math.max(58, (px / W) * box.clientWidth), box.clientWidth - 58)}px`;
      box.querySelectorAll(".chart-bar").forEach((b) => b.classList.toggle("on", +b.dataset.mark === i));
      if (kind === "line") {
        cross.setAttribute("x1", px); cross.setAttribute("x2", px); cross.style.display = "";
        focus.setAttribute("cx", px); focus.setAttribute("cy", y(r.value)); focus.style.display = "";
      }
    }
    function hide() {
      current = -1;
      tip.hidden = true;
      cross.style.display = "none"; focus.style.display = "none";
      box.querySelectorAll(".chart-bar.on").forEach((b) => b.classList.remove("on"));
    }
    function nearest(clientX) {
      const rect = box.getBoundingClientRect();
      const px = ((clientX - rect.left) / rect.width) * W;
      let best = 0, dist = Infinity;
      rows.forEach((_, i) => { const d = Math.abs(x(i) - px); if (d < dist) { dist = d; best = i; } });
      return best;
    }
    box.addEventListener("pointermove", (e) => show(nearest(e.clientX)));
    box.addEventListener("pointerdown", (e) => show(nearest(e.clientX)));
    box.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") hide(); });
    box.addEventListener("blur", hide);
    box.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); show(Math.min(n - 1, current + 1)); }
      if (e.key === "ArrowLeft") { e.preventDefault(); show(Math.max(0, current < 0 ? n - 1 : current - 1)); }
    });
  }

  /* ---------- Fil-download ---------- */
  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- Datoformat ---------- */
  const da = (opts) => new Intl.DateTimeFormat("da-DK", opts);
  const fmtDay = (ts) => da({ weekday: "long", day: "numeric", month: "long" }).format(ts);
  const fmtShort = (ts) => da({ day: "numeric", month: "short" }).format(ts);
  const fmtMonth = (ts) => da({ month: "long", year: "numeric" }).format(ts);
  const fmtTime = (ts) => da({ hour: "2-digit", minute: "2-digit" }).format(ts);
  function fmtRelative(ts, now = Date.now()) {
    const days = Math.round((TL.startOfDay(now) - TL.startOfDay(ts)) / TL.DAY);
    if (days <= 0) return "I dag";
    if (days === 1) return "I går";
    if (days < 7) return `${days} dage siden`;
    if (days < 60) return `${Math.round(days / 7)} uger siden`;
    return fmtShort(ts);
  }

  Object.assign(TL, {
    esc, icon, eqIcon, toast, openSheet, closeSheet, closeAllSheets, confirmDialog, menu, formDialog,
    mountChart, download, fmtDay, fmtShort, fmtMonth, fmtTime, fmtRelative,
    actions: {}, views: {},
  });
})();
