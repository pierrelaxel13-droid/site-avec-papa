/* ==========================================================================
   L'essai de bout en bout, sur le VRAI site et la VRAIE base
   --------------------------------------------------------------------------
   Lancé par l'action « Essai en ligne » (.github/workflows/essai-en-ligne.yml),
   jamais sur un poste : il lui faut les secrets SUPABASE_SECRET_KEY et
   SUPABASE_DB_URL, qui ne sont que dans GitHub.

   Un vrai navigateur (Chromium) joue le parcours d'un client, avec un compte
   d'essai créé pour l'occasion (adresse essai-auto-…@example.com, confirmée
   d'office : aucun courriel ne part) :
     connexion → nommer son entreprise → réglages → plan → cocher, décocher
     → registre et sa chaîne → tableau de bord → un autre appareil (téléphone,
     thème sombre) → l'administration lui est refusée → déconnexion.
   Puis tout est effacé : l'entreprise (registre compris, journalisé dans
   prive.purges) et le compte. Même si l'essai échoue.

   Sortie : une ligne « ok : » ou « ÉCHEC : » par vérification, et le résumé
   de l'action. Code de sortie 1 au moindre échec.
   ========================================================================== */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";

const { chromium } = createRequire((process.env.PLAYWRIGHT_DOSSIER || process.cwd()) + "/")("playwright");
const SITE = (process.env.SITE || "https://pierrelaxel13-droid.github.io/site-avec-papa/").replace(/\/?$/, "/");
const URL_SB = process.env.SUPABASE_URL || "https://denpxyqbvjcwsbxjtqpd.supabase.co";
const SECRETE = process.env.SUPABASE_SECRET_KEY || "";
const BASE = process.env.SUPABASE_DB_URL || "";
const ADRESSE = `essai-auto-${Date.now()}@example.com`;
const MDP = randomBytes(18).toString("base64url");

const lignes = [];
let echecs = 0;
const ok = (c, quoi) => { const l = (c ? "ok : " : "ÉCHEC : ") + quoi; lignes.push(l); console.log(l); if (!c) echecs++; };
const sql = (q) => execFileSync("psql", [BASE, "-qtA", "-v", "ON_ERROR_STOP=1"], { input: q + ";\n" }).toString().trim();
const litteral = (v) => `'${String(v).replace(/'/g, "''")}'`;

async function admin(methode, chemin, corps) {
  // Les nouvelles clés secrètes vont dans « apikey » ; on essaie aussi en Bearer.
  for (const entetes of [{ apikey: SECRETE }, { apikey: SECRETE, Authorization: `Bearer ${SECRETE}` }]) {
    const r = await fetch(URL_SB + "/auth/v1/admin/" + chemin, {
      method: methode, headers: { ...entetes, "Content-Type": "application/json" },
      body: corps ? JSON.stringify(corps) : undefined
    });
    if (r.status !== 401 && r.status !== 403) return { statut: r.status, j: await r.json().catch(() => ({})) };
  }
  return { statut: 401, j: { msg: "clé secrète refusée" } };
}

let uid = "";
async function nettoyer() {
  if (!uid) return;
  try {
    sql(`select prive.purger_entreprise(m.entreprise_id) from public.membres_entreprise m where m.user_id = ${litteral(uid)}`);
    const r = await admin("DELETE", `users/${uid}`);
    if (r.statut >= 300) sql(`delete from auth.users where id = ${litteral(uid)}`);
    ok(sql(`select count(*) from auth.users where id = ${litteral(uid)}`) === "0", "nettoyage : le compte d'essai et son entreprise sont effacés");
  } catch (e) {
    ok(false, "nettoyage : " + String(e.message || e).slice(0, 200));
  }
}

async function essai() {
  if (!SECRETE || !BASE) { ok(false, "il manque le secret SUPABASE_SECRET_KEY ou SUPABASE_DB_URL"); return; }

  const cree = await admin("POST", "users", { email: ADRESSE, password: MDP, email_confirm: true });
  uid = cree.j && cree.j.id || "";
  ok(!!uid, "un compte d'essai confirmé est créé" + (uid ? "" : ` (HTTP ${cree.statut} : ${JSON.stringify(cree.j).slice(0, 160)})`));
  if (!uid) return;

  const nav = await chromium.launch();
  const erreurs = [];
  const contexte = async (vue, theme) => {
    const ctx = await nav.newContext({ viewport: vue, colorScheme: theme, acceptDownloads: true });
    const p = await ctx.newPage();
    p.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text()); });
    p.on("pageerror", (e) => erreurs.push(String(e)));
    return p;
  };
  const connecter = async (p) => {
    await p.goto(SITE + "connexion.html");
    await p.fill("#courriel", ADRESSE); await p.fill("#motdepasse", MDP);
    await p.click("#form-connexion button[type=submit]");
  };
  const pret = (p) => p.waitForFunction(() => window.MAGASIN && window.MAGASIN.pret, null, { timeout: 30000 });

  try {
    // 1. Connexion, et l'entreprise nommée dans « Mon compte ».
    const p = await contexte({ width: 1440, height: 900 }, "light");
    await connecter(p);
    await p.waitForURL(/compte\/$/, { timeout: 30000 });
    ok(!p.url().includes(MDP), "connexion réussie (le mot de passe n'est jamais dans l'adresse)");
    await p.waitForSelector("#form-entreprise:not([hidden])");
    await p.fill("#e-nom", "Essai automatique");
    await p.click("#form-entreprise button[type=submit]");
    await p.waitForSelector("#compte-entreprise:not([hidden])");
    ok((await p.locator("#entreprise-formule").textContent()).includes("Pas encore d'abonnement"), "entreprise nommée ; sans abonnement, l'espace est fermé");
    const e = sql(`select entreprise_id from public.membres_entreprise where user_id = ${litteral(uid)}`);
    sql(`insert into public.abonnements (entreprise_id, formule, periode, statut) values (${litteral(e)}, 'complet', 'an', 'offert')`);

    // 2. Les réglages.
    await p.goto(SITE + "app/reglages.html"); await pret(p);
    await p.selectOption("#e-naf", "43.32A");
    await p.dispatchEvent("#e-naf", "change");
    await p.fill("#e-ville", "Istres"); await p.fill("#e-effectif", "12");
    await p.locator("#e-contexte input[type=checkbox]").first().check();
    await p.click("#form-entreprise button[type=submit]");
    await p.waitForFunction(() => /Enregistré dans votre compte/.test(document.querySelector("#e-etat").textContent), null, { timeout: 30000 });
    ok(sql(`select naf || '|' || implantation || '|' || effectif from public.entreprises where id = ${litteral(e)}`) === "43.32A|Istres|12",
      "réglages enregistrés dans la base");

    // 3. Le plan : cocher une revue.
    await p.goto(SITE + "app/plan.html"); await pret(p);
    ok(!(await p.locator("main").innerText()).includes("Maçonnerie Vidal"), "le plan est le sien, rien du jeu d'essai");
    await p.locator("a.carte-categorie:not(.carte-vide)").first().click();
    const bouton = p.locator(".bloc-fait button:visible").first();
    const cle = await bouton.evaluate((x) => x.closest("[data-fait]").getAttribute("data-fait"));
    await bouton.click();
    await p.waitForFunction((c) => document.querySelector(`[data-fait="${c}"]`).classList.contains("est-fait"), cle, { timeout: 30000 });
    ok(sql(`select count(*) from public.registre where entreprise_id = ${litteral(e)} and cle = ${litteral(cle)} and genre = 'revue'`) === "1",
      `cocher « ${cle} » inscrit une revue au registre`);
    await p.reload(); await pret(p);
    ok(await p.locator(`[data-fait="${cle}"]`).first().evaluate((b) => b.classList.contains("est-fait")), "après rechargement, la case reste cochée");

    // 4. Un autre appareil.
    const tel = await contexte({ width: 390, height: 844 }, "dark");
    await connecter(tel);
    await tel.waitForURL(/\/app\//, { timeout: 30000 });
    await tel.goto(SITE + "app/plan.html"); await pret(tel);
    ok(await tel.locator(`[data-fait="${cle}"]`).first().evaluate((b) => b.classList.contains("est-fait")), "sur un téléphone, la même case est cochée");
    await tel.goto(SITE + "app/reglages.html"); await pret(tel);
    ok(await tel.locator("#e-naf").inputValue() === "43.32A", "et les mêmes réglages");
    ok(await tel.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), "téléphone : la page ne déborde pas");

    // 5. Décocher : une correction.
    await p.locator(`[data-fait="${cle}"] button:visible`).first().click();
    await p.waitForFunction((c) => !document.querySelector(`[data-fait="${c}"]`).classList.contains("est-fait"), cle, { timeout: 30000 });
    ok(sql(`select genre from public.registre where entreprise_id = ${litteral(e)} and cle = ${litteral(cle)} order by id desc limit 1`) === "correction",
      "décocher ajoute une correction ; rien n'est effacé");

    // 6. Le registre, et le tableau de bord.
    await p.goto(SITE + "app/registre.html"); await pret(p);
    await p.waitForFunction(() => /Registre intact/.test(document.querySelector("#registre-chaine")?.textContent || ""), null, { timeout: 30000 });
    ok(await p.locator("#registre-compte .ligne-registre").count() === 3, "registre : 3 entrées (plan, revue, correction), chaîne intacte");
    ok(sql(`select intact from public.verifier_registre(${litteral(e)})`) === "t", "la base confirme : chaîne d'empreintes intacte");
    await p.goto(SITE + "app/index.html"); await pret(p);
    await p.waitForFunction(() => (document.querySelector("#bord-n-registre")?.textContent || "…") !== "…", null, { timeout: 30000 });
    ok((await p.locator("#bord-n-registre").textContent()) === "3", "tableau de bord : 3 entrées au registre");

    // 6 bis. Décider sur un texte du relevé, en tirer une action, la clore, télécharger le registre.
    await p.goto(SITE + "app/releve.html"); await pret(p);
    await p.locator("a.carte-categorie:not(.carte-vide)").first().click();
    const ligne = p.locator(".ligne-releve:visible", { has: p.locator(".qualifier") }).first();
    await ligne.locator("summary").click();
    const q = ligne.locator(".qualifier");
    const cleTexte = await q.getAttribute("data-cle");
    await q.locator('[data-statut="applicable"]').click();
    await q.locator(".qualifier-action:not([hidden])").waitFor({ timeout: 30000 });
    await q.locator(".qa-objet").fill("Action d'essai automatique");
    await q.locator(".qualifier-action button[type=submit]").click();
    await q.locator(".qualifier-actions li").waitFor({ timeout: 30000 });
    ok(sql(`select string_agg(genre || ':' || statut, ',' order by id) from public.registre where entreprise_id = ${litteral(e)} and cle = ${litteral(cleTexte)}`)
       === "qualification:applicable,action:ouverte", "un texte qualifié « s'applique », et son action ouverte, sont au registre");
    await p.goto(SITE + "app/index.html"); await pret(p);
    await p.locator("#bord-actions [data-faite]").click();
    await p.waitForFunction(() => !document.querySelector("#bord-actions"), null, { timeout: 30000 });
    ok(sql(`select count(*) from public.registre where entreprise_id = ${litteral(e)} and genre = 'action' and statut = 'faite'`) === "1",
      "tableau de bord : « C'est fait » clôt l'action au registre");
    await p.goto(SITE + "app/registre.html"); await pret(p);
    await p.waitForFunction(() => /Registre intact/.test(document.querySelector("#registre-chaine")?.textContent || ""), null, { timeout: 30000 });
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#registre-csv")]);
    const csv = (await import("node:fs")).readFileSync(await dl.path(), "utf8");
    ok(csv.charCodeAt(0) === 0xfeff && csv.trim().split("\r\n").length === 7, "le registre se télécharge pour un tableur (6 entrées, accents gardés)");

    // 7. L'administration lui est refusée.
    await p.goto(SITE + "compte/admin.html");
    await p.waitForFunction(() => /Réservé/.test(document.querySelector("#admin-etat").textContent), null, { timeout: 30000 });
    ok(await p.locator("#admin-liste").isHidden(), "un client n'ouvre pas l'administration");

    // 8. Déconnexion.
    await p.goto(SITE + "compte/");
    await p.waitForSelector("#compte-principal:not([hidden])");
    await p.click("#compte-sortir");
    await p.waitForURL(/connexion\.html/);
    await p.goto(SITE + "app/plan.html");
    await p.waitForURL(/connexion\.html\?retour=/, { timeout: 30000 });
    ok(true, "après déconnexion, l'espace renvoie à la connexion");

    const autres = erreurs.filter((x) => !/status of 403/.test(x));   // le refus de l'administration est voulu
    ok(autres.length === 0, "aucune erreur dans la console" + (autres.length ? " : " + autres.slice(0, 3).join(" | ") : ""));
  } catch (err) {
    ok(false, "le parcours s'est arrêté : " + String(err.message || err).split("\n")[0].slice(0, 300));
  } finally {
    await nav.close();
  }
}

try { await essai(); } finally { await nettoyer(); }

const bilan = `${lignes.length - echecs}/${lignes.length} vérifications passées`;
console.log("\n" + bilan);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Essai en ligne\n\n${bilan}\n\n` + lignes.map((l) => `- ${l}`).join("\n") + "\n");
// Une annotation lisible depuis l'API de GitHub (les sauts de ligne s'y écrivent %0A).
const echappe = (x) => x.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
console.log(`::${echecs ? "error" : "notice"} title=Essai en ligne : ${bilan}::${lignes.map(echappe).join("%0A")}`);
process.exit(echecs ? 1 : 0);
