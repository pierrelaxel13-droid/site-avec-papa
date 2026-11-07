/* ==========================================================================
   Vigie réglementaire — le récapitulatif quotidien et les rappels par e-mail
   --------------------------------------------------------------------------
   Chaque jour, après le relevé : à chaque compte qui l'a demandé (Mon compte
   → Paramètres → « Récapitulatif quotidien par e-mail »), un e-mail avec les
   textes relevés ce jour-là qui touchent le plan de veille de son
   entreprise, présentés comme le tableau « Ma veille réglementaire » (date,
   catégorie, texte et lien officiel, application). Aucun texte du jour pour
   son plan : pas d'e-mail.
   Les rappels : chaque action du plan d'actions dont le délai est dépassé
   et qui n'est pas validée vaut un rappel aux administrateurs et membres de
   l'entreprise (le premier jour du retard, puis chaque semaine). Chacun peut
   les couper dans Mon compte ou par le lien de l'e-mail.

   Lancement (workflow .github/workflows/recap.yml) :
     SUPABASE_DB_URL   la connexion de service à la base (secret du dépôt) ;
     BREVO_API_KEY     la clé d'envoi Brevo (secret du dépôt) ;
     RECAP_EXPEDITEUR  l'adresse d'expédition validée chez Brevo.
   Sans clé d'envoi, rien ne part : le robot dit à qui il aurait écrit.
   RECAP_ESSAI=dossier : écrit les e-mails en .html dans ce dossier, sans
   rien envoyer ni rien noter en base. RECAP_JOUR=AAAA-MM-JJ : un autre jour.
   La clé n'est jamais affichée ni écrite nulle part.
   ========================================================================== */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applicationDuTexte, CATEGORIES_TABLEAU, dateFr } from "./textes-communs.mjs";
import { factice } from "./courriels-gabarits.mjs";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = process.env.RECAP_SITE || "https://vigie-reglementaire.fr/";
const NOM = "Vigie réglementaire";

const esc = (v) => String(v == null ? "" : v)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function charger(chemin, cle) {
  const faux = {};
  new Function("window", await readFile(resolve(RACINE, chemin), "utf8"))(faux);
  return faux[cle];
}

/* Le plan d'une entreprise : son code APE (la division) et ses situations
   cochées — le même calcul que build.mjs (planDe) et assets/entreprise.js. */
export function planDe(V, naf, contexte) {
  const div = String(naf || "").replace(/[^0-9A-Za-z]/g, "").slice(0, 2);
  const liste = [];
  [...V.transversaux, ...(V.parDivision[div] || [])].forEach((id) => { if (V.domaines[id] && !liste.includes(id)) liste.push(id); });
  (contexte || []).forEach((qid) => {
    const q = V.declencheurs.find((x) => x.id === qid);
    if (q) q.domaines.forEach((id) => { if (V.domaines[id] && !liste.includes(id)) liste.push(id); });
  });
  return liste;
}

export function categorie(V, ids) {
  const cl = ids.map((id) => (V.domaines[id] || {}).classement).map((c) => (CATEGORIES_TABLEAU[c] ? c : "metier"));
  return [...new Set(Object.keys(CATEGORIES_TABLEAU).filter((c) => cl.includes(c)))].map((c) => CATEGORIES_TABLEAU[c]).join(", ");
}

/* Les textes du jour qui touchent ce plan. */
export function textesDuJour(V, textes, plan, jour) {
  return textes.filter((t) => (t.vuLe || t.date) === jour)
    .map((t) => ({ t, ids: (t.domaines || []).map((d) => d.id).filter((id) => plan.includes(id)) }))
    .filter((x) => x.ids.length);
}

/* L'e-mail : un tableau comme « Ma veille réglementaire », en styles en
   ligne (les messageries ignorent les feuilles de style). */
export function courriel(V, { denomination, jour, lignes, jeton }) {
  const lienPlan = `${SITE}app/plan.html`;
  const desinscrire = `${SITE}compte/recap.html?j=${encodeURIComponent(jeton)}`;
  const n = lignes.length;
  const sujet = `${n} nouveau${n > 1 ? "x" : ""} texte${n > 1 ? "s" : ""} pour ${denomination} — ${dateFr(jour)}`;
  const th = (t) => `<th align="left" style="padding:10px 12px;background:#4A2BE8;color:#ffffff;font-size:12px;font-weight:600;border:0">${t}</th>`;
  const td = (t, k) => `<td valign="top" style="padding:10px 12px;font-size:13px;line-height:1.45;color:#15152B;border-bottom:1px solid #E6E4F4;background:${k % 2 ? "#F7F6FF" : "#ffffff"}">${t}</td>`;
  const rangs = lignes.map(({ t, ids }, k) => {
    const a = applicationDuTexte(t);
    const lien = /^https?:\/\//i.test(t.lien || "") ? t.lien : "";
    const pastille = a.classe === "app-venir" ? '<br><span style="display:inline-block;margin-top:4px;padding:1px 8px;border-radius:10px;background:#FFF3DC;color:#8A5300;font-size:11px;font-weight:600">À venir</span>'
      : a.classe === "app-vigueur" ? '<br><span style="display:inline-block;margin-top:4px;padding:1px 8px;border-radius:10px;background:#E3F5EA;color:#11643A;font-size:11px;font-weight:600">En vigueur</span>' : "";
    return `<tr>${td(esc(dateFr(t.dateTexte || t.date)), k)}${td(esc(categorie(V, ids)), k)}${td(
      (lien ? `<a href="${esc(lien)}" style="color:#4A2BE8;text-decoration:underline">${esc(t.titre)}</a>` : esc(t.titre)) +
      `<br><span style="color:#5E5E79;font-size:12px">${esc(t.sourceNom || "")}</span>`, k)}${td(esc(a.etiquette) + pastille, k)}</tr>`;
  }).join("");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(sujet)}</title></head>
<body style="margin:0;padding:0;background:#F4F3FA;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3FA"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:760px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="padding:22px 24px;border-bottom:3px solid #4A2BE8">
  <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#4A2BE8">${NOM}</div>
  <div style="margin-top:4px;font-size:20px;font-weight:700;color:#15152B">Les textes du ${esc(dateFr(jour))}</div>
  <div style="margin-top:4px;font-size:13px;color:#5E5E79">${esc(denomination)} · ${n} texte${n > 1 ? "s" : ""} qui touche${n > 1 ? "nt" : ""} votre plan de veille</div>
</td></tr>
<tr><td style="padding:16px 12px 4px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
<tr>${th("Date")}${th("Catégorie")}${th("Texte et lien officiel")}${th("Application")}</tr>${rangs}
</table></td></tr>
<tr><td align="center" style="padding:18px 24px 6px">
  <a href="${lienPlan}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#4A2BE8;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">Ouvrir ma veille réglementaire</a>
</td></tr>
<tr><td style="padding:14px 24px 22px;font-size:11px;line-height:1.5;color:#5E5E79">
  Ne constitue pas un conseil juridique : seul le texte officiel fait foi.<br>
  Vous recevez cet e-mail parce que vous avez demandé le récapitulatif quotidien dans Mon compte.
  <a href="${desinscrire}" style="color:#5E5E79">Ne plus recevoir ce récapitulatif</a>.
</td></tr></table></td></tr></table></body></html>`;
  const texte = [`${NOM} — les textes du ${dateFr(jour)} pour ${denomination}`, ""]
    .concat(lignes.map(({ t, ids }) => `• ${t.titre}\n  ${categorie(V, ids)} · application : ${applicationDuTexte(t).etiquette}${t.lien ? `\n  ${t.lien}` : ""}`))
    .concat(["", `Ouvrir ma veille réglementaire : ${lienPlan}`, "", "Ne constitue pas un conseil juridique : seul le texte officiel fait foi.",
      `Ne plus recevoir ce récapitulatif : ${desinscrire}`]).join("\n");
  return { sujet, html, texte, desinscrire };
}

/* Le rappel des actions en retard. */
export function rappel({ denomination, jour, actions, jeton }) {
  const lien = `${SITE}app/actions.html`;
  const desinscrire = `${SITE}compte/recap.html?j=${encodeURIComponent(jeton)}&quoi=rappels`;
  const n = actions.length;
  const sujet = `Rappel : ${n} action${n > 1 ? "s" : ""} en retard chez ${denomination}`;
  const resp = (note) => { const m = /Responsable : (.*)/.exec(note || ""); return m ? m[1].trim() : ""; };
  const retard = (e) => Math.round((Date.parse(jour) - Date.parse(String(e).slice(0, 10))) / 86400000);
  const th = (t) => `<th align="left" style="padding:10px 12px;background:#4A2BE8;color:#ffffff;font-size:12px;font-weight:600">${t}</th>`;
  const td = (t, k) => `<td valign="top" style="padding:10px 12px;font-size:13px;line-height:1.45;color:#15152B;border-bottom:1px solid #E6E4F4;background:${k % 2 ? "#F7F6FF" : "#ffffff"}">${t}</td>`;
  const rangs = actions.map((a, k) => `<tr>${td(esc(a.objet), k)}${td(`<span style="display:inline-block;padding:2px 9px;border-radius:10px;background:#FDE8E8;color:#A11D1D;font-weight:700">${esc(dateFr(String(a.echeance).slice(0, 10)))}</span><br><span style="color:#A11D1D;font-size:12px">${retard(a.echeance)} jour${retard(a.echeance) > 1 ? "s" : ""} de retard</span>`, k)}${td(esc(resp(a.note) || "—"), k)}</tr>`).join("");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(sujet)}</title></head>
<body style="margin:0;padding:0;background:#F4F3FA;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3FA"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:760px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="padding:22px 24px;border-bottom:3px solid #C53030">
  <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#4A2BE8">${NOM}</div>
  <div style="margin-top:4px;font-size:20px;font-weight:700;color:#15152B">${n} action${n > 1 ? "s" : ""} en retard</div>
  <div style="margin-top:4px;font-size:13px;color:#5E5E79">${esc(denomination)} · le délai de réalisation est dépassé et l'action n'est pas encore validée</div>
</td></tr>
<tr><td style="padding:16px 12px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
<tr>${th("Action à mener")}${th("Délai de réalisation")}${th("Responsable")}</tr>${rangs}</table></td></tr>
<tr><td align="center" style="padding:18px 24px 6px">
  <a href="${lien}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#4A2BE8;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">Ouvrir mon plan d'actions</a>
</td></tr>
<tr><td style="padding:14px 24px 22px;font-size:11px;line-height:1.5;color:#5E5E79">
  Une fois l'action réalisée, validez-la dans le plan d'actions : les rappels s'arrêtent. Pour changer le délai, modifiez-le au même endroit.<br>
  <a href="${desinscrire}" style="color:#5E5E79">Ne plus recevoir ces rappels</a>.
</td></tr></table></td></tr></table></body></html>`;
  const texte = [`${NOM} — ${n} action${n > 1 ? "s" : ""} en retard chez ${denomination}`, ""]
    .concat(actions.map((a) => `• ${a.objet}\n  Délai : ${dateFr(String(a.echeance).slice(0, 10))} (${retard(a.echeance)} j de retard) · Responsable : ${resp(a.note) || "—"}`))
    .concat(["", `Ouvrir mon plan d'actions : ${lien}`, `Ne plus recevoir ces rappels : ${desinscrire}`]).join("\n");
  return { sujet, html, texte, desinscrire };
}

async function envoyer({ cle, expediteur, a, sujet, html, texte, desinscrire }) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": cle, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: NOM, email: expediteur }, to: [{ email: a }], subject: sujet,
      htmlContent: html, textContent: texte,
      headers: { "List-Unsubscribe": `<${desinscrire}>` }
    })
  });
  if (!r.ok) { let d = ""; try { d = ((await r.json()) || {}).message || ""; } catch { /* corps illisible */ } throw new Error(`envoi refusé (${r.status}${d ? " : " + d : ""})`); }
}

/* L'essai (RECAP_TEST_A=adresse) : un rappel d'exemple, avec des actions
   fictives, envoyé à une seule adresse. Ne lit ni n'écrit rien en base. */
async function envoyerEssai(a) {
  const cle = process.env.BREVO_API_KEY || "", expediteur = process.env.RECAP_EXPEDITEUR || "";
  if (!cle || !expediteur) {
    console.log("::error::Envoi impossible : il manque le secret " + (!cle ? "BREVO_API_KEY" : "RECAP_EXPEDITEUR") + " (GitHub → Settings → Secrets and variables → Actions).");
    process.exitCode = 1; return;
  }
  const jour = new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
  const avant = (n) => { const d = new Date(Date.parse(jour) - n * 86400000); return d.toISOString().slice(0, 10); };
  const m = rappel({ denomination: "Maçonnerie Vidal (essai)", jour, jeton: "00000000-0000-0000-0000-000000000000", actions: [
    { id: 1, objet: "Mettre à jour le document unique (DUERP) et dater la mise à jour — Décret n° 2026-1025", echeance: avant(12), note: "Responsable : Karim Vidal" },
    { id: 2, objet: "Vérifier la validité des habilitations électriques du personnel", echeance: avant(3), note: "Responsable : Julie Martin" }
  ] });
  m.sujet = "[Essai] " + m.sujet;
  try { await envoyer({ cle, expediteur, a, ...m }); console.log("ok : e-mail d'essai (rappel d'actions en retard) envoyé."); }
  catch (e) { console.log("::error::L'envoi a échoué : " + e.message); process.exitCode = 1; }
}

/* L'essai du récapitulatif (6 novembre 2026) : les textes relevés un jour donné (hier par
   défaut), pour un code APE (RECAP_TEST_NAF) ou, sans code, pour tous les sujets ; envoyé à
   une seule adresse (RECAP_TEST_A), sinon à l'adresse du site (RECAP_EXPEDITEUR). */
async function envoyerEssaiTextes(a) {
  const cle = process.env.BREVO_API_KEY || "", expediteur = process.env.RECAP_EXPEDITEUR || "";
  if (!cle || !expediteur) { console.log("::error::Il manque BREVO_API_KEY ou RECAP_EXPEDITEUR."); process.exitCode = 1; return; }
  const auj = new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
  const jour = process.env.RECAP_JOUR || new Date(Date.parse(auj) - 86400000).toISOString().slice(0, 10);
  const V = await charger("assets/referentiel.js", "VEILLE");
  const JO = JSON.parse(await readFile(resolve(RACINE, "contenu/veille-releve.json"), "utf8"));
  let naf = (process.env.RECAP_TEST_NAF || "").trim(), contexte = [], nom = "", dests = a ? [a] : [];
  // Une entreprise nommée : son plan (code APE et situations) et l'adresse de ses responsables
  // de compte, lus dans la base. Les adresses ne s'écrivent jamais dans le journal.
  const ent = (process.env.RECAP_TEST_ENTREPRISE || "").trim();
  if (ent) {
    const url = process.env.SUPABASE_DB_URL || "";
    if (!url) { console.log("::error::SUPABASE_DB_URL absent."); process.exitCode = 1; return; }
    const r = execFileSync("psql", [url, "-qtA", "-v", "ON_ERROR_STOP=1", "-v", `nom=${ent}`], { input: `select coalesce(json_agg(json_build_object(
        'denomination', e.denomination, 'naf', e.naf,
        'contexte', coalesce((select json_agg(x.declencheur) from public.reponses x where x.entreprise_id = e.id and x.valeur), '[]'),
        'courriels', coalesce((select json_agg(u.email) from public.membres_entreprise m join auth.users u on u.id = m.user_id
                               where m.entreprise_id = e.id and m.role = 'admin' and u.email_confirmed_at is not null), '[]'))), '[]')
      from public.entreprises e where e.active and (
        lower(regexp_replace(e.denomination, '\\s', '', 'g')) = lower(regexp_replace(:'nom', '\\s', '', 'g'))
        or (lower(:'nom') = 'dernier compte' and e.id in (select m.entreprise_id from public.membres_entreprise m
              where m.role = 'admin' and m.user_id = (select u.id from auth.users u where u.email_confirmed_at is not null
                and u.email not like 'essai-auto-%' order by u.created_at desc limit 1))));\n` }).toString().trim();
    const l = JSON.parse(r || "[]");
    if (!l.length) { console.log("::error::Aucune entreprise ne porte ce nom (vérifiez l'orthographe exacte)."); process.exitCode = 1; return; }
    if (l.length > 1) console.log(`::warning::${l.length} entreprises portent ce nom : la première est prise.`);
    nom = l[0].denomination; naf = naf || l[0].naf || ""; contexte = l[0].contexte || [];
    if (!a) dests = l[0].courriels || [];
    if (!dests.length) { console.log("::error::Cette entreprise n'a pas de responsable de compte à l'adresse confirmée."); process.exitCode = 1; return; }
    if (!naf) console.log("::warning::Cette entreprise n'a pas encore de code APE : tous les sujets sont pris.");
  }
  const plan = naf ? planDe(V, naf, contexte) : Object.keys(V.domaines);
  const lignes = textesDuJour(V, JO.textes || [], plan, jour);
  console.log(`Textes relevés le ${jour} : ${(JO.textes || []).filter((t) => (t.vuLe || t.date) === jour).length} ; pour ${nom ? "cette entreprise" : naf ? "le code " + naf : "tous les sujets"} : ${lignes.length}.`);
  if (!lignes.length) { console.log("::warning::Aucun texte ce jour-là pour ce plan : rien n'est envoyé."); return; }
  const m = courriel(V, { denomination: nom || (naf ? `l'essai (code ${naf})` : "l'essai (tous les sujets)"), jour, lignes, jeton: "00000000-0000-0000-0000-000000000000" });
  m.sujet = "[Essai] " + m.sujet;
  if (!dests.length) dests = [expediteur];
  for (const d of dests) {
    try { await envoyer({ cle, expediteur, a: d, ...m }); }
    catch (e) { console.log("::error::L'envoi a échoué : " + e.message); process.exitCode = 1; return; }
  }
  console.log(`ok : récapitulatif d'essai envoyé à ${dests.length} adresse(s)${nom ? " (responsable(s) du compte de l'entreprise)" : a ? "" : " (adresse du site)"}.`);
}

async function principal() {
  if (process.env.RECAP_TEST_TEXTES) return envoyerEssaiTextes((process.env.RECAP_TEST_A || "").trim());
  if (process.env.RECAP_TEST_A || process.env.RECAP_TEST_RAPPEL) return envoyerEssai((process.env.RECAP_TEST_A || "").trim() || process.env.RECAP_EXPEDITEUR || "");
  const jour = process.env.RECAP_JOUR || new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
  const essai = process.env.RECAP_ESSAI || "";
  const url = process.env.SUPABASE_DB_URL || "";
  const cle = process.env.BREVO_API_KEY || "";
  const expediteur = process.env.RECAP_EXPEDITEUR || "";
  if (!url) { console.log("SUPABASE_DB_URL absent : rien à faire."); return; }
  const sql = (q) => execFileSync("psql", [url, "-qtA", "-v", "ON_ERROR_STOP=1"], { input: q + ";\n" }).toString().trim();

  const V = await charger("assets/referentiel.js", "VEILLE");
  const JO = JSON.parse(await readFile(resolve(RACINE, "contenu/veille-releve.json"), "utf8"));
  const dests = JSON.parse(sql("select prive.recap_destinataires()") || "[]");
  console.log(`Récapitulatif du ${jour} : ${(JO.textes || []).filter((t) => (t.vuLe || t.date) === jour).length} texte(s) relevé(s) ce jour, ${dests.length} destinataire(s) inscrit(s).`);
  if (!essai && (!cle || !expediteur)) console.log("BREVO_API_KEY ou RECAP_EXPEDITEUR absent : aucun e-mail ne part (on dit seulement ce qui partirait).");
  if (essai) await mkdir(essai, { recursive: true });

  let envoyes = 0, vides = 0, erreurs = 0;
  const faits = [];
  for (const d of dests) {
    if (!essai && d.dernier_envoi === jour) continue;      // déjà envoyé aujourd'hui
    if (!essai && factice(d.courriel)) continue;            // adresse fictive (test automatique) : jamais envoyée
    const lignes = textesDuJour(V, JO.textes || [], planDe(V, d.naf, d.contexte), jour);
    if (!lignes.length) { vides++; continue; }
    const m = courriel(V, { denomination: d.denomination, jour, lignes, jeton: d.jeton });
    if (essai) { await writeFile(join(essai, `${d.entreprise_id}.html`), m.html); envoyes++; continue; }
    if (!cle || !expediteur) { envoyes++; continue; }
    try {
      await envoyer({ cle, expediteur, a: d.courriel, ...m });
      envoyes++; faits.push(d.user_id);
    } catch (e) { erreurs++; console.log(`Un envoi a échoué : ${e.message}`); }
  }
  // Les rappels des actions en retard.
  const rappels = JSON.parse(sql(`select prive.rappels_a_envoyer('${jour}'::date)`) || "[]");
  let nRappels = 0;
  const notes = [];
  for (const r of rappels) {
    if (!essai && factice(r.courriel)) continue;
    const id = String(r.user_id).replace(/[^0-9a-f-]/gi, "");
    const jeton = r.jeton || (essai ? "essai" : sql(`select prive.jeton_de('${id}')`));
    const m = rappel({ denomination: r.denomination, jour, actions: r.actions, jeton });
    if (essai) { await writeFile(join(essai, `rappel-${r.entreprise_id}-${id.slice(0, 8)}.html`), m.html); nRappels++; continue; }
    if (!cle || !expediteur) { nRappels++; continue; }
    try {
      await envoyer({ cle, expediteur, a: r.courriel, ...m });
      nRappels++; r.actions.forEach((a) => notes.push(`(${Number(a.id)}, '${id}', '${jour}')`));
    } catch (e) { erreurs++; console.log(`Un rappel a échoué : ${e.message}`); }
  }
  if (notes.length) sql(`insert into prive.rappels_envoyes (action_id, user_id, le) values ${notes.join(",")} on conflict (action_id, user_id) do update set le = excluded.le`);
  console.log(`${nRappels} rappel(s) d'actions en retard ${essai ? "écrit(s)" : cle && expediteur ? "envoyé(s)" : "à envoyer"}.`);

  if (faits.length) sql(`update prive.recap_quotidien set dernier_envoi = '${jour}' where user_id in (${[...new Set(faits)].map((x) => `'${String(x).replace(/[^0-9a-f-]/gi, "")}'`).join(",")})`);
  console.log(`${envoyes} e-mail(s) ${essai ? "écrit(s) dans " + essai : cle && expediteur ? "envoyé(s)" : "à envoyer"}, ${vides} sans texte du jour pour leur plan, ${erreurs} échec(s).`);
  if (erreurs) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) principal();
