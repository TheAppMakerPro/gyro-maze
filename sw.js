/**
 * GyroMaze Service Worker
 * Provides offline caching and PWA functionality
 */

const CACHE_NAME = 'gyromaze-v1.0.0';
const STATIC_CACHE = 'gyromaze-static-v1.0.0';
const DYNAMIC_CACHE = 'gyromaze-dynamic-v1.0.0';

// Files to cache immediately on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/main.js',
    '/js/game/GameEngine.js',
    '/js/game/InputManager.js',
    '/js/game/LevelManager.js',
    '/js/ui/UIManager.js',
    '/js/utils/AudioManager.js',
    '/js/utils/StorageManager.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// External resources to cache
const EXTERNAL_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600&display=swap'
];

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                // Cache external assets separately (they might fail)
                return caches.open(DYNAMIC_CACHE)
                    .then((cache) => {
                        return Promise.allSettled(
                            EXTERNAL_ASSETS.map(url => 
                                fetch(url)
                                    .then(response => cache.put(url, response))
                                    .catch(err => console.warn('[SW] Failed to cache:', url))
                            )
                        );
                    });
            })
            .then(() => {
                console.log('[SW] Installation complete');
                return self.skipWaiting();
            })
            .catch((err) => {
                console.error('[SW] Installation failed:', err);
            })
    );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            // Delete old version caches
                            return name.startsWith('gyromaze-') && 
                                   name !== STATIC_CACHE && 
                                   name !== DYNAMIC_CACHE;
                        })
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Activation complete');
                return self.clients.claim();
            })
    );
});

/**
 * Fetch event - serve from cache with network fallback
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome extension requests
    if (url.protocol === 'chrome-extension:') {
        return;
    }
    
    // Handle different request types
    if (isStaticAsset(url)) {
        // Static assets: Cache first, then network
        event.respondWith(cacheFirst(request));
    } else if (isExternalAsset(url)) {
        // External assets: Stale while revalidate
        event.respondWith(staleWhileRevalidate(request));
    } else {
        // Other requests: Network first, then cache
        event.respondWith(networkFirst(request));
    }
});

/**
 * Check if URL is a static asset
 */
function isStaticAsset(url) {
    const staticExtensions = ['.html', '.css', '.js', '.json', '.png', '.jpg', '.svg', '.ico', '.woff', '.woff2'];
    return url.origin === self.location.origin && 
           staticExtensions.some(ext => url.pathname.endsWith(ext));
}

/**
 * Check if URL is an external asset (fonts, CDN)
 */
function isExternalAsset(url) {
    const externalDomains = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];
    return externalDomains.some(domain => url.hostname.includes(domain));
}

/**
 * Cache first strategy
 */
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error('[SW] Fetch failed:', error);
        // Return offline page if available
        return caches.match('/index.html');
    }
}

/**
 * Network first strategy
 */
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        // Return offline page
        return caches.match('/index.html');
    }
}

/**
 * Stale while revalidate strategy
 */
async function staleWhileRevalidate(request) {
    const cachedResponse = await caches.match(request);
    
    const fetchPromise = fetch(request)
        .then((networkResponse) => {
            if (networkResponse.ok) {
                caches.open(DYNAMIC_CACHE)
                    .then((cache) => cache.put(request, networkResponse.clone()));
            }
            return networkResponse;
        })
        .catch(() => cachedResponse);
    
    return cachedResponse || fetchPromise;
}

/**
 * Handle messages from main thread
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.keys()
            .then((names) => Promise.all(names.map(name => caches.delete(name))))
            .then(() => event.ports[0].postMessage({ cleared: true }));
    }
});

/**
 * Background sync for future use (leaderboards, etc.)
 */
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-scores') {
        event.waitUntil(syncScores());
    }
});

async function syncScores() {
    // Placeholder for future leaderboard sync
    console.log('[SW] Syncing scores...');
}

/**
 * Push notification handler for future use
 */
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        event.waitUntil(
            self.registration.showNotification(data.title, {
                body: data.body,
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-72.png',
                vibrate: [100, 50, 100],
                data: data.url
            })
        );
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.notification.data) {
        event.waitUntil(clients.openWindow(event.notification.data));
    }
});
