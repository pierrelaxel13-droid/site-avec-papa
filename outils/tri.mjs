/* ==========================================================================
   Le tri du robot : à quel sujet un texte se rattache, et ce qu'on écarte
   --------------------------------------------------------------------------
   Utilisé par outils/veille.mjs ; testé par outils/tri.test.mjs sur des
   titres réels. Le titre seul décide (voir plus bas pourquoi).
   ========================================================================== */

const sansAccent = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
// L'apostrophe typographique (’) devient droite : « fibres d’amiante » = « fibres d'amiante ».
export const normalise = (s) => sansAccent(String(s)).toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");

/* --- Rattachement aux domaines ---------------------------------------------
   Première version : un mot-clé n'importe où dans le titre ou le corps. Sur
   une vraie journée du Journal officiel, ça retenait 13 625 entrées sur
   42 200 — autant dire tout. Parce que tout acte commence par « Vu le code du
   travail ; Vu le code de la sécurité sociale », et qu'un nom de code dans les
   visas ne dit rien du sujet.

   Deuxième version, celle-ci, réglée sur une vraie relève :

   1. LE TITRE SEUL. Un texte qui vous concerne le dit dans son titre. Le corps
      ne sert qu'à lire, pas à trier.
   2. LE SUJET, PAS LE FONDEMENT. On écarte les mots-clés qui nomment un code,
      une loi, un règlement : ils désignent le fondement juridique, que tout
      acte cite. Restent les sujets — amiante, échafaudage, déchets, carrières.
   3. PAS LES ACTES INDIVIDUELS. Nominations, agréments, listes de prix de
      spécialités pharmaceutiques, avis de concours : ce sont des décisions
      particulières, pas de la réglementation.

   Sur la même journée : 234 textes retenus, et ils parlent d'empoussièrement
   amiante, de cahiers des charges REP, de plafonds de sécurité sociale.

   Troisième passe, le 29 octobre 2026, sur un relevé de 172 textes où 90
   tombaient dans le plan d'une maçonnerie :
   4. LES ANCIENS TEXTES NE SONT PAS DES NOUVEAUTÉS. Les archives quotidiennes
      du Journal officiel renvoient des articles de textes de 2006, 2012,
      2020… sans date de publication : ils prenaient la date du jour. Une fiche
      datée de plus de six mois avant l'archive qui l'apporte n'est pas retenue
      (ficheAncienne).
   5. D'AUTRES ACTES INDIVIDUELS : listes nominatives, prix d'un produit,
      affectations, autorisations d'un seul produit (voir ACTE_INDIVIDUEL).
   6. DES MOTS TROMPEURS : « transition écologique » est un nom de ministère ;
      un rappel de produit (RappelConso) titré « Cookies » est un biscuit — il
      ne se range que dans les sujets « produits ».
   Le mot « sécurité sociale » reste : sans lui, on perdait de vrais textes de
   paie (les décrets du 20 octobre 2026 sur la CSG).
   Tests : node outils/tri.test.mjs, sur des titres réels. */

/* Un mot-clé qui nomme un texte plutôt qu'un sujet. */
const MOT_FAIBLE = /^(code |loi |reglement|directive|convention|accord |arrete|decret)/;
/* Un mot-clé qui nomme une administration : il ne dit pas le sujet. */
const MOTS_TROMPEURS = new Set(["transition ecologique"]);

/* Les séries administratives du Journal officiel : du droit individuel. */
const ACTE_INDIVIDUEL = new RegExp([
  "specialites? pharmaceutiques",
  "avis relatif aux prix",
  "liste des (titres|medicaments|produits|specialites)",
  "appel au mecenat",
  "avis d.appel",
  "avis de (vacance|concours)",
  "portant (nomination|agrement|extension|delegation|renouvellement|cessation" +
    "|inscription|radiation|habilitation|designation|titularisation|promotion)",
  "^decision n",
  "liste des candidats",
  "tableau d.avancement",
  "medaille",
  "legion d.honneur",
  "ordre national",
  "cours des monnaies",
  // Ajoutés le 29 octobre 2026, sur un vrai relevé :
  "liste des personnes autorisees",               // médecins autorisés à exercer, nom par nom
  "avis relatif a la tarification",               // le prix d'un dispositif ou d'un aliment précis
  "relatif a l.affectation", "portant affectation",
  "conclusions d.evaluation",                     // Anses : un produit phytopharmaceutique
  "octroyant une autorisation",                   // UE : l'autorisation d'un biocide précis
  "autorisation de mise sur le marche d.un produit",
  "fixant le nombre (maximal )?de (postes|places|brevets|candidats)"
].join("|"), "i");

/* Un rappel de produit ne parle que de produits. */
const SUJETS_PRODUITS = new Set(["alimentaire", "produits_ce", "consommation"]);
const SOURCES_PRODUITS = new Set(["rappelconso"]);

export function rattache(V, titre, source = "") {
  const foin = normalise(titre);
  if (ACTE_INDIVIDUEL.test(foin)) return [];
  const touches = [];
  for (const [id, d] of Object.entries(V.domaines)) {
    if (SOURCES_PRODUITS.has(source) && !SUJETS_PRODUITS.has(id)) continue;
    const mots = (d.motsCles || []).map(normalise)
      .filter((m) => m.length > 4 && !MOT_FAIBLE.test(m) && !MOTS_TROMPEURS.has(m));
    const trouves = mots.filter((m) => foin.includes(m));
    if (trouves.length) touches.push({ id, nom: d.nom, mots: trouves.slice(0, 3) });
  }
  return touches;
}

/* Une fiche du Journal officiel datée (par son titre, sinon par sa date) de
   plus de six mois avant l'archive qui l'apporte : un ancien texte renvoyé,
   pas une parution. Une délibération publiée deux mois après son vote reste. */
const SIX_MOIS = 183;
export function ficheAncienne(titre, date, dateArchive) {
  const d = dateDuTitre(titre) || date;
  if (!d || !dateArchive) return false;
  return (Date.parse(dateArchive) - Date.parse(d)) / 86400000 > SIX_MOIS;
}

/* La date du texte, lue dans son titre — « Arrêté du 14 août 2012 ». Les
   archives datent de leur jour de parution, qui n'est pas celui du texte quand
   il y est republié. Mieux vaut la vraie date, et dire quand on l'a vu. */
const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet",
              "aout", "septembre", "octobre", "novembre", "decembre"];

export function dateDuTitre(titre) {
  const m = normalise(titre).match(/\bdu (\d{1,2})(?:er)? ([a-z]+) (\d{4})\b/);
  if (!m) return "";
  const mois = MOIS.indexOf(m[2]);
  if (mois === -1) return "";
  const a = Number(m[3]);
  if (a < 1800 || a > 2100) return "";
  return `${a}-${String(mois + 1).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
}
