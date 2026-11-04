/* ==========================================================================
   Vigie réglementaire — ce que le site et les robots partagent sur un texte
   --------------------------------------------------------------------------
   La date d'application lue dans le texte officiel et les catégories des
   tableaux : build.mjs (les pages) et outils/recap.mjs (le récapitulatif
   quotidien par e-mail) s'en servent, pour dire la même chose partout.
   ========================================================================== */
const JOUR = { day: "numeric", month: "long", year: "numeric" };
export const dateFr = (iso) => new Date(iso + "T12:00:00Z")
  .toLocaleDateString("fr-FR", JOUR).replace(/^1 /, "1er ");

export const CATEGORIES_TABLEAU = {
  "sante-securite": "Santé et sécurité", hygiene: "Hygiène", environnement: "Environnement",
  social: "Ressources humaines", metier: "Métier et gestion"
};

/* La date d'application d'un texte : lue dans le texte officiel lui-même,
   jamais devinée. Rien de trouvé : on le dit. */
export const MOIS_FR = { janvier: 1, "février": 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, "août": 8, aout: 8,
  septembre: 9, octobre: 10, novembre: 11, "décembre": 12, decembre: 12 };
export function applicationDuTexte(t) {
  const corps = `${t.corps || ""} ${t.nota || ""}`.replace(/\s+/g, " ");
  if (t.genre !== "texte") return { etiquette: "—", classe: "" };
  if (corps.trim().length < 40) return { etiquette: "Voir le texte officiel", classe: "" };
  const re = new RegExp("(entre(?:nt)? en vigueur|prend(?:ront|ra|nent)? effet|sont applicables|est applicable|s.appliqu\\w*)[^.;]{0,120}?" +
    "(?:le|à compter du|à partir du|au)\\s+(1\\s?er|\\d{1,2})\\s+(" + Object.keys(MOIS_FR).join("|") + ")\\s+(\\d{4})", "i");
  const m = re.exec(corps);
  if (m) {
    const iso = `${m[4]}-${String(MOIS_FR[m[3].toLowerCase()]).padStart(2, "0")}-${String(parseInt(m[2], 10)).padStart(2, "0")}`;
    return { iso, etiquette: dateFr(iso), classe: iso > new Date().toISOString().slice(0, 10) ? "app-venir" : "app-vigueur" };
  }
  if (/entre(?:nt)? en vigueur le lendemain de (?:sa|leur) publication/i.test(corps)) {
    const d = new Date(`${t.dateTexte || t.date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    return { iso, etiquette: dateFr(iso), precision: "lendemain de la publication", classe: "app-vigueur" };
  }
  if (/en vigueur à (?:une|la) date fixée par/i.test(corps)) return { etiquette: "Date fixée par un texte à venir", classe: "app-venir" };
  return { etiquette: "Non précisée dans le texte", classe: "" };
}
