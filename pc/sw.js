// SmartPOS · Service Worker (modo offline)
// Cambia CACHE cuando cambies archivos del shell para forzar la actualización.

const CACHE = 'smartpos-20261122aa';

const SHELL = [
    './',
    './index.html',
    './css/styles.css',
    './js/db.js',
    './js/offline.js',
    './js/pos.js',
    './js/realtime.js',
    './js/ventas.js',
    './modulos/ticket/ticket.css',
    './modulos/ticket/ticket.html',
    './modulos/ticket/ticket.js'
];

const CDN = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js',
    'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);

        for (const url of SHELL) {
            try { await cache.add(new Request(url, { cache: 'reload' })); }
            catch (err) { console.warn('SW: no se pudo cachear', url); }
        }

        for (const url of CDN) {
            try { await cache.add(new Request(url, { mode: 'no-cors' })); }
            catch (err) { console.warn('SW: no se pudo cachear', url); }
        }

        self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const claves = await caches.keys();
        await Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // La API de Supabase siempre va a la red (el modo offline lo gestiona la app)
    if (url.hostname.endsWith('supabase.co')) return;

    // Navegación: red primero, cache como respaldo
    if (request.mode === 'navigation') {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE);
            try {
                const respuesta = await fetch(request);
                if (respuesta && respuesta.ok) cache.put(request, respuesta.clone());
                return respuesta;
            } catch (err) {
                return (await cache.match(request)) || (await cache.match('./index.html')) || Response.error();
            }
        })());
        return;
    }

    // Resto: cache primero y actualización en segundo plano
    event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        const guardado = await cache.match(request);

        if (guardado) {
            fetch(request)
                .then(respuesta => { if (respuesta && respuesta.ok) cache.put(request, respuesta.clone()); })
                .catch(() => {});
            return guardado;
        }

        try {
            const respuesta = await fetch(request);
            if (respuesta && (respuesta.ok || respuesta.type === 'opaque')) {
                cache.put(request, respuesta.clone());
            }
            return respuesta;
        } catch (err) {
            return Response.error();
        }
    })());
});
