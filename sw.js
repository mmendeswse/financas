/* Service worker — deixa o app abrir sem internet no iPad/iPhone.
   Arquivos do app: cache primeiro. Cotações (APIs): sempre rede. */
const CACHE = "muller-mendes-v5";
const ARQUIVOS = [
  "./", "./index.html", "./css/style.css", "./manifest.json", "./manifest.webmanifest",
  "./js/vendor/chart.umd.min.js", "./js/vendor/xlsx.full.min.js",
  "./js/armazenamento.js", "./js/financeiro.js", "./js/investimentos.js",
  "./js/graficos.js", "./js/cotacoes.js", "./js/app.js",
  "./assets/icons/icon-192.png", "./assets/icons/icon-512.png",
  "./apple-touch-icon.png", "./apple-touch-icon-180.png", "./apple-touch-icon-167.png", "./apple-touch-icon-152.png", "./apple-touch-icon-precomposed.png"
];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // APIs de cotação: rede normal
  const ehPagina = e.request.mode === "navigate" || (e.request.destination === "document");
  if (ehPagina) { // página: rede primeiro (cai no cache se estiver offline)
    e.respondWith(fetch(e.request).then((resp) => { const cp = resp.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return resp; }).catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html"))));
    return;
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => { const cp = resp.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return resp; })));
});
