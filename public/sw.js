// Service Worker básico para PWA
const CACHE_NAME = 'controle-oliveira-martins-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event - cache recursos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate event - limpar caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - estratégia network-first com fallback para cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone da resposta
        const responseToCache = response.clone();
        
        // Cache para recursos estáticos
        if (event.request.url.includes('/static/') || 
            event.request.url.includes('/assets/') ||
            event.request.destination === 'image') {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        
        return response;
      })
      .catch(() => {
        // Fallback para cache se network falhar
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              return response;
            }
            // Se não encontrar no cache, retornar página offline
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

