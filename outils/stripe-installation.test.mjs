/* L'installation Stripe contre un faux Stripe : tout est créé une fois, puis repris. */
import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { installer, clientStripe, reecrire, formulaire, CONSULTANT, OFFRES } from "./stripe-installation.mjs";

assert.equal(formulaire({ a: { b: 1 }, c: [{ d: 2 }] }).toString(), "a%5Bb%5D=1&c%5B0%5D%5Bd%5D=2");

// Ce que l'installation du 5 novembre avait posé : un prix hors taxes et son lien, à désactiver.
const base = { products: [], prices: [{ id: "price_vieux", product: "prod_x", currency: "eur", unit_amount: 3900, tax_behavior: "exclusive",
  recurring: { interval: "month" }, metadata: { formule: "textes", periode: "mois" } },
  { id: "price_axel", product: "prod_x", currency: "eur", unit_amount: 3900, recurring: { interval: "month" }, metadata: {} }],
  payment_links: [{ id: "plink_vieux", url: "https://buy.stripe.com/vieux", metadata: { formule: "textes", periode: "mois", prix: "price_vieux" } }], configs: [] };
let n = 0, posts = [], desactives = [];
const srv = http.createServer((q, r) => {
  let corps = ""; q.on("data", (d) => (corps += d)); q.on("end", () => {
    const u = new URL(q.url, "http://x"), p = new URLSearchParams(corps);
    const meta = (prefixe = "metadata") => Object.fromEntries([...p].filter(([k]) => k.startsWith(prefixe + "[")).map(([k, v]) => [k.slice(prefixe.length + 1, -1), v]));
    const liste = (l) => ({ data: l, has_more: false });
    let rep;
    if (q.method === "POST" && /^\/v1\/(prices|payment_links)\/[a-z_]+$/.test(u.pathname)) { desactives.push([u.pathname, p.get("active")]);
      const [, t, id] = u.pathname.match(/^\/v1\/(prices|payment_links)\/(.+)$/); const l = base[t]; l.splice(l.findIndex((x) => x.id === id), 1); }
    if (q.method === "GET") rep = liste({ "/v1/products": base.products, "/v1/prices": base.prices, "/v1/payment_links": base.payment_links,
      "/v1/billing_portal/configurations": base.configs }[u.pathname] || []);
    else {
      posts.push(u.pathname);
      if (u.pathname === "/v1/products") base.products.push(rep = { id: "prod_" + ++n, metadata: meta() });
      else if (u.pathname === "/v1/prices") base.prices.push(rep = { id: "price_" + ++n, product: p.get("product"), currency: p.get("currency"),
        unit_amount: Number(p.get("unit_amount")), tax_behavior: p.get("tax_behavior"), metadata: meta(), recurring: { interval: p.get("recurring[interval]") } });
      else if (u.pathname === "/v1/payment_links") {
        assert.equal(p.get("after_completion[redirect][url]"), p.get("metadata[formule]") === "consultant"
          ? "https://vigie-reglementaire.fr/compte/paiement-consultant.html?merci=1" : "https://vigie-reglementaire.fr/compte/paiement.html?merci=1");
        if (p.get("metadata[formule]") === "consultant") {
          assert.equal(p.get("line_items[0][adjustable_quantity][enabled]"), "true");
          assert.ok(Number(p.get("line_items[0][adjustable_quantity][minimum]")) >= 3);
        }
        assert.equal(p.get("payment_method_types[0]"), null, "les moyens de paiement viennent du tableau de bord Stripe");
        base.payment_links.push(rep = { id: "plink_" + ++n, url: "https://buy.stripe.com/test_" + n, metadata: meta() });
      } else if (u.pathname.startsWith("/v1/billing_portal/configurations")) {
        assert.equal(p.get("features[subscription_cancel][mode]"), "at_period_end");
        rep = { id: "bpc_1", metadata: meta(), login_page: { url: "https://billing.stripe.com/p/login/test_x" } };
        if (!base.configs.length) base.configs.push(rep);
      }
    }
    r.writeHead(200, { "content-type": "application/json" }); r.end(JSON.stringify(rep || {}));
  });
});
await new Promise((ok) => srv.listen(0, ok));
const stripe = clientStripe("rk_test_essai", `http://localhost:${srv.address().port}`);
const b1 = await installer(stripe);
assert.equal(base.products.length, 4); assert.equal(base.prices.length, 1 + 9); assert.equal(base.payment_links.length, 9);
// Prix TTC, TVA comprise : la page Stripe affiche ce que le client paie.
assert.ok(base.prices.slice(1).every((x) => x.tax_behavior === "inclusive"));
assert.ok(base.prices.some((x) => x.unit_amount === 4680 && x.recurring.interval === "month"), "39 € HT → 46,80 € TTC");
assert.ok(base.prices.some((x) => x.unit_amount === 104280 && x.recurring.interval === "year"), "869 € HT → 1 042,80 € TTC");
assert.deepEqual(desactives, [["/v1/payment_links/plink_vieux", "false"], ["/v1/prices/price_vieux", "false"]],
  "les anciens lien et prix hors taxes de l'outil sont désactivés ; le prix créé à la main n'est pas touché");
assert.deepEqual(Object.keys(b1.liens.consultant), ["p1", "p2", "p3"]);
assert.ok(base.prices.some((x) => x.unit_amount === 5040 && x.recurring.interval === "month"), "42 € HT → 50,40 € TTC");

assert.equal(b1.portail, "https://billing.stripe.com/p/login/test_x");
assert.match(b1.liens.complet.mois, /^https:\/\/buy\.stripe\.com\//);
posts = [];
const b2 = await installer(stripe);
assert.deepEqual(posts, ["/v1/billing_portal/configurations/bpc_1"], "deuxième passage : rien n'est recréé");
assert.deepEqual(b2.liens, b1.liens);
srv.close();

const source = await readFile(new URL("../contenu/paiement.js", import.meta.url), "utf8");
const nouveau = reecrire(source, b1.liens, b1.portail);
assert.match(nouveau, /complet: \{ an: "https:\/\/buy\.stripe\.com\/test_\d+", mois: "https:\/\/buy\.stripe\.com\/test_\d+" \}/);
assert.match(nouveau, /portail: "https:\/\/billing\.stripe\.com\/p\/login\/test_x"/);
assert.match(nouveau, /CE QU'IL FAUT RÉGLER DANS STRIPE/, "le mode d'emploi en tête du fichier est gardé");
const w = {}; new Function("window", nouveau)(w); assert.equal(Object.keys(w.PAIEMENT).length, 5);
assert.match(w.PAIEMENT.consultant.p2, /^https:\/\/buy\.stripe\.com\//);
// Les prix de l'outil sont ceux du site.
const build = await readFile(new URL("../build.mjs", import.meta.url), "utf8");
for (const p of CONSULTANT.paliers) assert.match(build, new RegExp(`\\{ de: ${p.de}, a: ${p.a}, mois: ${p.mois},`));
for (const [f, o] of Object.entries(OFFRES)) assert.match(build, new RegExp(`${f}:[^\\n]*mois: ${o.mois}, an: ${o.an}`));
console.log("stripe-installation : ok");
