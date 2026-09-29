/* ==========================================================================
   Vigie — radar de veille
   Angle : famille de veille. Distance au centre : fréquence de revue
   (au plus près, la veille quotidienne). Un point cerclé d’orange est en retard.
   ========================================================================== */

const RAD = { W: 760, C: 380, R0: 64, BANDE: 66, ESPACE: 25 };
const RAD_R = RAD.R0 + RAD.BANDE * 4;
const rad = (deg) => (deg * Math.PI) / 180;
const pt = (r, a) => [RAD.C + r * Math.cos(rad(a)), RAD.C + r * Math.sin(rad(a))];
const f2 = (n) => Math.round(n * 100) / 100;

/* Répartit les domaines dans leur cellule (famille × fréquence). */
function placer(P) {
  const cellules = {};
  P.forEach((p) => {
    const fi = Math.max(0, FAM.indexOf(p.dom.famille));
    const bi = Math.max(0, FREQ.indexOf(p.frequence));
    (cellules[fi + "|" + bi] = cellules[fi + "|" + bi] || []).push(p);
  });
  const points = [];
  Object.keys(cellules).forEach((k) => {
    const c = k.split("|").map(Number);
    const fi = c[0];
    const bi = c[1];
    const items = cellules[k];
    const r0 = RAD.R0 + bi * RAD.BANDE;
    const a0 = -90 + fi * 45 + 10;
    const etendue = 25;
    let idx = 0;
    let rang = 0;
    while (idx < items.length) {
      const r = r0 + 13 + (rang % 3) * 22;
      const cap = Math.max(1, Math.floor((rad(etendue) * r) / RAD.ESPACE) + 1);
      const lot = items.slice(idx, idx + cap);
      lot.forEach((p, j) => {
        const a = lot.length === 1 ? a0 + etendue / 2 : a0 + (etendue * j) / (lot.length - 1);
        const xy = pt(r, a);
        points.push({ p: p, x: f2(xy[0]), y: f2(xy[1]), bi: bi });
      });
      idx += cap;
      rang++;
    }
  });
  return points;
}

function libelleCourt(nom, max) {
  return nom.length > max ? nom.slice(0, max - 1).trimEnd() + "…" : nom;
}

function radarSVG(P) {
  const points = placer(P);
  const parFam = {};
  P.forEach((p) => (parFam[p.dom.famille] = (parFam[p.dom.famille] || 0) + 1));
  let g = "";

  /* bandes et anneaux */
  for (let i = 0; i < 4; i++) {
    const r = RAD.R0 + (i + 1) * RAD.BANDE;
    g += '<circle class="rd-ring" cx="' + RAD.C + '" cy="' + RAD.C + '" r="' + r + '"/>';
  }
  /* graduations extérieures, comme sur un compas de relèvement */
  for (let a = 0; a < 360; a += 5) {
    const long = a % 45 === 0;
    const p1 = pt(RAD_R, a);
    const p2 = pt(RAD_R - (long ? 11 : 5), a);
    g += '<line class="rd-grad' + (long ? " long" : "") + '" x1="' + f2(p1[0]) + '" y1="' + f2(p1[1]) + '" x2="' + f2(p2[0]) + '" y2="' + f2(p2[1]) + '"/>';
  }
  /* rayons entre familles */
  for (let i = 0; i < 8; i++) {
    const a = pt(RAD.R0, -90 + i * 45);
    const b = pt(RAD_R, -90 + i * 45);
    g += '<line class="rd-ray" x1="' + f2(a[0]) + '" y1="' + f2(a[1]) + '" x2="' + f2(b[0]) + '" y2="' + f2(b[1]) + '"/>';
  }
  /* libellés des familles, portés par un arc extérieur */
  let defs = "";
  FAM.forEach((f, i) => {
    const m = -90 + 22.5 + i * 45;
    const haut = Math.sin(rad(m)) < 0;
    const r = RAD_R + (haut ? 9 : 22);
    const a = haut ? m - 20 : m + 20;
    const b = haut ? m + 20 : m - 20;
    const p1 = pt(r, a);
    const p2 = pt(r, b);
    defs += '<path id="rd-arc-' + f + '" d="M' + f2(p1[0]) + " " + f2(p1[1]) + " A" + r + " " + r + " 0 0 " + (haut ? 1 : 0) + " " + f2(p2[0]) + " " + f2(p2[1]) + '"/>';
    g +=
      '<text class="rd-fam' + (parFam[f] ? "" : " vide") + '"><textPath href="#rd-arc-' + f + '" startOffset="50%" text-anchor="middle">' +
      esc(FAM_COURT[f] || f) + "</textPath></text>";
  });
  /* étiquettes d’anneaux, sur l’axe vertical */
  FREQ.forEach((f, i) => {
    const y = RAD.C - (RAD.R0 + i * RAD.BANDE + RAD.BANDE / 2) + 3.5;
    g += '<text class="rd-bande" x="' + RAD.C + '" y="' + f2(y) + '" text-anchor="middle">' + FREQ_ABR[f] + "</text>";
  });
  /* moyeu */
  g +=
    '<circle class="rd-hub" cx="' + RAD.C + '" cy="' + RAD.C + '" r="' + (RAD.R0 - 4) + '"/>' +
    '<text class="rd-hub-n" x="' + RAD.C + '" y="' + (RAD.C + 6) + '" text-anchor="middle">' + P.length + "</text>" +
    '<text class="rd-hub-l" x="' + RAD.C + '" y="' + (RAD.C + 26) + '" text-anchor="middle">' + plural(P.length, "domaine", "domaines") + "</text>";

  /* points ; les libellés des retards ne sont posés que s'ils tiennent sans recouvrir un autre point ou libellé */
  let blips = "";
  let etiquettes = "";
  const occupe = points.map((o) => ({ x: o.x - 14, y: o.y - 14, w: 28, h: 28 }));
  const touche = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  points
    .filter((o) => o.p.etat === "retard")
    .sort((a, b) => a.p.jours - b.p.jours)
    .forEach((o) => {
      const nom = libelleCourt(o.p.dom.nom, 22);
      const w = nom.length * 6.7 + 4;
      const droite = o.x >= RAD.C;
      const x0 = droite ? o.x + 22 : o.x - 22 - w;
      const boite = { x: x0, y: o.y - 9, w: w, h: 18 };
      const bout = droite ? x0 + w : x0;
      if (Math.hypot(bout - RAD.C, o.y - RAD.C) > RAD_R - 6) return;
      if (occupe.some((b) => touche(boite, b))) return;
      occupe.push(boite);
      etiquettes += '<text class="rd-etiq" x="' + f2(droite ? x0 : x0 + w) + '" y="' + f2(o.y + 4) + '" text-anchor="' + (droite ? "start" : "end") + '">' + esc(nom) + "</text>";
    });
  points.forEach((o) => {
    const p = o.p;
    const label = p.dom.nom + ", revue " + p.frequence + ", " + (p.etat === "retard" ? relRetard(p.jours) : "prochaine " + rel(p.jours));
    blips +=
      '<g class="blip' + (p.etat === "retard" ? " retard" : "") + '" data-act="detail" data-id="' + p.id + '" data-tip="' + p.id + '" role="button" tabindex="0" aria-label="' + esc(label) + '" transform="translate(' + o.x + " " + o.y + ')">' +
      (p.etat === "retard" ? '<circle class="b-alerte" r="17"/>' : "") +
      '<circle class="b-pt" r="11" style="fill:var(--f' + (o.bi + 1) + ')"/>' +
      (p.jamais ? '<circle class="b-jamais" r="3.2"/>' : "") +
      "</g>";
  });

  return (
    '<svg class="radar-svg" viewBox="0 0 ' + RAD.W + " " + RAD.W + '" role="group" aria-label="Radar de veille : ' + P.length + ' domaines répartis par famille et par fréquence de revue">' +
    "<defs>" + defs + "</defs>" + g + etiquettes + blips + "</svg>"
  );
}

function radarLegende(P) {
  const n = {};
  FREQ.forEach((f) => (n[f] = 0));
  P.forEach((p) => n[p.frequence]++);
  const retard = P.filter((p) => p.etat === "retard").length;
  const jamais = P.filter((p) => p.jamais).length;
  return (
    '<ul class="radar-legende">' +
    FREQ.map(
      (f, i) =>
        '<li><span class="pastille" style="background:var(--f' + (i + 1) + ')"></span><span>' + V.frequences[f].l + '</span><b class="num">' + n[f] + "</b></li>"
    ).join("") +
    '<li><span class="pastille alerte"></span><span>En retard</span><b class="num' + (retard ? " signal" : "") + '">' + retard + "</b></li>" +
    (jamais ? '<li><span class="pastille jamais"></span><span>Jamais revu</span><b class="num">' + jamais + "</b></li>" : "") +
    "</ul>"
  );
}

/* Vue « liste » du même radar : même donnée, lisible au clavier et au lecteur d’écran. */
function radarListe(P) {
  return (
    '<div class="par-famille">' +
    FAM.map((f) => {
      const items = P.filter((p) => p.dom.famille === f);
      if (!items.length) return "";
      return (
        '<section class="pf"><h3><span>' + esc(V.familles[f].l) + '</span><span class="num muted">' + items.length + "</span></h3><ul>" +
        items
          .map(
            (p) =>
              '<li><button type="button" class="ligne-dom" data-act="detail" data-id="' + p.id + '"><span class="pastille" style="background:var(--f' + (FREQ.indexOf(p.frequence) + 1) + ')"></span><span class="ld-nom">' + esc(p.dom.nom) + '</span><span class="ld-freq">' + esc(V.frequences[p.frequence].l) + "</span>" + pilule(p) + "</button></li>"
          )
          .join("") +
        "</ul></section>"
      );
    }).join("") +
    "</div>"
  );
}

/* Pastille d’état d’une revue : forme + texte, jamais la couleur seule. */
function pilule(p) {
  if (p.etat === "retard") return '<span class="pill pill-retard">' + ic("alert") + (p.jamais ? "Jamais faite" : "Retard " + -p.jours + " j") + "</span>";
  if (p.etat === "jour") return '<span class="pill pill-jour">' + ic("clock") + (p.jamais ? "À lancer" : "Aujourd’hui") + "</span>";
  return '<span class="pill pill-avenir">' + rel(p.jours) + "</span>";
}
