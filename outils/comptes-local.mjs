/* ==========================================================================
   Essayer les comptes sans Cloudflare
   --------------------------------------------------------------------------
   Imite Cloudflare Pages sur ce poste : sert _site/, passe /app/ par
   functions/app/_middleware.js et /api/… par functions/api/, avec un faux
   stockage KV (en mémoire) et un faux Stripe :
     - le paiement « cs_test_paye » est un abonnement « Textes et suivi » au
       mois (99 €), payé par client@exemple.fr ; « cs_test_annuel », une
       « Veille complète » à l'année (1 490 €), payée par annuel@exemple.fr ;
     - /__abo?montant=14900&statut=active règle l'abonnement de ce client ;
     - l'administrateur est admin@exemple.fr ; les courriels ne partent pas,
       /__courriels les montre (le lien « nouveau mot de passe » y est).
   Usage :
     node build.mjs
     node outils/comptes-local.mjs 8820
     puis ouvrir http://localhost:8820/compte/bienvenue.html?session=cs_test_paye
   ========================================================================== */
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const DEPOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."), SITE = join(DEPOT, "_site"), ICI = join(tmpdir(), "pco-comptes-local");
const PORT = Number(process.argv[2] || 8820);

// Les fonctions, recopiées en .mjs avec le chemin du serveur rendu absolu.
async function charge(rel) {
  const src = (await readFile(join(DEPOT, "functions", rel), "utf8"))
    .replace(/"(\.\.\/)+serveur\/compte\.mjs"/g, JSON.stringify(join(DEPOT, "serveur/compte.mjs")));
  const f = join(ICI, "fn", rel.replace(/\.js$/, ".mjs"));
  await mkdir(dirname(f), { recursive: true }); await writeFile(f, src);
  return import(f + "?t=" + Date.now());
}
const routes = {
  "/api/connexion": await charge("api/connexion.js"), "/api/deconnexion": await charge("api/deconnexion.js"),
  "/api/moi": await charge("api/moi.js"), "/api/bienvenue": await charge("api/bienvenue.js"),
  "/api/oubli": await charge("api/oubli.js"), "/api/nouveau": await charge("api/nouveau.js"),
  "/api/admin/comptes": await charge("api/admin/comptes.js")
};
const porte = await charge("app/_middleware.js");

// Faux KV
const kv = new Map();
const env = { STRIPE_SECRET: "rk_test_faux", ADMIN_COURRIEL: "admin@exemple.fr", BREVO_API_KEY: "faux", EXPEDITEUR: "contact@exemple.fr",
  COMPTES: {
    get: async (k) => kv.has(k) ? kv.get(k) : null, put: async (k, v) => { kv.set(k, v); }, delete: async (k) => { kv.delete(k); },
    list: async ({ prefix }) => ({ keys: [...kv.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) } };
// Les courriels « envoyés » : /__courriels les montre.
const courriels = [];
// Faux Stripe : l'abonnement de cus_1 est réglable par /__abo?montant=
let montantAbo = 9900, statutAbo = "active";
const vraiFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u === "https://api.brevo.com/v3/smtp/email") { courriels.push(JSON.parse(opts.body)); return new Response("{}", { status: 201 }); }
  if (!u.startsWith("https://api.stripe.com/")) return vraiFetch(url, opts);
  const rep = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
  if (u.includes("/checkout/sessions/cs_test_paye")) return rep({ mode: "subscription", status: "complete", payment_status: "paid",
    customer: "cus_1", customer_details: { email: "Client@Exemple.fr" }, line_items: { data: [{ price: { unit_amount: 9900 } }] } });
  // Un second client, abonné à l'année (« Veille complète », 1 490 €).
  if (u.includes("/checkout/sessions/cs_test_annuel")) return rep({ mode: "subscription", status: "complete", payment_status: "paid",
    customer: "cus_2", customer_details: { email: "annuel@exemple.fr" }, line_items: { data: [{ price: { unit_amount: 149000 } }] } });
  if (u.includes("/checkout/sessions/")) return rep({ error: { message: "No such checkout session" } }, 404);
  if (u.includes("/subscriptions?customer=cus_2")) return rep({ data: [{ status: "active", items: { data: [{ price: { unit_amount: 149000 } }] } }] });
  if (u.includes("/subscriptions?customer=cus_1")) return rep({ data: [{ status: statutAbo, items: { data: [{ price: { unit_amount: montantAbo } }] } }] });
  return rep({ data: [] });
};

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };
async function statique(chemin) {
  let p = decodeURIComponent(chemin); if (p.endsWith("/")) p += "index.html";
  try { return new Response(await readFile(join(SITE, p)), { headers: { "Content-Type": TYPES[extname(p)] || "application/octet-stream" } }); }
  catch { return new Response("non trouvé", { status: 404 }); }
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === "/__courriels") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(courriels)); return; }
  if (url.pathname === "/__abo") { montantAbo = Number(url.searchParams.get("montant")); statutAbo = url.searchParams.get("statut") || "active"; res.end("ok"); return; }
  const corps = await new Promise((ok) => { const b = []; req.on("data", (c) => b.push(c)); req.on("end", () => ok(Buffer.concat(b))); });
  const requete = new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : corps });
  let reponse;
  const r = routes[url.pathname];
  if (r) {
    const h = r[`onRequest${req.method[0] + req.method.slice(1).toLowerCase()}`] || r.onRequest;
    reponse = h ? await h({ request: requete, env, params: {} }) : new Response("Méthode refusée", { status: 405 });
  } else if (url.pathname.startsWith("/api/")) {
    reponse = new Response("non trouvé", { status: 404 });
  } else if (url.pathname.startsWith("/app")) {
    reponse = await porte.onRequest({ request: requete, env, next: () => statique(url.pathname) });
  } else reponse = await statique(url.pathname);
  const entetes = {};
  reponse.headers.forEach((v, k) => { if (k !== "set-cookie") entetes[k] = v; });
  const cookies = reponse.headers.getSetCookie ? reponse.headers.getSetCookie() : [];
  if (cookies.length) entetes["set-cookie"] = cookies;
  res.writeHead(reponse.status, entetes);
  res.end(Buffer.from(await reponse.arrayBuffer()));
}).listen(PORT, () => console.log("Cloudflare imité sur", PORT));
