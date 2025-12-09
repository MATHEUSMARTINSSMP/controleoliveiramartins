// Service Worker básico para PWA
const CACHE_NAME = 'controle-oliveira-martins-v4'; // Atualizado para forçar refresh e limpar cache de módulos JS
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

// Activate event - limpar caches antigos e forçar atualização
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Limpar TODOS os caches antigos, incluindo o atual se for versão antiga
          if (cacheName !== CACHE_NAME) {
            console.log('Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      ).then(() => {
        // Forçar atualização imediata do ServiceWorker
        return self.clients.claim();
      });
    })
  );
});

// Fetch event - estratégia network-first com fallback para cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // NÃO interceptar módulos JS dinâmicos - deixar passar direto para a rede
  // Isso evita problemas com ServiceWorker interceptando módulos com hash
  // Verificar tanto pathname quanto search params para capturar todos os casos
  const isJSModule = 
    url.pathname.includes('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.match(/\.js(\?|$)/) ||
    event.request.destination === 'script' ||
    event.request.destination === 'worker' ||
    (event.request.headers.get('accept') && (
      event.request.headers.get('accept').includes('application/javascript') ||
      event.request.headers.get('accept').includes('text/javascript') ||
      event.request.headers.get('accept').includes('*/*')
    ));
  
  if (isJSModule) {
    // Para módulos JS, NUNCA interceptar - deixar o navegador buscar diretamente da rede
    // Isso evita que o Service Worker retorne HTML (404) em vez de JS
    // Usar fetch direto SEM passar pelo cache do Service Worker
    event.respondWith(
      fetch(event.request, {
        cache: 'no-store', // Não usar cache do Service Worker
        credentials: 'same-origin'
      }).catch(() => {
        // Se falhar, retornar erro em vez de HTML
        return new Response('Module not found', { 
          status: 404, 
          headers: { 'Content-Type': 'text/plain' } 
        });
      })
    );
    return;
  }
  
  // Para outros recursos, usar estratégia network-first
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone da resposta
        const responseToCache = response.clone();
        
        // Cache apenas para recursos estáticos (não JS dinâmico)
        if ((event.request.url.includes('/static/') || 
            event.request.destination === 'image') &&
            !event.request.url.includes('/assets/')) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        
        return response;
      })
      .catch(() => {
        // Fallback para cache se network falhar
        // MAS NUNCA para módulos JS
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

