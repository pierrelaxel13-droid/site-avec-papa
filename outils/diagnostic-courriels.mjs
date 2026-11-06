#!/usr/bin/env node
/* Vigie — le journal d'envoi de Brevo, sans adresse en entier (dépôt public).
   Lancé par .github/workflows/diagnostic-courriels.yml. Secret : BREVO_API_KEY. */
const cle = process.env.BREVO_API_KEY || "";
const masque = (a) => { const [u, d] = String(a || "").split("@"); return d ? `${u.slice(0, 1)}…@${d}` : "?"; };
const brevo = async (chemin) => {
  const r = await fetch("https://api.brevo.com/v3" + chemin, { headers: { "api-key": cle, accept: "application/json" } });
  if (!r.ok) throw new Error(`Brevo ${chemin.split("?")[0]} : ${r.status}`);
  return r.json();
};

if (!cle) { console.log("::warning::BREVO_API_KEY absent."); process.exit(0); }
try {
  const s = await brevo("/senders");
  for (const x of s.senders || []) console.log(`Expéditeur ${masque(x.email)} : ${x.active ? "validé" : "NON VALIDÉ"}`);
} catch (e) { console.log("Expéditeurs : " + e.message); }
try {
  const d = await brevo("/senders/domains");
  for (const x of d.domains || []) console.log(`Domaine ${x.domain_name} : authentifié ${x.authenticated ? "oui" : "NON"} ; vérifié ${x.verified ? "oui" : "NON"}`);
} catch (e) { console.log("Domaines : " + e.message); }
// 4. Un e-mail d'essai à l'adresse du site elle-même, puis ce que Brevo en a fait.
const exp = process.env.RECAP_EXPEDITEUR || "";
if (process.env.ESSAI && exp) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST",
    headers: { "api-key": cle, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { name: "Vigie réglementaire", email: exp }, to: [{ email: exp }],
      subject: "Essai d'envoi — Vigie réglementaire", textContent: "Si vous lisez ceci, les e-mails du site partent bien.",
      htmlContent: "<p>Si vous lisez ceci, les e-mails du site partent bien.</p>" }) });
  const j = await r.json().catch(() => ({}));
  console.log(`\nE-mail d'essai à ${masque(exp)} : ${r.ok ? "accepté par Brevo" : "refusé (" + r.status + " " + (j.message || "") + ")"}`);
  if (j.messageId) {
    for (let k = 0; k < 8; k++) {
      await new Promise((ok) => setTimeout(ok, 5000));
      const e = await brevo("/smtp/statistics/events?limit=10&days=1&messageId=" + encodeURIComponent(j.messageId)).catch(() => ({}));
      const l = (e.events || []).map((x) => x.event + (x.reason ? " (" + x.reason + ")" : ""));
      if (l.some((x) => /delivered|error|bounce|blocked|invalid/i.test(x))) { console.log("Résultat : " + l.join(", ")); break; }
      if (k === 7) console.log("Résultat après 40 s : " + (l.join(", ") || "rien encore"));
    }
  }
}

try {
  const j = await brevo("/smtp/statistics/events?limit=20&days=1&sort=desc");
  const ev = j.events || [];
  console.log(`\nJournal Brevo, 2 derniers jours : ${ev.length} événement(s)`);
  for (const e of ev) {
    const h = new Date(e.date).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    console.log(`${h}  ${String(e.event).padEnd(12)} ${masque(e.email).padEnd(28)} ${String(e.subject || "").slice(0, 60)}${e.reason ? "  — " + e.reason : ""}`);
  }
} catch (e) { console.log("Journal : " + e.message); }
