// Cache simples para o app abrir offline depois da primeira visita.
const CACHE = 'escola-app-v12';
const FILES = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/data.js', 'js/api.js', 'js/app.js', 'manifest.json', 'assets/marca/logo.png', 'assets/marca/selo.png', 'assets/marca/faixa.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Rede primeiro, cache como reserva: o protótipo muda muito.
self.addEventListener('fetch', e => {
  // Só arquivos do próprio app; chamadas ao Supabase vão direto para a rede.
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request))
  );
});
