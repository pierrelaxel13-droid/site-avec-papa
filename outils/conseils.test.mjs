/* ==========================================================================
   Les tests des conseils de l'IA (outils/conseils.mjs) — sans réseau
   --------------------------------------------------------------------------
   Les réponses de Perplexity et les pages des sources sont simulées : rien ne
   part, rien ne coûte. Lancer : node outils/conseils.test.mjs
   ========================================================================== */
import { demander, nettoyer, controler, traiter, question, officiel, SITES_OFFICIELS } from "./conseils.mjs";

let n = 0, echecs = 0;
const ok = (c, quoi) => { n++; if (c) console.log("ok :", quoi); else { echecs++; console.log("ÉCHEC :", quoi); } };

const TEXTE = { id: "JORFTEXT000099", titre: "Arrêté du 20 octobre 2026 relatif aux vérifications des échafaudages",
  dateTexte: "2026-10-20", lien: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000099",
  domaines: [{ id: "levage", nom: "Équipements de travail, levage et vérifications" }], corps: "Article 1er…" };

/* --- Ce qui part chez Perplexity --- */
let envoye = null;
const fauxPerplexity = (reponse, statut = 200) => async (url, init) => {
  envoye = { url, init, corps: JSON.parse(init.body) };
  return { ok: statut < 300, status: statut, json: async () => reponse };
};
await demander(TEXTE, { cle: "cle-de-test", fetch: fauxPerplexity({ choices: [{ message: { content: "x" } }] }) });
ok(envoye.url === "https://api.perplexity.ai/chat/completions" && envoye.init.headers.Authorization === "Bearer cle-de-test", "la question part à l'API de Perplexity, avec la clé");
ok(envoye.corps.search_domain_filter.length <= 20 && envoye.corps.search_domain_filter.includes("legifrance.gouv.fr"), `la recherche est limitée à ${SITES_OFFICIELS.length} sites officiels (20 au plus)`);
const tout = JSON.stringify(envoye.corps);
ok(tout.includes(TEXTE.titre) && tout.includes(TEXTE.lien), "elle porte le titre et le lien du texte officiel");
ok(!/corps|Article 1er|@|entreprise_id|Vidal/.test(question(TEXTE)), "et rien d'autre : ni le texte entier, ni une donnée de client");
ok(/conseil juridique/.test(tout) && /N'invente rien/.test(tout) && /sources officielles/.test(tout), "la consigne interdit d'inventer et de donner un conseil juridique");

/* --- Ce qui revient --- */
const reponse = {
  choices: [{ message: { content: "**À faire** :\n- Vérifier les échafaudages roulants après chaque déplacement [1].\n- Former le personnel [2]. Voir https://blog-pas-officiel.fr/article\n- Tenir le registre de sécurité [1][3]." } }],
  search_results: [
    { title: "Arrêté du 20 octobre 2026", url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000099" },
    { title: "Blog", url: "https://blog-pas-officiel.fr/article" },
    { title: "INRS — échafaudages", url: "https://www.inrs.fr/risques/echafaudages.html" },
    { title: "Page morte", url: "https://www.travail-emploi.gouv.fr/page-supprimee" },
    { title: "Faux site", url: "https://legifrance.gouv.fr.attaquant.com/x" }
  ],
  usage: { cost: { total_cost: 0.0061 } }
};
const r = await demander(TEXTE, { cle: "k", fetch: fauxPerplexity(reponse) });
ok(r.ok && r.cout === 0.0061 && r.sources.length === 5, "la réponse, ses sources et son coût sont lus");

const verifier = async (url) => !/page-supprimee/.test(url);
const c = await controler(r, { verifier });
ok(!!c.garde, "une réponse avec des sources officielles valables est gardée");
ok(c.garde.sources.map((s) => s.url).join() === "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000099,https://www.inrs.fr/risques/echafaudages.html",
  "seules restent les sources officielles qui répondent (pas le blog, pas la page morte, pas le faux sous-domaine)");
ok(!/https?:|\[\d|blog-pas-officiel|\*\*/.test(c.garde.texte), "le texte ne garde ni lien, ni renvoi [1], ni mise en forme");
ok(/^À faire :/.test(c.garde.texte) && c.garde.texte.includes("• Vérifier"), "il reste lisible : « À faire : », puis des points (l'espace avant « : » reste)");

ok(officiel("https://entreprendre.service-public.fr/vosdroits/F123") && !officiel("http://www.inrs.fr/x") && !officiel("https://inrs.fr.evil.com/"),
  "un sous-domaine officiel passe ; le http et les faux domaines non");

const sansSource = await controler({ texte: "Un conseil assez long pour être lu par quelqu'un, mais sans source.", sources: [{ url: "https://exemple.com" }] }, { verifier });
ok(sansSource.ecarte === "aucune source officielle valable", "une réponse sans source officielle valable est jetée");
const vide = await controler({ texte: "[1]", sources: reponse.search_results }, { verifier });
ok(!!vide.ecarte, "une réponse vide est jetée");

/* --- Un passage du robot --- */
const releve = { textes: [TEXTE, { ...TEXTE, id: "B" }, { ...TEXTE, id: "C" }, { ...TEXTE, id: "D" }] };
let appels = 0;
const demande = async () => { appels++; return r; };
const controle = (x) => controler(x, { verifier });
const conseils = { VIEUX: { le: "2026-10-01T00:00:00Z", texte: "…", sources: [] } };

const sans = await traiter(releve, conseils, { cle: "", demande, controle });
ok(sans.sansCle && appels === 0, "sans clé : aucune question, et le passage le dit");
ok(!conseils.VIEUX, "un conseil dont le texte a quitté le relevé est oublié");

const p1 = await traiter(releve, conseils, { cle: "k", plafond: 2, demande, controle, maintenant: "2026-10-31T10:00:00Z" });
ok(appels === 2 && p1.bilan.gardes === 2 && p1.bilan.attente === 2, "plafond par passage : 2 questions, 2 en attente");
ok(Math.abs(p1.bilan.cout - 0.0122) < 1e-9, "le coût réel du passage est compté");
await traiter(releve, conseils, { cle: "k", plafond: 10, demande, controle, maintenant: "2026-10-31T11:00:00Z" });
ok(appels === 4, "au passage suivant, seuls les textes sans conseil sont demandés");
await traiter(releve, conseils, { cle: "k", plafond: 10, demande, controle, maintenant: "2026-10-31T12:00:00Z" });
ok(appels === 4, "un texte qui a son conseil n'est jamais redemandé");

conseils.B = { le: "2026-10-30T00:00:00Z", ecarte: "aucune source officielle valable" };
await traiter(releve, conseils, { cle: "k", demande, controle, maintenant: "2026-10-31T13:00:00Z" });
ok(appels === 4, "une réponse écartée n'est pas redemandée avant une semaine");
await traiter(releve, conseils, { cle: "k", demande, controle, maintenant: "2026-11-08T13:00:00Z" });
ok(appels === 5 && conseils.B.texte, "au bout d'une semaine, elle l'est");

const erreur = await traiter({ textes: [{ ...TEXTE, id: "E" }] }, {}, { cle: "k", demande: async () => ({ ok: false, erreur: "HTTP 401" }), controle });
ok(erreur.bilan.erreurs === 1 && erreur.bilan.derniereErreur === "HTTP 401", "une erreur de l'API est comptée et dite, sans rien casser");

console.log(`\n${n - echecs}/${n} vérifications passées`);
process.exit(echecs ? 1 : 0);
