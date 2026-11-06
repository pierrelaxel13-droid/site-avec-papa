/* Les e-mails automatiques : leur contenu, et l'échappement de ce qui vient des utilisateurs. */
import assert from "node:assert/strict";
import { gabarit } from "./courriels.mjs";
const i = gabarit("invitation", { jeton: "abc123", espace: "Boulangerie <Durand>", cabinet: "Cabinet Martin", type: "entreprise", role: "admin", par: "c@test.fr" });
assert.match(i.html, /compte\/invitation\.html#jeton=abc123/);
assert.match(i.html, /Boulangerie &lt;Durand&gt;/);
assert.doesNotMatch(i.html, /<Durand>/);
assert.match(i.sujet, /Boulangerie <Durand>/);
assert.match(i.texte, /valable 7 jours/);
assert.match(i.html, /Cabinet Martin/);
const c = gabarit("invitation", { jeton: "x", espace: "Cabinet Martin", type: "cabinet", role: "membre" });
assert.match(c.sujet, /rejoindre « Cabinet Martin »/);
const f = gabarit("facture", { numero: "VR-2026-0001", emise_le: "2026-11-05", montant_ttc: 70.8, espace: "Boulangerie Durand" });
assert.match(f.sujet, /VR-2026-0001/);
assert.match(f.html, /70,80 € TTC/);
assert.match(f.html, /5 novembre 2026/);
assert.throws(() => gabarit("autre", {}));
{
  const g = gabarit("nouveau_compte", { espace: "BBBB", type: "entreprise", courriel: "x@y.fr", le: "2026-11-06T15:00:00Z" });
  if (!/Nouveau compte : BBBB \(entreprise\)/.test(g.sujet) || !/x@y\.fr/.test(g.html) || !/x@y\.fr/.test(g.texte)) throw new Error("gabarit nouveau_compte");
}
console.log("courriels : ok");
