/* ==========================================================================
   Les tests des conseils de l'IA (outils/conseils.mjs) — sans réseau
   --------------------------------------------------------------------------
   Les réponses de Perplexity, les pages des sources et les clients sont
   simulés : rien ne part, rien ne coûte. Lancer : node outils/conseils.test.mjs
   ========================================================================== */
import { demander, nettoyer, controler, traiter, besoins, question, officiel, lireReponse, dateDansTexte,
         planClient, referentiel, pageExiste, SITES_OFFICIELS } from "./conseils.mjs";

let n = 0, echecs = 0;
const ok = (c, quoi) => { n++; if (c) console.log("ok :", quoi); else { echecs++; console.log("ÉCHEC :", quoi); } };

const V = referentiel();
const TEXTE = { id: "JORFTEXT000099", titre: "Arrêté du 20 octobre 2026 relatif aux vérifications des échafaudages",
  dateTexte: "2026-10-20", lien: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000099",
  domaines: [{ id: "sst", nom: "Santé et sécurité au travail" }],
  corps: "Article 1er. Les échafaudages roulants sont vérifiés après chaque déplacement. Article 2. Le présent arrêté entre en vigueur le 1er janvier 2027." };

/* --- Ce qui part chez Perplexity (forme de docs.perplexity.ai/api-reference/agent-post) --- */
let envoye = null, appelsApi = 0;
const fauxPerplexity = (reponse, statut = 200, entetes = {}) => async (url, init) => {
  appelsApi++;
  envoye = { url, init, corps: JSON.parse(init.body) };
  const st = typeof statut === "function" ? statut(appelsApi) : statut;
  return { ok: st < 300, status: st, headers: { get: (k) => entetes[k.toLowerCase()] ?? null }, json: async () => reponse };
};
await demander(TEXTE, { cle: "cle-de-test", V, metier: "43", fetch: fauxPerplexity({ status: "completed", output: [] }) });
ok(envoye.url === "https://api.perplexity.ai/v1/agent" && envoye.init.headers.Authorization === "Bearer cle-de-test", "la question part à l'Agent API de Perplexity, avec la clé");
const outil = (envoye.corps.tools || [])[0] || {};
ok(outil.type === "web_search" && outil.search_type === "fast", "la recherche web est demandée (outil web_search, en « fast »)");
ok(outil.filters && outil.filters.search_domain_filter.length <= 20 && outil.filters.search_domain_filter.includes("legifrance.gouv.fr"),
  `la recherche est limitée à ${SITES_OFFICIELS.length} sites officiels (20 au plus)`);
ok(envoye.corps.effort === "low" && typeof envoye.corps.input === "string" && /N'invente rien/.test(envoye.corps.instructions), "effort, consigne (instructions) et question (input)");
const q = envoye.corps.input;
ok(q.includes(TEXTE.titre) && q.includes(TEXTE.lien) && q.includes("Les échafaudages roulants sont vérifiés"),
  "le robot donne le titre, le lien et le début du texte officiel");
ok(q.includes("Le robot de veille l'a rangé dans : Santé et sécurité au travail") && q.includes("DUERP rédigé, daté et mis à jour"),
  "… les sujets où il l'a rangé, et ce que le référentiel fait déjà suivre sur ces sujets");
ok(q.includes("« Travaux de construction spécialisés » (code NAF 43)"), "pour la formule 3 : la famille de métiers, par son nom public");
ok(!/@|Vidal|entreprise_id|denomination|SIRET/i.test(q) && !/Travaux de construction/.test(question(TEXTE, { V })),
  "aucune donnée de client ; sans métier, la question est générale");
const consigne = envoye.corps.instructions;
ok(/conseil juridique/.test(consigne) && /sources officielles/.test(consigne) && /CONCERNE :/.test(consigne) && /QUAND :/.test(consigne),
  "la consigne interdit d'inventer et demande les cases concerne / qui / à faire / quand");

/* --- Ce qui revient --- */
const REPONSE_TEXTE = "CONCERNE : oui\n**QUI** : les entreprises qui montent des échafaudages [web:1].\n**À FAIRE** :\n" +
  "- Vérifier les échafaudages roulants après chaque déplacement [web:1].\n- Former le personnel [web:2]. Voir https://blog-pas-officiel.fr/article\n" +
  "- Tenir le registre de sécurité [web:1][web:3].\nQUAND : 01/01/2027";
const avecTexte = (texte) => ({
  id: "resp_x", object: "response", status: "completed", model: "openai/gpt-5.6-sol", effort: "low@2026-10-01.0",
  output: [
    { type: "search_results", queries: ["échafaudages vérification"], results: [
      { id: 1, title: "Arrêté du 20 octobre 2026", url: "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000099" },
      { id: 2, title: "Blog", url: "https://blog-pas-officiel.fr/article" },
      { id: 3, title: "INRS — échafaudages", url: "https://www.inrs.fr/risques/echafaudages.html" },
      { id: 4, title: "Page morte", url: "https://www.travail-emploi.gouv.fr/page-supprimee" }
    ] },
    { type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: texte,
      annotations: [{ type: "url_citation", title: "Faux site", url: "https://legifrance.gouv.fr.attaquant.com/x" }] }] }
  ],
  usage: { cost: { currency: "USD", total_cost: 0.0061 } }
});
const reponse = avecTexte(REPONSE_TEXTE);
const r = await demander(TEXTE, { cle: "k", fetch: fauxPerplexity(reponse) });
ok(r.ok && r.cout === 0.0061 && r.sources.length === 5 && r.modele === "low@2026-10-01.0", "la réponse, ses sources (résultats et citations), son coût et le réglage utilisé sont lus");
ok(r.forme.sorties.join() === "search_results,message" && !JSON.stringify(r.forme).includes("échafaudages"), "la forme de la réponse se dit sans son contenu");

appelsApi = 0; let attendu = 0;
const r429 = await demander(TEXTE, { cle: "k", fetch: fauxPerplexity(reponse, (k) => (k === 1 ? 429 : 200), { "retry-after": "3" }), attendre: async (ms) => { attendu = ms; } });
ok(r429.ok && appelsApi === 2 && attendu === 3000, "un 429 attend Retry-After (3 s), puis réessaie une fois");
appelsApi = 0;
const r429b = await demander(TEXTE, { cle: "k", fetch: fauxPerplexity({ error: { type: "token_rate_limit_exceeded", message: "TPM" } }, 429), attendre: async () => {} });
ok(!r429b.ok && appelsApi === 2 && /429 token_rate_limit_exceeded/.test(r429b.erreur), "deux 429 de suite : on s'arrête et on dit pourquoi");
const r401 = await demander(TEXTE, { cle: "mauvaise", fetch: fauxPerplexity({ error: { message: "Invalid API key mauvaise" } }, 401) });
ok(!r401.ok && r401.statut === 401 && !r401.erreur.includes("mauvaise"), "une clé refusée : erreur 401, sans jamais redire la clé");
const rInc = await demander(TEXTE, { cle: "k", fetch: fauxPerplexity({ ...reponse, status: "incomplete" }) });
ok(!rInc.ok && /incomplete/.test(rInc.erreur), "une réponse inachevée n'est pas gardée");

/* --- Le robot contrôle chaque case --- */
const lu = lireReponse(REPONSE_TEXTE);
ok(lu.concerne === "oui" && /échafaudages/.test(lu.qui) && lu.points.length === 3 && lu.quand === "01/01/2027", "les cases se lisent, même en gras");
const verifier = async (url) => !/page-supprimee/.test(url);
const c = await controler(r, TEXTE, { verifier });
ok(!!c.garde, "une réponse avec des sources officielles valables est gardée");
ok(c.garde.sources.map((s) => s.url).join() === "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000099,https://www.inrs.fr/risques/echafaudages.html",
  "seules restent les sources officielles qui répondent (pas le blog, pas la page morte, pas le faux sous-domaine)");
ok(!/https?:|\[(web:)?\d|blog-pas-officiel|\*\*/.test(c.garde.texte + c.garde.details.qui), "le texte ne garde ni lien, ni renvoi [web:1], ni mise en forme");
ok(c.garde.texte.split("\n").length === 3 && c.garde.texte.startsWith("• Vérifier") && /^les entreprises/.test(c.garde.details.qui),
  "il reste lisible : qui, puis les points à faire");
ok(c.garde.details.quand === "01/01/2027", "« 01/01/2027 » est gardée : le texte dit « le 1er janvier 2027 »");
const inventee = await controler({ ...r, texte: REPONSE_TEXTE.replace("01/01/2027", "15/03/2027") }, TEXTE, { verifier });
ok(!inventee.garde.details.quand && inventee.garde.details.quandRetire === "15/03/2027", "une date que le texte ne porte pas est retirée");
ok(dateDansTexte("12/05/2026", "applicable au 12 mai 2026") && dateDansTexte("01/08/2026", "dès le 1er août 2026") &&
   !dateDansTexte("02/08/2026", "dès le 1er août 2026") && !dateDansTexte("31/13/2026", "x"), "les dates se reconnaissent écrites en toutes lettres");
const horsSujet = await controler({ ...r, texte: "CONCERNE : non\nQUI : personne.\nÀ FAIRE :\n- rien" }, TEXTE, { verifier });
ok(/à revoir/.test(horsSujet.ecarte) && horsSujet.details.concerne === "non", "« ne concerne pas ce sujet » : pas montré, part à revoir");
const libre = await controler({ ...r, texte: "Les échafaudages roulants doivent être vérifiés après chaque déplacement [1]." }, TEXTE, { verifier });
ok(libre.garde && /^Les échafaudages/.test(libre.garde.texte) && libre.garde.details.concerne === "incertain", "sans les cases, la réponse entière est gardée, nettoyée");

ok(officiel("https://entreprendre.service-public.fr/vosdroits/F123") && !officiel("http://www.inrs.fr/x") && !officiel("https://inrs.fr.evil.com/"),
  "un sous-domaine officiel passe ; le http et les faux domaines non");
const sansSource = await controler({ texte: "Un conseil assez long pour être lu par quelqu'un, mais sans source.", sources: [{ url: "https://exemple.com" }] }, TEXTE, { verifier });
ok(sansSource.ecarte === "aucune source officielle parmi celles citées" && sansSource.details.sources.proposees === 1, "une réponse sans source officielle est jetée, et le robot dit pourquoi");
const mortes = await controler(r, TEXTE, { verifier: async () => false });
ok(mortes.ecarte === "les sources officielles citées ne répondent pas" && mortes.details.sources.officielles === 3,
  "des sources officielles qui ne répondent pas : jetée, avec la raison");
ok(pageExiste(200) && pageExiste(301) && pageExiste(403) && pageExiste(429) && !pageExiste(404) && !pageExiste(410) && !pageExiste(500) && !pageExiste(0),
  "une page existe si elle répond, ou si le site officiel refuse les robots (403) ; pas si elle est absente (404) ou muette");
const vide = await controler({ texte: "[web:1][2]", sources: r.sources }, TEXTE, { verifier });
ok(!!vide.ecarte, "une réponse vide est jetée");
ok(nettoyer("Voir [la page](https://x.fr) [web:2], 3 points :") === "Voir la page, 3 points :", "nettoyer garde l'espace avant « : »");

/* --- Qui paie : seulement pour un texte du plan d'un client en formule 2 ou 3 --- */
// Un sujet que la maçonnerie (43) suit et pas la restauration (56), et l'inverse.
const p43 = planClient(V, { division: "43" }), p56 = planClient(V, { division: "56" });
const que43 = [...p43].find((id) => !p56.has(id)), que56 = [...p56].find((id) => !p43.has(id));
const nul = Object.keys(V.domaines).find((id) => !p43.has(id) && !p56.has(id));
ok(que43 && que56 && nul, "le référentiel a des sujets propres à chaque métier");
const t = (id, dom) => ({ ...TEXTE, id, domaines: [{ id: dom, nom: V.domaines[dom].nom }] });
const releve = { textes: [t("COMMUN", "sst"), t("MACON", que43), t("RESTO", que56), t("PERSONNE", nul)] };
const cles = (liste) => liste.map((b) => `${b.t.id}|${b.metier}`).join(" ");

ok(besoins(V, releve, []).length === 0, "sans client : rien à demander");
ok(cles(besoins(V, releve, [{ division: "43", rang: 2, contexte: [] }])) === "COMMUN| MACON|",
  "un client en formule 2 (maçonnerie) : le conseil général des textes de SON plan, rien d'autre");
ok(cles(besoins(V, releve, [{ division: "43", rang: 3, contexte: [] }, { division: "56", rang: 3, contexte: [] }])) ===
   "COMMUN| COMMUN|43 COMMUN|56 MACON| MACON|43 RESTO| RESTO|56",
  "des clients en formule 3 : en plus, un conseil pour chaque métier que le texte touche");
const situ = V.declencheurs.find((x) => x.domaines.includes(nul));
if (situ) ok(cles(besoins(V, releve, [{ division: "43", rang: 2, contexte: [situ.id] }])).includes("PERSONNE|"),
  `une situation cochée (« ${situ.id} ») ajoute ses sujets au plan, comme sur le site`);

/* --- Un passage du robot --- */
let appels = 0;
const demande = async () => { appels++; return r; };
const controle = (x, texte) => controler(x, texte, { verifier });
const clients = [{ division: "43", rang: 3, contexte: [] }];

const personne = await traiter(releve, [], [], { V, cle: "k", demande, controle });
ok(personne.sansClient && appels === 0 && personne.lignes.length === 0, "aucun client : aucune question, zéro centime");
const sans = await traiter(releve, [], clients, { V, cle: "", demande, controle });
ok(sans.sansCle && appels === 0 && sans.bilan.aDemander === 4, "sans clé : aucune question, et le passage dit combien attendent");

const p1 = await traiter(releve, [], clients, { V, cle: "k", plafond: 3, demande, controle, maintenant: "2026-10-31T10:00:00Z" });
ok(appels === 3 && p1.bilan.gardes === 3 && p1.bilan.attente === 1 && p1.lignes.length === 3, "plafond par passage : 3 questions, 1 en attente");
ok(Math.abs(p1.bilan.cout - 0.0183) < 1e-9, "le coût réel du passage est compté");
ok(p1.lignes[0].texte_id === "COMMUN" && p1.lignes[0].metier === "" && p1.lignes[1].metier === "43" && p1.lignes[0].titre === TEXTE.titre &&
   p1.lignes[0].details.quand === "01/01/2027" && p1.lignes[0].ecarte === null, "chaque ligne à écrire : texte, métier, titre, conseil, cases");
const deja = p1.lignes.map((l) => ({ texte_id: l.texte_id, metier: l.metier, le: l.le, ecarte: l.ecarte }));
await traiter(releve, deja, clients, { V, cle: "k", plafond: 10, demande, controle, maintenant: "2026-10-31T11:00:00Z" });
ok(appels === 4, "au passage suivant, seul ce qui manque est demandé");

const ecarte = [...deja, { texte_id: "MACON", metier: "43", le: "2026-10-30T00:00:00Z", ecarte: "aucune source officielle valable" }];
appels = 0;
await traiter(releve, ecarte, clients, { V, cle: "k", demande, controle, maintenant: "2026-10-31T13:00:00Z" });
ok(appels === 0, "une réponse écartée n'est pas redemandée avant une semaine");
await traiter(releve, ecarte, clients, { V, cle: "k", demande, controle, maintenant: "2026-11-08T13:00:00Z" });
ok(appels === 1, "au bout d'une semaine, elle l'est");

const revoir = await traiter({ textes: [t("X", "sst")] }, [], [{ division: "43", rang: 2, contexte: [] }],
  { V, cle: "k", demande: async () => ({ ...r, texte: "CONCERNE : non" }), controle });
ok(revoir.bilan.aRevoir === 1 && revoir.lignes[0].texte === null && revoir.lignes[0].details.concerne === "non", "« à revoir » est compté et écrit, sans conseil");
/* --- Le plafond du mois (10 $ par défaut ; ici 5 $ pour l'essai) --- */
appels = 0;
const presque = await traiter(releve, [], clients, { V, cle: "k", demande, controle, depense: 4.99, budget: 5 });
ok(appels === 2 && presque.bilan.budgetAtteint && presque.bilan.attente === 2,
  "à 4,99 $ sur 5 $ : on finit la question en cours, puis plus rien — le reste attend le mois suivant");
ok(Math.abs(presque.bilan.depenseMois - 5.0022) < 1e-9 && presque.lignes.every((l) => l.cout === 0.0061), "chaque conseil garde son coût, et le total du mois est dit");
appels = 0;
const plein = await traiter(releve, [], clients, { V, cle: "k", demande, controle, depense: 5, budget: 5 });
ok(appels === 0 && plein.bilan.budgetAtteint && plein.lignes.length === 0, "plafond atteint : aucune question");
appels = 0;
const libre2 = await traiter(releve, [], clients, { V, cle: "k", demande, controle, depense: 0.5, budget: 5 });
ok(appels === 4 && !libre2.bilan.budgetAtteint, "sous le plafond : le passage va jusqu'au bout");

const erreur = await traiter({ textes: [t("E", "sst")] }, [], clients, { V, cle: "k", demande: async () => ({ ok: false, erreur: "HTTP 401" }), controle });
ok(erreur.bilan.erreurs === 2 && erreur.bilan.derniereErreur === "HTTP 401" && erreur.lignes.length === 0, "une erreur de l'API est comptée et dite, sans rien écrire");

console.log(`\n${n - echecs}/${n} vérifications passées`);
process.exit(echecs ? 1 : 0);
