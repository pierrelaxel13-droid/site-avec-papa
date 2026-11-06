#!/usr/bin/env node
/* Vigie — le journal de la fonction serveur « vigie » (dernière heure), par l'API de gestion
   Supabase. Les messages de la fonction ne contiennent jamais d'adresse (masquées). */
const jeton = (process.env.SUPABASE_ACCESS_TOKEN || "").trim(), ref = "denpxyqbvjcwsbxjtqpd";
if (!jeton) { console.log("SUPABASE_ACCESS_TOKEN absent."); process.exit(0); }
const fin = new Date(), debut = new Date(fin - 3600e3);
const q = async (sql) => {
  const u = `https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs?` + new URLSearchParams({
    sql, iso_timestamp_start: debut.toISOString(), iso_timestamp_end: fin.toISOString() });
  const r = await fetch(u, { headers: { Authorization: `Bearer ${jeton}` } });
  if (!r.ok) return { erreur: r.status + " " + (await r.text()).slice(0, 200) };
  return r.json();
};
const masque = (s) => String(s || "").replace(/[\w.+-]+@[\w.-]+/g, "…@…");
const h = (t) => new Date(Number(t) / 1000).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" });
const a = await q("select timestamp, event_message, metadata.level from function_logs cross join unnest(metadata) as metadata order by timestamp desc limit 40");
console.log("Messages de la fonction (dernière heure) :");
if (a.erreur) console.log("  " + a.erreur); else for (const x of (a.result || []).reverse()) console.log(`  ${h(x.timestamp)}  ${x.level || ""}  ${masque(x.event_message).slice(0, 220)}`);
const b = await q("select timestamp, response.status_code, request.method from function_edge_logs cross join unnest(metadata) as m cross join unnest(m.response) as response cross join unnest(m.request) as request order by timestamp desc limit 40");
console.log("\nAppels reçus (dernière heure) :");
if (b.erreur) console.log("  " + b.erreur); else for (const x of (b.result || []).reverse()) console.log(`  ${h(x.timestamp)}  ${x.method}  ${x.status_code}`);
