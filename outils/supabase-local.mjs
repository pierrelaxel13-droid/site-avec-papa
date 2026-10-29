/* ==========================================================================
   Une imitation de Supabase, pour essayer les comptes sur un poste
   --------------------------------------------------------------------------
   POUR LES ESSAIS SEULEMENT. Elle répond comme Supabase aux appels que fait
   assets/vigie.js — mêmes adresses, mêmes réponses, mêmes codes d'erreur :
     /auth/v1/signup, token (password, refresh_token), recover, resend,
     verify (le lien du courriel), user (GET, PUT), logout
     /rest/v1/rpc/<fonction>   exécutée sur une VRAIE base PostgreSQL, avec
                               le schéma de supabase/migrations et ses règles
   Les courriels ne partent pas : ils sont rangés, et lisibles sur
   GET /_courriels (le dernier lien de chacun se clique comme dans une boîte).

   Préparer la base une fois (PostgreSQL local, voir supabase/README.md) :
     createdb vigie_local
     psql -d vigie_local -f supabase/tests/emulation-supabase.sql
     for f in supabase/migrations/*.sql; do psql -d vigie_local -1 -f "$f"; done

   Puis :
     node outils/supabase-local.mjs            (port 8830)
     VIGIE_SUPABASE=http://localhost:8830 node build.mjs
   Réglages : PORT, PGHOST, PGPORT, PGUSER, PGDATABASE (défaut vigie_local),
   VIGIE_EXPIRE (durée d'un jeton en secondes, défaut 3600).
   ========================================================================== */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PORT = Number(process.env.PORT || 8830);
const CLE = "sb_publishable_zJXo39cN5hEAdCQFwm5DkA_ru99Xodj";   // la clé publique du site
const EXPIRE = Number(process.env.VIGIE_EXPIRE || 3600);
const BASE = process.env.PGDATABASE || "vigie_local";

const comptes = new Map();     // courriel → { id, courriel, empreinte, sel, confirme, cree }
const jetons = new Map();      // jeton d'accès → { id, expire }
const renouvellements = new Map();   // jeton de renouvellement → id
const liens = new Map();       // jeton de lien → { id, type, redirige, nouvelle? , moitie? }
const courriels = [];

const empreinte = (mdp, sel) => scryptSync(mdp, sel, 32);
const parId = (id) => [...comptes.values()].find((c) => c.id === id);
const valide = (a) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a || "");
const utilisateur = (c) => ({
  id: c.id, aud: "authenticated", role: "authenticated", email: c.courriel,
  email_confirmed_at: c.confirme || null, new_email: c.nouvelle || undefined,
  created_at: c.cree, identities: [{ provider: "email" }]
});
function session(c) {
  const acces = "acces_" + randomBytes(18).toString("hex");
  const renouv = "renouv_" + randomBytes(18).toString("hex");
  jetons.set(acces, { id: c.id, expire: Math.floor(Date.now() / 1000) + EXPIRE });
  renouvellements.set(renouv, c.id);
  return { access_token: acces, token_type: "bearer", expires_in: EXPIRE,
           expires_at: Math.floor(Date.now() / 1000) + EXPIRE, refresh_token: renouv, user: utilisateur(c) };
}
function envoie(a, sujet, id, type, redirige, extra = {}) {
  const jeton = randomBytes(16).toString("hex");
  liens.set(jeton, { id, type, redirige, ...extra });
  const lien = `http://localhost:${PORT}/auth/v1/verify?token=${jeton}&type=${type}&redirect_to=${encodeURIComponent(redirige)}`;
  courriels.push({ a, sujet, lien, le: new Date().toISOString() });
  console.log(`  courriel → ${a} : ${sujet}\n    ${lien}`);
}
const erreurAuth = (statut, code, msg) => [statut, { code: statut, error_code: code, msg }];

/* Une requête SQL sur la vraie base, en tant que la personne (ou anon) ;
   « systeme » : en tant que Supabase lui-même (la table auth.users). */
const SYSTEME = "systeme";
function sql(requete, claims) {
  return new Promise((ok) => {
    const args = ["-v", "ON_ERROR_STOP=1", "-qtA", "-d", BASE];
    const p = spawn("psql", args, { env: process.env });
    let sortie = "", err = "";
    p.stdout.on("data", (d) => (sortie += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => ok({ code, sortie: sortie.trim(), err }));
    const role = claims === SYSTEME ? "" : `set local role ${claims ? "authenticated" : "anon"};`;
    p.stdin.end(`\\set VERBOSITY verbose
begin;
${role}
select set_config('request.jwt.claims', '${JSON.stringify(claims === SYSTEME ? {} : claims || {}).replace(/'/g, "''")}', true) \\g /dev/null
${requete};
commit;
`);
  });
}
const litteral = (v) => v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`;
const RPC = {
  mes_entreprises: () => "select coalesce(json_agg(t), '[]') from public.mes_entreprises() t",
  suis_administrateur: () => "select to_json(public.suis_administrateur())",
  admin_vue: () => "select public.admin_vue()",
  admin_abonnement: (a) => `select public.admin_abonnement(${litteral(a.entreprise)}, ${litteral(a.nouvelle_formule)}) \\g /dev/null
select 'null'`,
  creer_entreprise: (a) => `select to_json(public.creer_entreprise(${litteral(a.denomination)}, ${litteral(a.naf)}, ${a.effectif ? Number(a.effectif) : "null"}))`
};

async function auth(chemin, q, corps, porteur) {
  const redirige = q.get("redirect_to") || "http://localhost:8811/compte/";
  if (chemin === "/auth/v1/signup") {
    const a = (corps.email || "").trim().toLowerCase();
    if (!valide(a)) return erreurAuth(400, "email_address_invalid", `Email address "${a}" is invalid`);
    if (!corps.password || corps.password.length < 6)
      return erreurAuth(422, "weak_password", "Password should be at least 6 characters.");
    const deja = comptes.get(a);
    if (deja && deja.confirme)   // comme Supabase : rien ne dit que l'adresse existe
      return [200, { id: randomUUID(), email: a, identities: [], aud: "authenticated", role: "" }];
    const sel = randomBytes(16);
    const c = deja || { id: randomUUID(), courriel: a, cree: new Date().toISOString(), confirme: null };
    Object.assign(c, { sel, empreinte: empreinte(corps.password, sel) });
    if (!deja) {
      comptes.set(a, c);
      const r = await sql(`insert into auth.users (id, email) values (${litteral(c.id)}, ${litteral(a)})`, SYSTEME).catch(() => null);
      if (r && r.code) { console.error(r.err); }
    }
    envoie(a, "Confirmez votre adresse", c.id, "signup", redirige);
    return [200, utilisateur(c)];
  }
  if (chemin === "/auth/v1/token" && q.get("grant_type") === "password") {
    const c = comptes.get((corps.email || "").trim().toLowerCase());
    if (!c || !timingSafeEqual(empreinte(corps.password || "", c.sel), c.empreinte))
      return erreurAuth(400, "invalid_credentials", "Invalid login credentials");
    if (!c.confirme) return erreurAuth(400, "email_not_confirmed", "Email not confirmed");
    await sql(`update auth.users set last_sign_in_at = now() where id = ${litteral(c.id)}`, SYSTEME);
    return [200, session(c)];
  }
  if (chemin === "/auth/v1/token" && q.get("grant_type") === "refresh_token") {
    const id = renouvellements.get(corps.refresh_token);
    if (!id) return erreurAuth(400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
    renouvellements.delete(corps.refresh_token);
    return [200, session(parId(id))];
  }
  if (chemin === "/auth/v1/recover") {
    const c = comptes.get((corps.email || "").trim().toLowerCase());
    if (c) envoie(c.courriel, "Choisir un nouveau mot de passe", c.id, "recovery", redirige);
    return [200, {}];
  }
  if (chemin === "/auth/v1/resend") {
    const c = comptes.get((corps.email || "").trim().toLowerCase());
    if (c && !c.confirme) envoie(c.courriel, "Confirmez votre adresse", c.id, "signup", redirige);
    return [200, {}];
  }
  // À partir d'ici, il faut être connecté.
  const j = jetons.get(porteur);
  if (!j || j.expire < Date.now() / 1000) return erreurAuth(403, "bad_jwt", "invalid JWT: unable to parse or verify signature");
  const c = parId(j.id);
  if (chemin === "/auth/v1/user" && !corps) return [200, utilisateur(c)];
  if (chemin === "/auth/v1/user") {
    if (corps.password) {
      if (corps.password.length < 6) return erreurAuth(422, "weak_password", "Password should be at least 6 characters.");
      if (timingSafeEqual(empreinte(corps.password, c.sel), c.empreinte))
        return erreurAuth(422, "same_password", "New password should be different from the old password.");
      c.sel = randomBytes(16); c.empreinte = empreinte(corps.password, c.sel);
    }
    if (corps.email) {
      const a = corps.email.trim().toLowerCase();
      if (!valide(a)) return erreurAuth(400, "email_address_invalid", `Email address "${a}" is invalid`);
      if (comptes.has(a)) return erreurAuth(422, "email_exists", "A user with this email address has already been registered");
      c.nouvelle = a; c.moities = 0;
      // « Secure email change » (le réglage par défaut) : un lien à chaque adresse.
      envoie(c.courriel, "Confirmez le changement d'adresse", c.id, "email_change", redirige);
      envoie(a, "Confirmez votre nouvelle adresse", c.id, "email_change", redirige);
    }
    return [200, utilisateur(c)];
  }
  if (chemin === "/auth/v1/logout") {
    for (const [k, v] of jetons) if (v.id === c.id) jetons.delete(k);
    for (const [k, v] of renouvellements) if (v === c.id) renouvellements.delete(k);
    return [204, null];
  }
  return [404, { code: 404, error_code: "not_found", msg: "Not found" }];
}

function verifie(q) {
  const l = liens.get(q.get("token"));
  const vers = q.get("redirect_to") || (l && l.redirige) || "http://localhost:8811/compte/";
  if (!l) return vers + "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
  liens.delete(q.get("token"));
  const c = parId(l.id);
  if (l.type === "email_change") {
    c.moities = (c.moities || 0) + 1;
    if (c.moities < 2) return vers + "#message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email";
    comptes.delete(c.courriel); c.courriel = c.nouvelle; delete c.nouvelle; comptes.set(c.courriel, c);
    sql(`update auth.users set email = ${litteral(c.courriel)} where id = ${litteral(c.id)}`, SYSTEME);
  }
  if (l.type === "signup") {
    c.confirme = c.confirme || new Date().toISOString();
    sql(`update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = ${litteral(c.id)}`, SYSTEME);
  }
  const s = session(c);
  return vers + `#access_token=${s.access_token}&expires_at=${s.expires_at}&expires_in=${s.expires_in}` +
    `&refresh_token=${s.refresh_token}&token_type=bearer&type=${l.type}`;
}

async function rest(chemin, corps, porteur) {
  const nom = chemin.replace("/rest/v1/rpc/", "");
  if (!RPC[nom]) return [404, { code: "PGRST202", message: `Could not find the function public.${nom}`, details: null, hint: null }];
  let claims = null;
  if (porteur && porteur !== CLE) {
    const j = jetons.get(porteur);
    if (!j || j.expire < Date.now() / 1000) return [401, { code: "PGRST301", message: "JWT expired", details: null, hint: null }];
    const c = parId(j.id);
    claims = { sub: c.id, email: c.courriel, role: "authenticated" };
  }
  const r = await sql(RPC[nom](corps || {}), claims);
  if (r.code) {
    const m = r.err.match(/ERROR:\s+([0-9A-Z]{5}): (.*)/);
    const code = m ? m[1] : "XX000";
    return [code === "42501" ? (claims ? 403 : 401) : 400, { code, message: m ? m[2] : r.err.trim(), details: null, hint: null }];
  }
  return [200, JSON.parse(r.sortie || "null")];
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  };
  const repond = (statut, j) => {
    res.writeHead(statut, { ...cors, ...(j === null ? {} : { "Content-Type": "application/json" }) });
    res.end(j === null ? undefined : JSON.stringify(j));
  };
  if (req.method === "OPTIONS") return repond(204, null);
  if (url.pathname === "/_courriels") return repond(200, courriels);
  if (url.pathname === "/auth/v1/verify") {
    res.writeHead(303, { Location: verifie(url.searchParams) });
    return res.end();
  }
  if (req.headers.apikey !== CLE) return repond(401, { message: "Invalid API key" });
  let texte = "";
  for await (const morceau of req) texte += morceau;
  let corps = null;
  try { corps = texte ? JSON.parse(texte) : null; } catch { return repond(400, { message: "JSON invalide" }); }
  const porteur = (req.headers.authorization || "").replace(/^Bearer /, "");
  try {
    const [statut, j] = url.pathname.startsWith("/auth/v1/")
      ? await auth(url.pathname, url.searchParams, req.method === "GET" ? null : corps || {}, porteur)
      : url.pathname.startsWith("/rest/v1/rpc/") ? await rest(url.pathname, corps, porteur)
      : [404, { message: "Non imité ici" }];
    repond(statut, j);
  } catch (e) {
    console.error(e);
    repond(500, { message: String(e) });
  }
}).listen(PORT, () => console.log(`Imitation de Supabase sur http://localhost:${PORT} (base ${BASE}) — POUR LES ESSAIS`));
