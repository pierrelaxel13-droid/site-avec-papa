/* ==========================================================================
   Vigie réglementaire — les gabarits des e-mails automatiques (6 novembre 2026)
   --------------------------------------------------------------------------
   Sortis de outils/courriels.mjs pour servir à deux endroits : le robot
   (GitHub, toutes les 10 minutes, en secours) et la fonction Supabase
   « vigie » (supabase/functions/vigie), qui envoie aussitôt. Aucun accès
   réseau ni base ici : seulement le sujet, le HTML et le texte de chaque e-mail.
   ========================================================================== */
// Sous Node (robot) comme sous Deno (fonction Supabase) : process n'existe pas partout.
const ENV = (globalThis.process && globalThis.process.env) || {};
export const SITE = ENV.RECAP_SITE || "https://vigie-reglementaire.fr/";
export const NOM = "Vigie réglementaire";
/* Les adresses fictives (comptes du test automatique, exemples) : jamais envoyées. Un envoi vers
   elles revient en « rebond définitif » chez Brevo, ce qui abîme la réputation du domaine et
   envoie nos vrais e-mails en indésirables (7 novembre 2026). */
export const factice = (a) => /@((?:[^@]+\.)?example\.(?:com|org|net)|[^@]+\.(?:test|invalid|example|localhost))$/i.test(String(a || "").trim());
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
  if (genre === "nouveau_compte") {
    // Pour l'équipe (6 novembre 2026) : un nouveau compte vient de s'ouvrir.
    const sujet = `Nouveau compte : ${d.espace || "?"} (${d.type || "?"})`;
    const quand = d.le ? new Date(d.le).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" }) : "";
    const lignes = [["Espace", d.espace], ["Type", d.type], ["Cabinet", d.cabinet], ["Compte", d.courriel], ["Le", quand]].filter((x) => x[1]);
    return {
      sujet,
      html: cadre(sujet, "Un nouveau compte vient de s'ouvrir sur le site.",
        `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6">${lignes.map(([k, v]) =>
          `<tr><td style="padding:2px 14px 2px 0;color:#5E5E79">${esc(k)}</td><td style="padding:2px 0"><strong>${esc(v)}</strong></td></tr>`).join("")}</table>`,
        "Ouvrir l'administration", `${SITE}compte/admin.html`, "E-mail envoyé à l'équipe du site à chaque nouveau compte."),
      texte: [`${NOM}`, "", "Un nouveau compte vient de s'ouvrir sur le site.", "", ...lignes.map(([k, v]) => `${k} : ${v}`), "", `${SITE}compte/admin.html`].join("\n")
    };
  }
  throw new Error(`genre d'e-mail inconnu : ${genre}`);
}
