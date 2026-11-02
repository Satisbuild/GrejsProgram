/* Offline-understøttelse. Netværk først, så nye versioner altid slår igennem,
   og cachen tager over når der ikke er forbindelse (fx i kælderen i fitnesscenteret). */
const CACHE = "traeningslog-v1";
const FILES = [
  "./", "index.html", "css/app.css", "manifest.webmanifest", "assets/icon.svg", "assets/icon-180.png", "assets/icon-512.png",
  "js/exercises.js", "js/logic.js", "js/store.js", "js/ui.js", "js/editor.js",
  "js/views-workouts.js", "js/views-exercises.js", "js/views-profile.js", "js/app.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("index.html")))
  );
});
