/* ==========================================================================
   Vigie — noyau : utilitaires, constantes, état, calculs de veille
   ========================================================================== */

const V = window.VEILLE;
const KEY = "vigie-v1";
const THEME_KEY = "vigie-theme";

/* ------------------------------------------------------------------ DOM */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ESC[c]);
const plural = (n, un, plus) => (n > 1 ? plus : un);
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

/* ---------------------------------------------------------------- dates */
const DAY = 864e5;
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const parse = (s) => {
  if (!s) return null;
  const p = String(s).split("-").map(Number);
  return p.length === 3 && !p.some(isNaN) ? new Date(p[0], p[1] - 1, p[2]) : null;
};
const today = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};
const addDays = (d, n) => {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
};
const addMonths = (d, n) => {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const dernier = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(d.getDate(), dernier));
  return r;
};
const diffDays = (a, b) => Math.round((a - b) / DAY);
const estOuvre = (d) => d.getDay() !== 0 && d.getDay() !== 6;
const fmtCourt = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const fmtLong = (d) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const fmtIso = (s) => (s && parse(s) ? fmtCourt(parse(s)) : "—");
const rel = (j) =>
  j === 0 ? "aujourd’hui" : j === 1 ? "demain" : j === -1 ? "hier" : j > 0 ? "dans " + j + " j" : "il y a " + -j + " j";
const heuresCourt = (min) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? h + "h" + (m ? pad(m) : "") : m + "min";
};
const relRetard = (j) => (j < 0 ? "en retard de " + -j + " j" : rel(j));
const heures = (min) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? (m ? h + " h " + pad(m) : h + " h") : m + " min";
};

/* ----------------------------------------------------------- constantes */
const FREQ = ["quotidienne", "hebdomadaire", "mensuelle", "trimestrielle"];
/* Durée moyenne d’une session de revue et nombre de sessions par mois :
   estimations de travail, pas des mesures. */
const MINUTES = { quotidienne: 10, hebdomadaire: 15, mensuelle: 45, trimestrielle: 60 };
const PAR_MOIS = { quotidienne: 21, hebdomadaire: 4.3, mensuelle: 1, trimestrielle: 1 / 3 };
const FREQ_ABR = { quotidienne: "QUOT.", hebdomadaire: "HEBDO.", mensuelle: "MENS.", trimestrielle: "TRIM." };
const FAM = Object.keys(V.familles);
const FAM_COURT = {
  social: "Social",
  sst: "Santé-sécurité",
  env: "Environnement",
  tech: "Technique",
  sect: "Sectoriel",
  fisc: "Fiscal",
  num: "Numérique",
  juri: "Jurisprudence"
};
const STATUTS = {
  a_analyser: { l: "À analyser", ic: "s-analyser" },
  en_cours: { l: "Action en cours", ic: "s-cours" },
  ecart: { l: "Écart constaté", ic: "s-ecart" },
  conforme: { l: "Conforme", ic: "s-conforme" },
  non_applicable: { l: "Non applicable", ic: "s-na" }
};
const NIVEAUX = { majeur: "Majeur", modere: "Modéré", mineur: "Mineur" };
const ORIGINES = { socle: "Socle", secteur: "Secteur", activite: "Activité", manuel: "Ajouté" };
const EFFECTIFS = [
  "Aucun salarié",
  "1 à 10 salariés",
  "11 à 19 salariés",
  "20 à 49 salariés",
  "50 à 249 salariés",
  "250 salariés et plus"
];

/* ---------------------------------------------------------------- icônes */
const ICONS = {
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12 18.4 5.6"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  profil: '<path d="M4 21V5l8-2v18M12 9l8 2v10M2 21h20M7.5 9h1M7.5 13h1M7.5 17h1M15.5 14h1M15.5 18h1"/>',
  plan: '<path d="M9 6h11M9 12h11M9 18h11M3.5 6l1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/>',
  calendrier: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  registre: '<rect x="3.5" y="4" width="5" height="16" rx="1.2"/><rect x="10" y="4" width="5" height="10" rx="1.2"/><rect x="16.5" y="4" width="4" height="13" rx="1.2"/>',
  sources: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  synthese: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  auto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 3.5 21.5 20h-19zM12 10v4.5M12 17.2v.3"/>',
  arrow: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  back: '<path d="M20 12H4M10 6l-6 6 6 6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5M4 20h16"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  print: '<path d="M7 9V3h10v6M7 17H4V9h16v8h-3M7 14h10v7H7z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.5-3.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14.5 3.5L20 15M20 20v-5h-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  "s-analyser": '<circle cx="12" cy="12" r="7.5"/>',
  "s-cours": '<circle cx="12" cy="12" r="7.5"/><path d="M12 4.5a7.5 7.5 0 0 1 0 15z" fill="currentColor"/>',
  "s-ecart": '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4M12 16.5v.2"/>',
  "s-conforme": '<circle cx="12" cy="12" r="7.5"/><path d="m8.5 12.3 2.4 2.4 4.6-4.9"/>',
  "s-na": '<circle cx="12" cy="12" r="7.5"/><path d="M8 12h8"/>'
};
const ic = (nom, cls) =>
  '<svg class="ic' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
  (ICONS[nom] || "") +
  "</svg>";

/* ------------------------------------------------------------------ état */
const blank = () => ({
  v: 1,
  demo: false,
  profil: { entreprise: "", effectif: "", sites: "", pilote: "", naf: "", division: "" },
  declencheurs: [],
  plan: {},
  ajouts: [],
  exclus: [],
  checks: {},
  registre: []
});

/* Jeu d’exemple, calé sur la date du jour pour toujours paraître vivant. */
function exemple() {
  const t = today();
  const d = (n) => iso(addDays(t, n));
  const s = blank();
  s.demo = true;
  s.profil = {
    entreprise: "Maçonnerie Exemple SARL",
    effectif: "11 à 19 salariés",
    sites: "1 dépôt et des chantiers",
    pilote: "Le gérant",
    naf: "43.99C",
    division: "43"
  };
  s.declencheurs = ["salaries", "chantier", "engins", "bati_ancien", "vehicules"];

  const jours = { quotidienne: 1, hebdomadaire: 7, mensuelle: 30, trimestrielle: 91 };
  const fractions = [0.35, 1.6, 0.7, 0.2, 1.15, 0.55, null, 0.9, 1.35, 0.1, 0.45, null, 0.8, 0.3, 0.6];
  const resp = ["Le gérant", "Conducteur de travaux", "Assistante RH", "Expert-comptable", "Responsable sécurité", "Le gérant"];
  V.perimetre(s.profil.division, s.declencheurs).forEach((x, i) => {
    const dom = V.domaines[x.id];
    const f = fractions[i % fractions.length];
    s.plan[x.id] = {
      frequence: dom.frequence,
      responsable: resp[i % resp.length],
      derniere: f == null ? "" : d(-Math.max(0, Math.round(jours[dom.frequence] * f)))
    };
    const n = dom.obligations.length;
    s.checks[x.id] = dom.obligations.map((_, k) => k < Math.round(n * [0.75, 0.5, 1, 0.25, 0.5, 0.75][i % 6]));
  });

  const e = (o) =>
    Object.assign(
      { id: uid(), ref: "Exemple", source: "https://www.legifrance.gouv.fr", datePub: "", vigueur: "", impacts: [], action: "", resp: "", echeance: "", diffuse: false, notes: "Entrée d’exemple à remplacer par vos propres relevés.", cree: d(0) },
      o
    );
  s.registre = [
    e({ intitule: "Vérification périodique des appareils de levage", domaine: "levage", niveau: "majeur", impacts: ["juridique", "operationnel"], action: "Planifier la vérification générale périodique par un organisme agréé", resp: "Conducteur de travaux", echeance: d(9), statut: "en_cours", diffuse: true, datePub: d(-40) }),
    e({ intitule: "Mise à jour du document unique après changement d’organisation", domaine: "sst", niveau: "modere", impacts: ["juridique", "social"], action: "Réévaluer les risques de la nouvelle équipe de gros œuvre", resp: "Responsable sécurité", echeance: d(21), statut: "a_analyser", datePub: d(-12) }),
    e({ intitule: "Repérage amiante avant travaux : contenu du dossier", domaine: "amiante", niveau: "majeur", impacts: ["juridique", "financier", "reputation"], action: "Compléter les dossiers de repérage des chantiers en rénovation", resp: "Le gérant", echeance: d(-4), statut: "ecart", datePub: d(-25) }),
    e({ intitule: "Évolution des taux de cotisations au 1er janvier", domaine: "paie", niveau: "mineur", impacts: ["financier"], action: "Paramétrer le logiciel de paie", resp: "Expert-comptable", echeance: d(-30), statut: "conforme", diffuse: true, datePub: d(-70) }),
    e({ intitule: "Facturation électronique : choix d’une plateforme agréée", domaine: "fiscal", niveau: "modere", impacts: ["financier", "operationnel"], action: "Comparer trois plateformes et décider", resp: "Expert-comptable", echeance: d(45), statut: "en_cours", datePub: d(-90) }),
    e({ intitule: "Tri et traçabilité des déchets de chantier", domaine: "dechets", niveau: "modere", impacts: ["operationnel", "financier"], action: "Vérifier les bordereaux de suivi avec le collecteur", resp: "Conducteur de travaux", echeance: d(14), statut: "a_analyser", datePub: d(-6) }),
    e({ intitule: "Plan de prévention : modèle de plan mis à jour", domaine: "chantier_sps", niveau: "modere", impacts: ["juridique", "operationnel"], action: "", resp: "Responsable sécurité", echeance: d(-10), statut: "conforme", diffuse: true, datePub: d(-60) }),
    e({ intitule: "Régime des installations classées pour la centrale à béton", domaine: "icpe", niveau: "mineur", impacts: ["juridique"], action: "", resp: "", echeance: "", statut: "non_applicable", notes: "Pas de centrale à béton sur nos sites." })
  ];
  return s;
}

function migrer(s) {
  const b = blank();
  s = Object.assign(b, s);
  s.profil = Object.assign(b.profil, s.profil || {});
  ["declencheurs", "ajouts", "exclus", "registre"].forEach((k) => {
    if (!Array.isArray(s[k])) s[k] = [];
  });
  s.plan = s.plan && typeof s.plan === "object" ? s.plan : {};
  s.checks = s.checks && typeof s.checks === "object" ? s.checks : {};
  return s;
}

function charger() {
  try {
    const brut = localStorage.getItem(KEY);
    if (brut) {
      const s = JSON.parse(brut);
      if (s && s.v === 1) return migrer(s);
    }
  } catch (e) {
    /* stockage indisponible : on repart de l’exemple */
  }
  return exemple();
}

let S = charger();
let sauvegardeOk = true;
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
    sauvegardeOk = true;
  } catch (e) {
    sauvegardeOk = false;
  }
}

/* -------------------------------------------------------------- calculs */
function prochaine(d, freq) {
  if (freq === "quotidienne") {
    let r = addDays(d, 1);
    while (!estOuvre(r)) r = addDays(r, 1);
    return r;
  }
  if (freq === "hebdomadaire") return addDays(d, 7);
  if (freq === "mensuelle") return addMonths(d, 1);
  return addMonths(d, 3);
}

function avancement(id) {
  const obl = V.domaines[id].obligations;
  const c = S.checks[id] || [];
  let n = 0;
  obl.forEach((_, i) => {
    if (c[i]) n++;
  });
  return obl.length ? n / obl.length : 0;
}

/* Périmètre = socle + secteur + activité + ajouts − exclus, enrichi du plan. */
function perim() {
  const base = V.perimetre(S.profil.division, S.declencheurs).slice();
  const vus = {};
  base.forEach((x) => (vus[x.id] = 1));
  S.ajouts.forEach((id) => {
    if (V.domaines[id] && !vus[id]) {
      base.push({ id: id, origines: ["manuel"] });
      vus[id] = 1;
    }
  });
  const t = today();
  return base
    .filter((x) => S.exclus.indexOf(x.id) < 0)
    .map((x) => {
      const dom = V.domaines[x.id];
      const p = S.plan[x.id] || {};
      const frequence = FREQ.indexOf(p.frequence) >= 0 ? p.frequence : dom.frequence;
      const derniere = p.derniere || "";
      const ech = derniere && parse(derniere) ? prochaine(parse(derniere), frequence) : t;
      const j = diffDays(ech, t);
      return {
        id: x.id,
        origines: x.origines,
        dom: dom,
        frequence: frequence,
        responsable: p.responsable || "",
        derniere: derniere,
        echeance: ech,
        jours: j,
        jamais: !derniere,
        etat: j < 0 ? "retard" : j === 0 ? "jour" : "avenir",
        pct: avancement(x.id)
      };
    })
    .sort((a, b) => FREQ.indexOf(a.frequence) - FREQ.indexOf(b.frequence) || a.dom.nom.localeCompare(b.dom.nom, "fr"));
}

function chargeMensuelle(P) {
  const par = {};
  FREQ.forEach((f) => (par[f] = 0));
  P.forEach((p) => (par[p.frequence] += PAR_MOIS[p.frequence] * MINUTES[p.frequence]));
  const total = FREQ.reduce((n, f) => n + par[f], 0);
  return { par: par, total: total };
}

function statsRegistre() {
  const n = { a_analyser: 0, en_cours: 0, ecart: 0, conforme: 0, non_applicable: 0 };
  let retard = 0;
  let adiffuser = 0;
  const t = today();
  S.registre.forEach((r) => {
    if (n[r.statut] != null) n[r.statut]++;
    const ouvert = r.statut !== "conforme" && r.statut !== "non_applicable";
    if (ouvert && r.echeance && parse(r.echeance) < t) retard++;
    if (r.niveau === "majeur" && r.statut !== "non_applicable" && !r.diffuse) adiffuser++;
  });
  return { n: n, retard: retard, adiffuser: adiffuser, total: S.registre.length };
}

/* Projette les revues sur les prochains jours en supposant qu’elles sont faites à l’échéance. */
function projeter(fin) {
  const t = today();
  const map = {};
  const ajouter = (k, type, v) => {
    (map[k] = map[k] || { revues: [], actions: [] })[type].push(v);
  };
  perim().forEach((p) => {
    let d = p.echeance < t ? t : p.echeance;
    if (p.frequence === "quotidienne") while (!estOuvre(d)) d = addDays(d, 1);
    let garde = 0;
    while (d <= fin && garde++ < 120) {
      ajouter(iso(d), "revues", { id: p.id, nom: p.dom.nom, min: MINUTES[p.frequence], frequence: p.frequence, retard: p.etat === "retard" && d.getTime() === t.getTime() });
      d = prochaine(d, p.frequence);
    }
  });
  S.registre.forEach((r) => {
    if (!r.echeance || r.statut === "conforme" || r.statut === "non_applicable") return;
    const e = parse(r.echeance);
    if (!e) return;
    const k = e < t ? iso(t) : r.echeance;
    if (parse(k) <= fin) ajouter(k, "actions", { id: r.id, intitule: r.intitule, retard: e < t, resp: r.resp, statut: r.statut });
  });
  return map;
}

/* Navigation : données liées à l’écran courant (filtres, sélection). */
const UI = { section: "", nafRecherche: "", jour: "", radar: "radar", registre: "kanban", planFam: "", planRetard: false, regTexte: "", regDomaine: "", regStatut: "" };
