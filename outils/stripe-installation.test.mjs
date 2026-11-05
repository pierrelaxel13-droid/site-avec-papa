/* L'installation Stripe contre un faux Stripe : tout est créé une fois, puis repris. */
import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { installer, clientStripe, reecrire, formulaire } from "./stripe-installation.mjs";

assert.equal(formulaire({ a: { b: 1 }, c: [{ d: 2 }] }).toString(), "a%5Bb%5D=1&c%5B0%5D%5Bd%5D=2");

const base = { products: [], prices: [], payment_links: [], configs: [] };
let n = 0, posts = [];
const srv = http.createServer((q, r) => {
  let corps = ""; q.on("data", (d) => (corps += d)); q.on("end", () => {
    const u = new URL(q.url, "http://x"), p = new URLSearchParams(corps);
    const meta = (prefixe = "metadata") => Object.fromEntries([...p].filter(([k]) => k.startsWith(prefixe + "[")).map(([k, v]) => [k.slice(prefixe.length + 1, -1), v]));
    const liste = (l) => ({ data: l, has_more: false });
    let rep;
    if (q.method === "GET") rep = liste({ "/v1/products": base.products, "/v1/prices": base.prices, "/v1/payment_links": base.payment_links,
      "/v1/billing_portal/configurations": base.configs }[u.pathname] || []);
    else {
      posts.push(u.pathname);
      if (u.pathname === "/v1/products") base.products.push(rep = { id: "prod_" + ++n, metadata: meta() });
      else if (u.pathname === "/v1/prices") base.prices.push(rep = { id: "price_" + ++n, product: p.get("product"), currency: p.get("currency"),
        unit_amount: Number(p.get("unit_amount")), recurring: { interval: p.get("recurring[interval]") } });
      else if (u.pathname === "/v1/payment_links") {
        assert.equal(p.get("after_completion[redirect][url]"), "https://vigie-reglementaire.fr/compte/paiement.html?merci=1");
        assert.equal(p.get("payment_method_types[1]"), "sepa_debit");
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
assert.equal(base.products.length, 3); assert.equal(base.prices.length, 6); assert.equal(base.payment_links.length, 6);
assert.equal(base.prices.find((x) => x.unit_amount === 86900).recurring.interval, "year");
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
const w = {}; new Function("window", nouveau)(w); assert.equal(Object.keys(w.PAIEMENT).length, 4);
console.log("stripe-installation : ok");
