/* ==========================================================================
   Les tests du tri du robot (outils/tri.mjs), sur des titres RÉELS
   --------------------------------------------------------------------------
   Chaque cas vient du relevé du 29 octobre 2026 : ce qui était mal rangé
   doit rester écarté, ce qui était bien rangé doit le rester.
   Lancer : node outils/tri.test.mjs
   ========================================================================== */
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { rattache, ficheAncienne, dateDuTitre } from "./tri.mjs";

const c = { window: {} };
vm.runInNewContext(readFileSync(new URL("../assets/referentiel.js", import.meta.url), "utf8"), c);
const V = c.window.VEILLE;

let n = 0, echecs = 0;
const ok = (cond, quoi) => { n++; if (cond) console.log("ok :", quoi); else { echecs++; console.log("ÉCHEC :", quoi); } };
const sujets = (titre, source = "jorf") => rattache(V, titre, source).map((d) => d.id);

/* --- Ce qui doit être écarté --- */
const ecartes = [
  ["Arrêté du 26 octobre 2026 fixant la liste des personnes autorisées à exercer en France la profession de médecin dans la spécialité « médecine générale »", "liste nominative de médecins"],
  ["Avis relatif à la tarification de l'aliment de nutrition entérale PEPTAMEN JUNIOR ADVANCE visé à l'article L. 165-1 du code de la sécurité sociale", "prix d'un aliment précis (rangé en paie avant)"],
  ["Avis relatif à la tarification des pansements alginates ALGOSTERIL visés à l'article L. 165-1 du code de la sécurité sociale", "prix d'un pansement précis"],
  ["Arrêté du 23 octobre 2026 relatif à l'affectation, en vue de l'accomplissement d'un parcours de consolidation des compétences, de praticiens associés", "affectation de praticiens"],
  ["Conclusions d'évaluation: Autorisation de mise sur le marché d'un produit phytopharmaceutique - ELECTIS K-PLUS", "un produit phytopharmaceutique précis"],
  ["Arrêté du 7 octobre 2026 fixant pour les années 2026, 2027 et 2028 le nombre maximal de brevets de l'enseignement militaire supérieur délivrés au titre du ministère de la transition écologique", "nombre de brevets (et nom de ministère)"]
];
for (const [titre, quoi] of ecartes) ok(sujets(titre).length === 0, `écarté : ${quoi}`);

ok(sujets("Cookies born to be high — Boomz", "rappelconso").length === 0, "écarté : un biscuit « Cookies » rappelé n'est pas du RGPD");
ok(!sujets("Delta 9 gummies infused 10mg — Cookies", "rappelconso").includes("rgpd"), "un rappel de produit ne va jamais en RGPD");
ok(!sujets("BâtiZoom : Baromètre de la transition écologique du bâtiment en 2025", "ademe").includes("env_general"),
  "« transition écologique » seule ne range plus en environnement");

/* --- Ce qui doit rester, au bon endroit --- */
const gardes = [
  ["Décret n° 2026-973 du 20 octobre 2026 modifiant l'article L. 136-1-1 du code de la sécurité sociale", "paie", "un décret CSG reste en paie"],
  ["Décret n° 2026-974 du 20 octobre 2026 fixant les plafonds prévus au e du 4° du III de l'article L. 136-1-1 du code de la sécurité sociale", "paie", "les plafonds CSG restent en paie"],
  ["Cookies et application mobile : sanctions de 7 millions d'euros à l'encontre des sociétés FNAC DARTY PARTICIPATIONS ET SERVICES et FNAC DIRECT", "rgpd", "la sanction CNIL sur les cookies reste en RGPD"],
  ["Arrêté du 20 octobre 2026 modifiant l'arrêté du 23 novembre 2022 portant cahiers des charges des éco-organismes", "dechets", "un cahier des charges d'éco-organismes reste en déchets"],
  ["Arrêté du 14 octobre 2026 relatif aux modalités d'organisation du vote électronique par internet pour l'élection des représentants du personnel", "social", "le vote des représentants du personnel reste en social"],
  ["Avis relatif à l'extension d'un accord territorial (Grand Est) conclu dans le cadre de la convention collective nationale des industries de carrières et matériaux", "extractive", "la convention des carrières reste en extraction"]
];
for (const [titre, id, quoi] of gardes) ok(sujets(titre).includes(id), quoi);
ok(sujets("Arrêté du 14 août 2012 relatif aux conditions de mesurage des niveaux d’empoussièrement, aux conditions de contrôle du respect de la valeur limite d’exposition professionnelle aux fibres d’amiante").includes("amiante"),
  "l'apostrophe typographique ne gêne plus (« fibres d’amiante »)");

/* --- Les anciens textes renvoyés par les archives --- */
ok(ficheAncienne("Arrêté du 26 juin 2006 pris pour l'application des articles R. 163-2 et R. 165-1", "", "2026-10-28"), "une fiche de 2006 dans l'archive du 28 octobre 2026 : ancienne");
ok(ficheAncienne("LOI n° 2025-1403 du 30 décembre 2025 de financement de la sécurité sociale pour 2026 (1)", "", "2026-10-28"), "la LFSS 2026, renvoyée en octobre 2026 : ancienne");
ok(ficheAncienne("Décret n°55-663 du 20 mai 1955 relatif à l'exercice du privilège", "1955-05-20", "2026-10-27"), "un décret de 1955 : ancien");
ok(!ficheAncienne("Délibération n° 2026-091 du 3 septembre 2026 portant avis sur un projet de décret", "", "2026-10-26"), "une délibération CNIL publiée deux mois après : gardée");
ok(!ficheAncienne("Décret n° 2026-1006 du 28 octobre 2026 modifiant la liste des classes thérapeutiques", "2026-10-28", "2026-10-28"), "un décret du jour : gardé");
ok(!ficheAncienne("Biodéchets : comprendre et agir", "", "2026-10-28"), "sans date dans le titre ni ailleurs : on ne juge pas");
ok(dateDuTitre("Arrêté du 1er juin 2023 relatif au traitement") === "2023-06-01", "la date du titre se lit (1er juin 2023)");

console.log(`\n${n - echecs}/${n} vérifications passées`);
process.exit(echecs ? 1 : 0);
