// ══════════════════════════════════════════
//  Taller IA · Service Worker
//  Stale-while-revalidate for code/HTML
//  Cache-first for images
//  Network-first for API & fonts
// ══════════════════════════════════════════

const CACHE_NAME = 'taller-ia-v7';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/infantil.html',
  '/primaria.html',
  '/eso.html',
  '/css/styles.css',
  '/css/assistant.css',
  '/js/app.js',
  '/js/assistant.js',
  '/js/renderer.js',
  '/js/data/content.js',
  '/js/data/bulletin.js',
  '/data/catalog.json',
  '/data/prompts.json',
  '/data/herramientas_externas.json',
  '/data/escuela_dna.json',
  '/data/lomloe_murcia.json',
  '/data/inspeccion_murcia.json',
  '/img/favicon.ico',
  '/img/bupia.png',
  '/img/logo-colegio.png',
  '/img/logo-rubricas.png',
  '/img/gemini.png',
  '/img/chatgpt.png',
  '/img/claude.png',
  '/img/copilot.png',
  '/img/grok.png',
  '/img/suno.png',
  '/img/flow.png',
  '/img/notebooklm.png',
  '/img/luma.png',
  '/img/dreammachine.png',
  '/img/aistudio.png',
  '/img/antigravity.png',
  '/manifest.json',
];

// Extensions that change frequently → stale-while-revalidate
const CODE_EXTENSIONS = /\.(html|js|css|json)(\?.*)?$/i;

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean ALL old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: strategy depends on request type
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // NEVER cache API calls or POST requests
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;

  // NEVER cache external API domains
  if (url.hostname.includes('anthropic.com') ||
      url.hostname.includes('tavily.com') ||
      url.hostname.includes('run.app')) return;

  // Network-first for Google Fonts
  if (url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Stale-while-revalidate for code & data (HTML, JS, CSS, JSON)
  // Serves cached version instantly, fetches fresh copy in background
  if (url.origin === self.location.origin &&
      (CODE_EXTENSIONS.test(url.pathname) || url.pathname === '/')) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Cache-first for images and other static assets (rarely change)
  event.respondWith(cacheFirst(event.request));
});

// Serve from cache immediately, update cache in background for next load
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // Always fetch fresh version in background
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  // Return cached immediately if available, otherwise wait for network
  if (cached) return cached;

  const response = await fetchPromise;
  if (response) return response;

  // Offline navigation → fallback
  if (request.mode === 'navigate') return offlineFallback();
  return new Response('', { status: 503 });
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    if (request.mode === 'navigate') return offlineFallback();
    throw err;
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    return cached || new Response('', { status: 503 });
  }
}

function offlineFallback() {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sin conexión — Taller IA</title>
  <style>
    body {
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(160deg, #fdf6f0 0%, #f0e6f6 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #2d2b3d;
      margin: 0;
    }
    .offline-box { text-align: center; padding: 2rem; max-width: 400px; }
    .offline-icon { font-size: 4rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #5a5775; line-height: 1.6; margin-bottom: 1.5rem; }
    .retry-btn {
      padding: 0.75rem 2rem; border: none; border-radius: 1rem;
      background: linear-gradient(135deg, #7c5cbf, #ff7b54);
      color: #fff; font-family: inherit; font-size: 1rem; font-weight: 600; cursor: pointer;
    }
    .retry-btn:hover { transform: scale(1.03); }
  </style>
</head>
<body>
  <div class="offline-box">
    <div class="offline-icon">📡</div>
    <h1>Sin conexión</h1>
    <p>No se puede acceder a Taller IA en este momento. Comprueba tu conexión WiFi e inténtalo de nuevo.</p>
    <button class="retry-btn" onclick="location.reload()">Reintentar</button>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
