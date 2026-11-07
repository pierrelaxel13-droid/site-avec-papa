#!/usr/bin/env node
/* ==========================================================================
   Vigie réglementaire — les e-mails de Supabase Auth par Brevo (6 novembre 2026)
   --------------------------------------------------------------------------
   Confirmation d'inscription, mot de passe oublié, changement d'adresse :
   Supabase les envoie lui-même. Par défaut, il passe par son propre serveur,
   limité à quelques e-mails par heure, en anglais, depuis une adresse
   Supabase. Ce script lui donne le serveur SMTP de Brevo, l'adresse du site
   comme expéditeur et des modèles en français.

   Lancé par .github/workflows/fonctions.yml. Secrets (jamais dans le code) :
     SUPABASE_ACCESS_TOKEN  jeton personnel Supabase (Account → Access Tokens) ;
     BREVO_API_KEY          pour lire l'identifiant SMTP du compte Brevo ;
     BREVO_SMTP_KEY         la clé SMTP Brevo (SMTP & API → SMTP) ;
     RECAP_EXPEDITEUR       l'adresse d'expédition validée chez Brevo.
   Le journal ne montre ni clé, ni identifiant, ni adresse.
   ========================================================================== */
const REF = process.env.SUPABASE_PROJET || "denpxyqbvjcwsbxjtqpd";
const NOM = "Vigie réglementaire";
const SITE = "https://vigie-reglementaire.fr/";

function modele(titre, intro, bouton, apres) {
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#F4F3FA;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3FA"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px">
<tr><td style="padding:22px 24px;border-bottom:3px solid #4A2BE8">
  <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#4A2BE8">${NOM}</div>
  <div style="margin-top:6px;font-size:20px;font-weight:700;color:#15152B">${titre}</div></td></tr>
<tr><td style="padding:20px 24px 4px;font-size:15px;line-height:1.55;color:#15152B">
  <p style="margin:0 0 12px">Bonjour,</p><p style="margin:0 0 12px">${intro}</p></td></tr>
<tr><td align="center" style="padding:14px 24px 8px">
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 24px;border-radius:999px;background:#4A2BE8;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">${bouton}</a></td></tr>
<tr><td style="padding:16px 24px 22px;font-size:12px;line-height:1.5;color:#5E5E79">${apres}<br>
  ${NOM} · <a href="${SITE}" style="color:#5E5E79">vigie-reglementaire.fr</a> · Ne constitue pas un conseil juridique.</td></tr>
</table></td></tr></table></body></html>`;
}
const SANS = "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail.";

export function reglages({ login, cle, expediteur }) {
  return {
    external_email_enabled: true,
    smtp_host: "smtp-relay.brevo.com", smtp_port: "587", smtp_user: login, smtp_pass: cle,
    smtp_admin_email: expediteur, smtp_sender_name: NOM, smtp_max_frequency: 30,
    rate_limit_email_sent: 100,
    // La sécurité des comptes (7 novembre 2026, revue de sécurité) :
    password_min_length: 10,                    // comme le site ; Supabase acceptait 6 par un appel direct
    mailer_autoconfirm: false,                  // l'adresse doit être confirmée avant d'entrer
    mailer_secure_email_change_enabled: true,   // changer d'adresse : confirmation sur l'ancienne ET la nouvelle
    refresh_token_rotation_enabled: true,       // un jeton de session volé ne sert qu'une fois
    security_refresh_token_reuse_interval: 10,
    mailer_subjects_confirmation: "Confirmez votre adresse — Vigie réglementaire",
    mailer_templates_confirmation_content: modele("Confirmez votre adresse",
      "Vous venez de créer votre compte Vigie réglementaire. Pour l'activer, confirmez votre adresse électronique :",
      "Confirmer mon adresse", "Ce lien est valable 24 heures. " + SANS),
    mailer_subjects_recovery: "Choisir un nouveau mot de passe — Vigie réglementaire",
    mailer_templates_recovery_content: modele("Nouveau mot de passe",
      "Vous avez demandé à changer le mot de passe de votre compte Vigie réglementaire :",
      "Choisir un nouveau mot de passe", "Ce lien est valable une heure. " + SANS),
    mailer_subjects_email_change: "Confirmez votre nouvelle adresse — Vigie réglementaire",
    mailer_templates_email_change_content: modele("Nouvelle adresse électronique",
      "Vous avez demandé à remplacer l'adresse de votre compte par {{ .NewEmail }}. Confirmez ce changement :",
      "Confirmer le changement", SANS),
    mailer_subjects_magic_link: "Votre lien de connexion — Vigie réglementaire",
    mailer_templates_magic_link_content: modele("Votre lien de connexion",
      "Voici votre lien pour vous connecter à Vigie réglementaire :", "Me connecter", SANS),
    mailer_subjects_invite: "Votre invitation — Vigie réglementaire",
    mailer_templates_invite_content: modele("Votre invitation",
      "Vous êtes invité à rejoindre Vigie réglementaire :", "Accepter l'invitation", SANS)
  };
}

async function principal() {
  const jeton = process.env.SUPABASE_ACCESS_TOKEN || "", brevo = process.env.BREVO_API_KEY || "",
    cle = process.env.BREVO_SMTP_KEY || "", expediteur = process.env.RECAP_EXPEDITEUR || "";
  const manque = [!jeton && "SUPABASE_ACCESS_TOKEN", !brevo && "BREVO_API_KEY", !cle && "BREVO_SMTP_KEY", !expediteur && "RECAP_EXPEDITEUR"].filter(Boolean);
  if (manque.length) { console.log("::warning::Il manque " + manque.join(", ") + " : les e-mails de confirmation restent ceux de Supabase."); return; }

  // L'identifiant SMTP du compte Brevo (de la forme …@smtp-brevo.com).
  const r = await fetch("https://api.brevo.com/v3/account", { headers: { "api-key": brevo, accept: "application/json" } });
  if (!r.ok) throw new Error(`Brevo refuse la lecture du compte (${r.status}) : vérifiez BREVO_API_KEY.`);
  const compte = await r.json();
  const relais = (compte.relay && compte.relay.data) || {};
  const login = relais.userName || "";
  if (!login) throw new Error("Brevo ne donne pas d'identifiant SMTP : activez le SMTP dans Brevo (SMTP & API).");
  console.log(`Brevo : identifiant SMTP trouvé ; relais ${relais.relay || "smtp-relay.brevo.com"}:${relais.port || 587}.`);

  const api = `https://api.supabase.com/v1/projects/${REF}/config/auth`;
  const entetes = { Authorization: `Bearer ${jeton}`, "content-type": "application/json" };
  const avant = await fetch(api, { headers: entetes });
  if (!avant.ok) throw new Error(`Supabase refuse la lecture des réglages (${avant.status}) : vérifiez SUPABASE_ACCESS_TOKEN.`);
  const a = await avant.json();
  console.log(`Avant : SMTP ${a.smtp_host ? "personnalisé (" + a.smtp_host + ")" : "celui de Supabase"} ; limite ${a.rate_limit_email_sent ?? "?"} e-mails par heure ; adresse du site ${a.site_url || "?"}.`);

  const p = await fetch(api, { method: "PATCH", headers: entetes, body: JSON.stringify(reglages({ login, cle, expediteur })) });
  if (!p.ok) { let m = ""; try { m = ((await p.json()) || {}).message || ""; } catch { /* rien */ } throw new Error(`Supabase refuse les réglages (${p.status}${m ? " : " + m : ""}).`); }
  const b = await p.json();
  console.log(`Après : SMTP ${b.smtp_host} ; expéditeur « ${b.smtp_sender_name} » ; limite ${b.rate_limit_email_sent} e-mails par heure ; modèles en français.`);
  console.log(`Sécurité des comptes : mot de passe d'au moins ${b.password_min_length} caractères ; adresse à confirmer : ${b.mailer_autoconfirm ? "NON" : "oui"} ; ` +
    `changement d'adresse doublement confirmé : ${b.mailer_secure_email_change_enabled ? "oui" : "NON"} ; jetons de session renouvelés : ${b.refresh_token_rotation_enabled ? "oui" : "NON"}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) principal().catch((e) => { console.log("::error::" + e.message); process.exitCode = 1; });
