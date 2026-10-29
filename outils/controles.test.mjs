/* Les tests des contrôles du robot (outils/controles.mjs).
   node outils/controles.test.mjs — code de sortie 1 au moindre échec. */
import { controle } from "./controles.mjs";

let n = 0, echecs = 0;
const ok = (c, quoi) => { n++; if (c) console.log("ok :", quoi); else { echecs++; console.log("ÉCHEC :", quoi); } };
const sources = [{ id: "jorf", confirme: true }, { id: "cnil", confirme: true }, { id: "inrs" }];
const texte = (source, i, vuLe = "2026-10-28") => ({ id: `${source}-${i}`, source, titre: `Texte ${source} ${i}`, vuLe, date: vuLe });
const base = (extra = {}) => ({ sources, depuis: "2026-10-15", aujourdhui: "2026-10-29", joDernier: "2026-10-29", ...extra });
const niveaux = (r) => r.alertes.map((a) => a.niveau + ":" + a.source);

// 1. Un passage normal : rien à dire.
{
  const avant = [...Array(12)].map((_, i) => texte("jorf", i));
  const propres = [...avant, texte("jorf", 99)];
  const r = controle(base({ rapport: [{ id: "jorf", nom: "JO", entrees: 13, retenus: 13 }], propres, avant }));
  ok(r.alertes.length === 0, "passage normal : aucune alerte");
  ok(r.nouveaux === 1, "il compte le texte nouveau");
}
// 2. Une source vérifiée muette : attention ; une non vérifiée : rien.
{
  const r = controle(base({ rapport: [{ id: "cnil", nom: "CNIL", entrees: 0, retenus: 0, souci: "injoignable" },
    { id: "inrs", nom: "INRS", entrees: 0, retenus: 0, souci: "format" }], propres: [texte("jorf", 1)], avant: [] }));
  ok(niveaux(r).join() === "attention:cnil", "source vérifiée muette : attention ; source non vérifiée : rien");
}
// 3. Une source qui répond vide alors qu'elle avait des textes.
{
  const r = controle(base({ rapport: [{ id: "cnil", nom: "CNIL", entrees: 0, retenus: 0 }],
    propres: [texte("jorf", 1)], avant: [texte("cnil", 1), texte("cnil", 2)] }));
  ok(r.alertes.some((a) => a.source === "cnil" && /format a peut-être changé/.test(a.quoi)), "réponse vide après des textes : « format changé ? »");
}
// 4. Une chute de plus de moitié : alerte, et les textes sont gardés.
{
  const avant = [...Array(20)].map((_, i) => texte("cnil", i));
  const propres = avant.slice(0, 5);
  const rapport = [{ id: "cnil", nom: "CNIL", entrees: 5, retenus: 5 }];
  const r = controle(base({ rapport, propres, avant }));
  ok(propres.length === 20 && rapport[0].repris === 15, "chute de 20 à 5 : les 15 manquants sont gardés");
  ok(r.alertes.some((a) => /passée de 20 à 5/.test(a.quoi)), "et c'est dit");
}
// 5. Les textes sortis de la fenêtre ne comptent pas.
{
  const avant = [...Array(20)].map((_, i) => texte("cnil", i, "2026-10-01"));
  const propres = [texte("cnil", 99)];
  const r = controle(base({ rapport: [{ id: "cnil", nom: "CNIL", entrees: 1, retenus: 1 }], propres, avant }));
  ok(r.alertes.length === 0 && propres.length === 1, "des textes sortis de la fenêtre de 14 jours ne déclenchent rien");
}
// 6. Le Journal officiel : trois jours sans, grave ; deux jours, rien.
{
  const r3 = controle(base({ rapport: [], propres: [texte("jorf", 1)], avant: [], joDernier: "2026-10-25" }));
  ok(niveaux(r3).includes("grave:jorf"), "pas de JO depuis 4 jours : grave");
  const r2 = controle(base({ rapport: [], propres: [texte("jorf", 1)], avant: [], joDernier: "2026-10-27" }));
  ok(!niveaux(r2).includes("grave:jorf"), "dernier JO avant-hier : rien de grave");
  const r0 = controle(base({ rapport: [], propres: [texte("jorf", 1)], avant: [], joDernier: "" }));
  ok(niveaux(r0).includes("grave:jorf"), "aucun JO connu du tout : grave");
}
// 7. Tout le relevé qui s'effondre.
{
  const avant = [...Array(40)].map((_, i) => texte(i % 2 ? "jorf" : "inrs", i));
  const propres = avant.slice(0, 10);
  const r = controle(base({ rapport: [], propres, avant }));
  ok(r.alertes.some((a) => a.niveau === "grave" && /de 40 à 10/.test(a.quoi)), "relevé de 40 à 10 textes : grave");
  ok(propres.length === 40, "et les 30 manquants sont gardés : le site ne perd rien");
}
// 8. Une date à venir.
{
  const futur = { ...texte("cnil", 1), dateTexte: "2027-03-01" };
  const r = controle(base({ rapport: [], propres: [texte("jorf", 1), futur], avant: [] }));
  ok(r.alertes.some((a) => /date à venir/.test(a.quoi)), "un texte daté de 2027 : signalé");
}

console.log(`\n${n - echecs}/${n} contrôles vérifiés`);
process.exit(echecs ? 1 : 0);
