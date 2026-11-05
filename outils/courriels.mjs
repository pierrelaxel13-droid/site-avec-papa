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

const SITE = process.env.RECAP_SITE || "https://vigie-reglementaire.fr/";
const NOM = "Vigie réglementaire";
const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const jour = (iso) => (iso ? new Date(String(iso).slice(0, 10) + "T12:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "");
const ROLES = { admin: "responsable du compte", membre: "utilisateur", lecteur: "utilisateur en lecture seule" };

function cadre(titre, intro, corps, bouton, lien, pied) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titre)}</title></head>
<body style="margin:0;padding:0;background:#F4F3FA;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3FA"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="padding:22px 24px;border-bottom:3px solid #4A2BE8">
  <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#4A2BE8">${NOM}</div>
  <div style="margin-top:6px;font-size:20px;font-weight:700;color:#15152B">${esc(titre)}</div>
</td></tr>
<tr><td style="padding:20px 24px 4px;font-size:15px;line-height:1.55;color:#15152B">
  <p style="margin:0 0 12px">Bonjour,</p>
  <p style="margin:0 0 12px">${intro}</p>
  ${corps}
</td></tr>
<tr><td align="center" style="padding:14px 24px 8px">
  <a href="${esc(lien)}" style="display:inline-block;padding:13px 24px;border-radius:999px;background:#4A2BE8;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">${esc(bouton)}</a>
</td></tr>
<tr><td style="padding:16px 24px 22px;font-size:12px;line-height:1.5;color:#5E5E79">${pied}<br>
  ${NOM} · <a href="${SITE}" style="color:#5E5E79">vigie-reglementaire.fr</a> · Ne constitue pas un conseil juridique.</td></tr>
</table></td></tr></table></body></html>`;
}

/* Le contenu de chaque genre d'e-mail : sujet, HTML et texte brut. */
export function gabarit(genre, d) {
  if (genre === "invitation") {
    const lien = `${SITE}compte/invitation.html#jeton=${encodeURIComponent(d.jeton || "")}`;
    const espace = d.espace || "votre espace";
    const quoi = d.type === "cabinet"
      ? `Vous êtes invité à rejoindre le cabinet « ${esc(espace)} » sur ${NOM}, comme ${esc(ROLES[d.role] || "utilisateur")}.`
      : d.cabinet && d.role === "admin"
        ? `Le cabinet « ${esc(d.cabinet)} » a ouvert l'espace de veille réglementaire de « ${esc(espace)} » sur ${NOM}. Vous en serez le responsable du compte.`
        : `Vous êtes invité à rejoindre l'espace de veille réglementaire de « ${esc(espace)} » sur ${NOM}, comme ${esc(ROLES[d.role] || "utilisateur")}.`;
    const par = d.par ? `<p style="margin:0 0 12px;color:#5E5E79;font-size:13px">Invitation envoyée par ${esc(d.par)}.</p>` : "";
    const corps = `${par}<p style="margin:0 0 12px">Vous y trouverez les textes réglementaires qui s'appliquent à l'entreprise, leur analyse, le plan d'actions et le registre de conformité.</p>
  <p style="margin:0 0 4px">Pour accepter, créez votre compte avec <strong>cette adresse e-mail</strong> en ouvrant le lien ci-dessous.</p>`;
    const sujet = d.type === "cabinet" ? `Invitation à rejoindre « ${espace} » sur ${NOM}` : `Votre espace de veille réglementaire « ${espace} »`;
    return {
      sujet,
      html: cadre(sujet, quoi, corps, "Accepter l'invitation", lien,
        "Le lien est valable 7 jours et ne sert qu'une fois. Si vous ne vous attendiez pas à cette invitation, ignorez simplement cet e-mail."),
      texte: [`${NOM}`, "", "Bonjour,", "", quoi.replace(/&quot;/g, '"').replace(/&amp;/g, "&"), d.par ? `Invitation envoyée par ${d.par}.` : "",
        "", "Pour accepter, créez votre compte avec cette adresse e-mail en ouvrant ce lien (valable 7 jours, une seule fois) :", lien].filter((x) => x !== null).join("\n")
    };
  }
  if (genre === "facture") {
    const lien = `${SITE}compte/`;
    const montant = d.montant_ttc != null ? ` d'un montant de ${Number(d.montant_ttc).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} € TTC` : "";
    const sujet = `Nouvelle facture disponible — ${d.numero}`;
    const intro = `Une nouvelle facture${montant} est disponible pour « ${esc(d.espace || "")} » : la facture <strong>${esc(d.numero)}</strong> du ${esc(jour(d.emise_le))}.`;
    return {
      sujet,
      html: cadre(sujet, intro, `<p style="margin:0 0 4px">Vous la retrouvez dans Mon compte, rubrique « Mes factures », à télécharger en PDF.</p>`,
        "Voir mes factures", lien, "Vous recevez cet e-mail parce que vous êtes le responsable du compte de cet espace."),
      texte: [`${NOM}`, "", "Bonjour,", "", `Une nouvelle facture${montant} est disponible pour « ${d.espace || ""} » : la facture ${d.numero} du ${jour(d.emise_le)}.`,
        "", `Vous la retrouvez dans Mon compte, rubrique « Mes factures » : ${lien}`].join("\n")
    };
  }
  throw new Error(`genre d'e-mail inconnu : ${genre}`);
}

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
      await envoyer(cle, expediteur, c.destinataire, gabarit(c.genre, c.donnees || {}));
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
