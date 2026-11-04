/* ==========================================================================
   Vigie réglementaire — le registre cumulé des textes publiés relevés
   (4 novembre 2026, demande d'Axel)
   --------------------------------------------------------------------------
   Le relevé (contenu/veille-releve.json) ne garde que ses 14 derniers jours.
   Pour que l'accueil compte TOUS les textes publiés que nous avons relevés
   depuis le début, chaque passage ajoute ici les identifiants des textes du
   relevé : contenu/textes-suivis.json = { depuis, ids: [...] }. On n'y
   retire jamais rien ; un texte déjà vu ne compte qu'une fois.
   Lancé par releve.yml juste après outils/veille.mjs (jamais par build.mjs,
   qui construit aussi avec le jeu d'essai).
   ========================================================================== */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const RELEVE = "contenu/veille-releve.json", CUMUL = "contenu/textes-suivis.json";
export const cleTexte = (t) => String(t.id || t.lien || `${t.source || ""}|${t.titre || ""}`);

export function cumuler(cumul, releve) {
  const ids = new Set(cumul.ids || []);
  const avant = ids.size;
  (releve.textes || []).forEach((t) => ids.add(cleTexte(t)));
  const depuis = [cumul.depuis, releve.depuis].filter(Boolean).sort()[0] || null;
  return { cumul: { depuis, ids: [...ids].sort() }, ajoutes: ids.size - avant };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!existsSync(RELEVE)) { console.log("Pas de relevé : rien à cumuler."); process.exit(0); }
  const releve = JSON.parse(await readFile(RELEVE, "utf8"));
  const cumul = existsSync(CUMUL) ? JSON.parse(await readFile(CUMUL, "utf8")) : { depuis: null, ids: [] };
  const r = cumuler(cumul, releve);
  await writeFile(CUMUL, JSON.stringify(r.cumul, null, 0) + "\n");
  console.log(`Textes publiés relevés depuis le ${r.cumul.depuis} : ${r.cumul.ids.length} (${r.ajoutes} nouveaux).`);
}
