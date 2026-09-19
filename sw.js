/*
 * Service worker : rend l'application utilisable hors ligne.
 * - Le « noyau » (page, manifeste, icônes) est mis en cache à l'installation.
 * - Les bibliothèques externes (Tailwind, Chart.js, polices) sont mises en cache au premier usage.
 * - La navigation tente le réseau, puis retombe sur la version en cache.
 */
const VERSION = 'fitness-os-v2';
const NOYAU = [
  './',
  './index.html',
  './tailwind.css',
  './chart.umd.js',
  './manifest.webmanifest',
  './icone-192.png',
  './icone-512.png',
  './polices/bricolage-400.woff2',
  './polices/bricolage-600.woff2',
  './polices/bricolage-800.woff2',
];
const HOTES_EXTERNES = [];  // plus aucune dépendance externe : tout est servi localement

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      // addAll échoue en bloc : on ajoute fichier par fichier pour rester tolérant
      .then((cache) => Promise.all(NOYAU.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((cle) => cle !== VERSION).map((cle) => caches.delete(cle))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'activer-maintenant') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const requete = event.request;
  if (requete.method !== 'GET') return;
  const url = new URL(requete.url);
  const externe = HOTES_EXTERNES.includes(url.hostname);
  if (url.origin !== self.location.origin && !externe) return;

  // Navigation : réseau d'abord, cache ensuite, pour récupérer les mises à jour
  if (requete.mode === 'navigate') {
    event.respondWith(
      fetch(requete)
        .then((reponse) => {
          const copie = reponse.clone();
          caches.open(VERSION).then((cache) => cache.put('./index.html', copie));
          return reponse;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))),
    );
    return;
  }

  // Le reste : cache d'abord, puis rafraîchissement en arrière-plan
  event.respondWith(
    caches.match(requete).then((enCache) => {
      const reseau = fetch(requete)
        .then((reponse) => {
          if (reponse && (reponse.ok || reponse.type === 'opaque')) {
            const copie = reponse.clone();
            caches.open(VERSION).then((cache) => cache.put(requete, copie));
          }
          return reponse;
        })
        .catch(() => enCache);
      return enCache || reseau;
    }),
  );
});
