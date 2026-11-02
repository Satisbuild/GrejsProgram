/* Router, navigation og opstart. */
var TL = (globalThis.TL = globalThis.TL || {});

(() => {
  const { esc, icon } = TL;
  const main = document.getElementById("view");
  const tabs = document.getElementById("tabs");
  const mini = document.getElementById("mini");
  const scrollByHash = {};
  let lastHash = null;

  const ROUTES = [
    [/^#\/aktiv$/, () => TL.views.active()],
    [/^#\/rutine\/(.+)$/, (id) => TL.views.routineEditor(id)],
    [/^#\/historik$/, () => TL.views.history()],
    [/^#\/traening\/(.+)$/, (id) => TL.views.workout(id)],
    [/^#\/opsummering\/(.+)$/, (id) => TL.views.summary(id)],
    [/^#\/ovelser$/, () => TL.views.exercises()],
    [/^#\/ovelse\/(.+)$/, (id) => TL.views.exercise(id)],
    [/^#\/profil$/, () => TL.views.profile()],
    [/^#\/maal$/, () => TL.views.measurements()],
    [/^#\/indstillinger$/, () => TL.views.settings()],
  ];

  const TABS = [
    ["#/", "Træning", "dumbbell", ["#/", "", "#"]],
    ["#/historik", "Historik", "history", ["#/historik"]],
    ["#/ovelser", "Øvelser", "list", ["#/ovelser"]],
    ["#/profil", "Profil", "user", ["#/profil"]],
  ];

  function resolve() {
    const hash = location.hash;
    for (const [re, fn] of ROUTES) {
      const m = hash.match(re);
      if (m) return fn(m[1] ? decodeURIComponent(m[1]) : undefined);
    }
    return TL.views.home();
  }

  function renderChrome(hideTabs) {
    const hash = location.hash;
    if (hideTabs !== undefined) tabs.hidden = hideTabs;
    document.body.classList.toggle("tabs-hidden", tabs.hidden);
    tabs.innerHTML = TABS.map(([href, label, ic, matches]) => `
      <a href="${href}" class="tab${matches.includes(hash) ? " on" : ""}"${matches.includes(hash) ? ' aria-current="page"' : ""}>${icon(ic)}<span>${label}</span></a>`).join("");

    const a = TL.state.active;
    const onEditor = hash.startsWith("#/aktiv");
    const showMini = a && !onEditor && !hash.startsWith("#/rutine");
    mini.hidden = !showMini;
    document.body.classList.toggle("has-mini", !!showMini);
    if (showMini) {
      const label = a.mode === "live" ? "Træning i gang" : "Redigering i gang";
      mini.innerHTML = `
        <a class="mini-link" href="#/aktiv">
          <span class="mini-text"><strong>${esc(a.title || label)}</strong><small>${label}${a.rest ? ` · pause <b data-rest-time></b>` : ""}</small></span>
          ${a.mode === "live" ? `<span class="mini-clock" data-clock></span>` : ""}
          <span class="chev">${icon("up")}</span>
        </a>`;
    }
    TL.tick();
  }

  function render() {
    const hash = location.hash;
    const view = resolve();
    if (location.hash !== hash) return; // Viewet omdirigerede
    main.innerHTML = view.html;
    main.className = view.hideTabs ? "no-tabs" : "";
    renderChrome(!!view.hideTabs);
    if (view.after) view.after(main);
  }

  // Render uden at miste scroll-position.
  function renderKeep() {
    const top = document.scrollingElement.scrollTop;
    render();
    document.scrollingElement.scrollTop = top;
  }

  function go(hash, replace) {
    if (replace) {
      history.replaceState(null, "", hash);
      navigated();
    } else if (location.hash === hash) render();
    else location.hash = hash;
  }

  function navigated() {
    if (lastHash !== null) scrollByHash[lastHash] = document.scrollingElement.scrollTop;
    TL.closeAllSheets();
    render();
    document.scrollingElement.scrollTop = scrollByHash[location.hash] || 0;
    lastHash = location.hash;
  }

  window.addEventListener("hashchange", navigated);

  /* ---------- Handlinger ---------- */
  TL.actions["go-back"] = () => {
    if (history.length > 1) history.back(); else go("#/ovelser");
  };

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    const fn = TL.actions[el.dataset.act];
    if (fn) fn(el, e);
  });

  /* ---------- Tema ---------- */
  function applyTheme() {
    const t = TL.state.settings.theme;
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  Object.assign(TL, { render, renderKeep, renderChrome, go, applyTheme });

  /* ---------- Opstart ---------- */
  TL.load();
  applyTheme();
  TL.setSaveErrorHandler(() => TL.toast("Kunne ikke gemme: browserens lager er fuldt"));

  navigated();
  setInterval(TL.tick, 500);
  TL.acquireWakeLock();

  // Gem altid inden browseren lukker eller lægger siden i baggrunden.
  window.addEventListener("pagehide", TL.flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") TL.flush();
    else { TL.acquireWakeLock(); TL.tick(); }
  });

  // Bed browseren om ikke at rydde data automatisk.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
