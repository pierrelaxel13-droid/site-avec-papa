/* ==========================================================================
   Pierrel & Co — service worker
   --------------------------------------------------------------------------
   Il sert à deux choses, et à rien d'autre :

   1. rendre l'application installable. Chrome ne propose « Installer » que si
      un service worker avec un gestionnaire « fetch » est enregistré ;
   2. garder le site consultable hors ligne, ce qui compte sur un chantier ou
      dans un entrepôt où le réseau tombe.

   Deux stratégies, et le choix n'est pas anodin :

   - les pages (navigations) passent par le réseau d'abord. Une page de veille
     servie depuis un cache périmé afficherait des obligations dépassées : le
     cache n'est qu'un filet pour le hors-ligne ;
   - les fichiers d'habillage (CSS, scripts, polices, images) passent par le
     cache d'abord. Ils portent le nom de la version dans CACHE, donc une
     nouvelle publication les remplace en bloc.

   Il n'y a pas de serveur derrière : ce fichier ne protège rien et ne cache
   rien de confidentiel. Il ne met en cache que ce qui est déjà public.
   ========================================================================== */

const CACHE = "pco-v3";
const HORS_LIGNE = "accueil.html";

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // On pré-charge le strict nécessaire pour que la première ouverture hors
    // ligne ne soit pas une page blanche. Les erreurs sont ignorées : un
    // fichier manquant ne doit pas empêcher l'installation.
    await Promise.allSettled([
      c.add(HORS_LIGNE),
      c.add("assets/site.css"),
      c.add("assets/polices.css"),
      c.add("assets/polices/plus-jakarta-sans.woff2"),
      c.add("assets/app.js"),
      c.add("assets/theme.js")
    ]);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const nom of await caches.keys()) {
      if (nom !== CACHE) await caches.delete(nom);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // rien d'extérieur, ici

  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const reponse = await fetch(req);
        const c = await caches.open(CACHE);
        c.put(req, reponse.clone());
        return reponse;
      } catch (err) {
        return (await caches.match(req)) ||
               (await caches.match(HORS_LIGNE)) ||
               new Response("Hors ligne, et cette page n'est pas en cache.",
                 { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const connu = await caches.match(req);
    if (connu) return connu;
    const reponse = await fetch(req);
    if (reponse.ok) {
      const c = await caches.open(CACHE);
      c.put(req, reponse.clone());
    }
    return reponse;
  })());
});
