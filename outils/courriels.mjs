#!/usr/bin/env node
/* ==========================================================================
   Vigie réglementaire — les e-mails automatiques (5 novembre 2026)
   --------------------------------------------------------------------------
   Envoie, par Brevo, les e-mails que la base a mis en file (prive.courriels,
   migration 25) :
     - « invitation » : le lien pour créer son compte et rejoindre un espace
       (client d'un consultant, collègue invité, membre d'un cabinet) ;
     - « facture » : une nouvelle facture est disponible dans Mon compte.
   Lancé toutes les 10 minutes par .github/workflows/courriels.yml.

   Secrets (GitHub → Settings → Secrets and variables → Actions) :
     SUPABASE_DB_URL   la connexion de service à la base ;
     BREVO_API_KEY     la clé d'API Brevo ;
     RECAP_EXPEDITEUR  l'adresse d'expédition validée chez Brevo.
   Sans l'un d'eux, le robot le dit et n'envoie rien (la file attend).
   ========================================================================== */
import { execFileSync } from "node:child_process";

import { gabarit, NOM, SITE } from "./courriels-gabarits.mjs";
export { gabarit };

async function envoyer(cle, expediteur, a, m) {
  const r = await fetch(process.env.BREVO_API || "https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": cle, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { name: NOM, email: expediteur }, to: [{ email: a }], subject: m.sujet, htmlContent: m.html, textContent: m.texte })
  });
  if (!r.ok) { let x = ""; try { x = ((await r.json()) || {}).message || ""; } catch { /* corps illisible */ } throw new Error(`envoi refusé (${r.status}${x ? " : " + x : ""})`); }
}

async function principal() {
  const url = process.env.SUPABASE_DB_URL || "", cle = process.env.BREVO_API_KEY || "", expediteur = process.env.RECAP_EXPEDITEUR || "";
  if (!url || !cle || !expediteur) {
    console.log("::warning::Il manque " + [!url && "SUPABASE_DB_URL", !cle && "BREVO_API_KEY", !expediteur && "RECAP_EXPEDITEUR"].filter(Boolean).join(", ") + " : aucun e-mail ne part, la file attend.");
    return;
  }
  const sql = (q, vars = {}) => execFileSync("psql", [url, "-qtA", "-v", "ON_ERROR_STOP=1", ...Object.entries(vars).flatMap(([k, v]) => ["-v", `${k}=${v}`])],
    { input: q + ";\n" }).toString().trim();
  const file = JSON.parse(sql("select prive.courriels_a_envoyer()") || "[]");
  let ok = 0, ko = 0;
  for (const c of file) {
    try {
      // « equipe » : l'adresse du site elle-même (l'adresse d'expédition), jamais écrite dans le dépôt.
      await envoyer(cle, expediteur, c.destinataire === "equipe" ? expediteur : c.destinataire, gabarit(c.genre, c.donnees || {}));
      sql("select prive.courriel_fait(:i, true)", { i: c.id });
      ok++;
    } catch (e) {
      sql("select prive.courriel_fait(:i, false, :'e')", { i: c.id, e: e.message });
      ko++;
      console.log(`::warning::E-mail ${c.id} (${c.genre}) non envoyé : ${e.message}`);
    }
  }
  // Les adresses ne s'écrivent jamais dans le journal (dépôt public).
  console.log(`E-mails en attente : ${file.length} ; envoyés : ${ok} ; en échec : ${ko}.`);
  if (ko && !ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) principal().catch((e) => { console.log("::error::" + e.message); process.exitCode = 1; });
