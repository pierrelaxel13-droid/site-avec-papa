/* ==========================================================================
   Vigie — interactions, boîtes de dialogue, import/export, démarrage
   ========================================================================== */

let vueCourante = "vue";
const main = $("#main");
let annuler = null;
let minuteur = null;

/* ------------------------------------------------------------ rendu global */
function renderNav() {
  const P = perim();
  const st = statsRegistre();
  const badges = { plan: P.filter((p) => p.etat === "retard").length, registre: st.n.a_analyser + st.n.ecart };
  $("#nav").innerHTML = VUES.map(
    (v) =>
      '<a class="nav-i' + (v.id === vueCourante ? " on" : "") + '" href="#' + v.id + '"' + (v.id === vueCourante ? ' aria-current="page"' : "") + ">" + ic(v.ic) + "<span>" + v.l + "</span>" +
      (badges[v.id] ? '<b class="badge num' + (v.id === "plan" ? " al" : "") + '" title="' + badges[v.id] + (v.id === "plan" ? " en retard" : " à traiter") + '">' + badges[v.id] + "</b>" : "") + "</a>"
  ).join("");
}

function renderBanniere() {
  $("#banniere").innerHTML = S.demo
    ? '<div class="banniere"><span><b>Exemple.</b> Vous consultez une entreprise fictive de maçonnerie pour voir l’outil au travail. Tout ce que vous modifiez reste sur cet appareil.</span><button type="button" class="btn btn-sm" data-act="demoClear">Partir de mon entreprise</button></div>'
    : "";
}

function render(opts) {
  opts = opts || {};
  const y = window.scrollY;
  main.innerHTML = RENDU[vueCourante]();
  renderNav();
  renderBanniere();
  if (opts.keepScroll) window.scrollTo(0, y);
  else window.scrollTo(0, 0);
  $("#etat-sauvegarde").textContent = sauvegardeOk ? "Enregistré sur cet appareil" : "Stockage indisponible : les données ne seront pas conservées";
}

function refresh() {
  const aid = document.activeElement && document.activeElement.id;
  render({ keepScroll: true });
  refreshFiche();
  if (aid) {
    const n = document.getElementById(aid);
    if (n && document.activeElement !== n) {
      try {
        n.focus({ preventScroll: true });
      } catch (e) {
        /* élément retiré */
      }
    }
  }
}

function go(v) {
  if (location.hash === "#" + v) {
    vueCourante = v;
    render();
  } else location.hash = v;
}

function route() {
  const h = location.hash.replace("#", "");
  vueCourante = RENDU[h] ? h : "vue";
  render();
  main.focus({ preventScroll: true });
}

/* -------------------------------------------------------------------- toast */
function toast(msg, fnAnnuler) {
  const t = $("#toast");
  annuler = fnAnnuler || null;
  t.innerHTML = "<span>" + esc(msg) + "</span>" + (fnAnnuler ? '<button type="button" class="lien" data-act="undo">Annuler</button>' : "");
  t.classList.add("on");
  clearTimeout(minuteur);
  minuteur = setTimeout(() => {
    t.classList.remove("on");
    annuler = null;
  }, 6500);
}

/* ------------------------------------------------------------------ thème */
let THEME = "auto";
function appliquerTheme(t) {
  THEME = t;
  const r = document.documentElement;
  if (t === "auto") r.removeAttribute("data-theme");
  else r.setAttribute("data-theme", t);
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch (e) {
    /* préférence non conservée */
  }
  const b = $("#btn-theme");
  if (b) b.innerHTML = ic(t === "auto" ? "auto" : t === "dark" ? "moon" : "sun") + "<span>Thème " + (t === "auto" ? "automatique" : t === "dark" ? "sombre" : "clair") + "</span>";
}

/* ---------------------------------------------------------- fiche domaine */
function ouvrirFiche(id) {
  const d = $("#drawer");
  d.dataset.id = id;
  d.innerHTML = ficheHTML(id);
  if (!d.open) d.showModal();
  d.scrollTop = 0;
}
function refreshFiche() {
  const d = $("#drawer");
  if (d.open) d.innerHTML = ficheHTML(d.dataset.id);
}
function majFicheRevue(id) {
  const d = $("#drawer");
  const p = perim().filter((x) => x.id === id)[0];
  if (!d.open || !p) return;
  const pi = d.querySelector("[data-pill]");
  const pr = d.querySelector("[data-proch]");
  if (pi) pi.innerHTML = pilule(p);
  if (pr) pr.textContent = "Prochaine revue le " + fmtCourt(p.echeance);
}

/* ------------------------------------------------------------ plan / revues */
function faireRevue(id) {
  const avant = (S.plan[id] || {}).derniere || "";
  S.plan[id] = Object.assign(S.plan[id] || {}, { derniere: iso(today()) });
  save();
  const p = perim().filter((x) => x.id === id)[0];
  refresh();
  if (p) {
    toast("Revue enregistrée. Prochaine le " + fmtCourt(p.echeance) + ".", () => {
      S.plan[id].derniere = avant;
      save();
      refresh();
    });
  }
  const b = document.getElementById("d-revue");
  if (b && $("#drawer").open) b.focus();
}

function majLignePlan(id) {
  const p = perim().filter((x) => x.id === id)[0];
  const tr = main.querySelector('tr[data-row="' + id + '"]');
  if (!p || !tr) return;
  tr.className = "tr-" + p.etat;
  tr.querySelector(".td-proch").innerHTML = '<b class="num">' + esc(fmtCourt(p.echeance)) + "</b> " + pilule(p);
  const b = tr.querySelector(".td-act .btn");
  if (b) b.classList.toggle("btn-quiet", p.etat === "avenir");
  renderNav();
}

function ajouterDomaine(id) {
  if (!V.domaines[id]) return;
  S.exclus = S.exclus.filter((x) => x !== id);
  if (S.ajouts.indexOf(id) < 0) S.ajouts.push(id);
  save();
  refresh();
  toast("« " + V.domaines[id].nom + " » ajouté au plan.");
}

/* ----------------------------------------------------------------- éditeur */
function ouvrirEditeur(id, domaine) {
  const d = $("#editor");
  const f = $("#drawer");
  if (f.open) f.close();
  const r = id ? S.registre.filter((x) => x.id === id)[0] : null;
  d.innerHTML = editeurHTML(r);
  if (!r && domaine) {
    const sel = $("#e-domaine", d);
    if (sel) sel.value = domaine;
  }
  if (!d.open) d.showModal();
  d.scrollTop = 0;
  const premier = $("#e-intitule", d);
  if (premier && !r) premier.focus();
}

function enregistrerEntree() {
  const d = $("#editor");
  const val = (id) => $("#" + id, d).value.trim();
  const err = $("#e-erreur", d);
  const intitule = val("e-intitule");
  const domaine = val("e-domaine");
  const manque = [];
  if (!intitule) manque.push("l’intitulé");
  if (!domaine) manque.push("le domaine");
  if (manque.length) {
    err.textContent = "Renseignez " + manque.join(" et ") + " pour enregistrer.";
    err.hidden = false;
    ($("#" + (!intitule ? "e-intitule" : "e-domaine"), d)).focus();
    return;
  }
  const id = val("e-id");
  const e = {
    id: id || uid(),
    intitule: intitule,
    ref: val("e-ref"),
    domaine: domaine,
    source: val("e-source"),
    datePub: val("e-pub"),
    vigueur: val("e-vig"),
    niveau: val("e-niveau"),
    impacts: $$('input[name="e-impact"]:checked', d).map((c) => c.value),
    action: val("e-action"),
    resp: val("e-resp"),
    echeance: val("e-ech"),
    statut: val("e-statut"),
    diffuse: $("#e-diffuse", d).checked,
    notes: val("e-notes"),
    cree: iso(today())
  };
  const i = S.registre.findIndex((x) => x.id === e.id);
  if (i >= 0) S.registre[i] = Object.assign({}, S.registre[i], e, { cree: S.registre[i].cree });
  else S.registre.push(e);
  save();
  d.close();
  render({ keepScroll: true });
  toast(i >= 0 ? "Entrée enregistrée." : "Ajouté au registre.");
}

/* --------------------------------------------------------- CSV / presse-papier */
const csvCell = (v) => {
  const s = String(v == null ? "" : v);
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const versCSV = (lignes) => "﻿" + lignes.map((l) => l.map(csvCell).join(";")).join("\r\n");
const versTSV = (lignes) => lignes.map((l) => l.map((c) => String(c == null ? "" : c).replace(/[\t\r\n]+/g, " ")).join("\t")).join("\n");

function telecharger(nom, contenu) {
  const blob = new Blob([contenu], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

function copierSecours(texte, msg) {
  const ta = document.createElement("textarea");
  ta.value = texte;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (e) {
    ok = false;
  }
  ta.remove();
  toast(ok ? msg : "La copie a échoué. Utilisez l’export CSV.");
}
function copier(texte, msg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texte).then(
      () => toast(msg),
      () => copierSecours(texte, msg)
    );
  } else copierSecours(texte, msg);
}

const lignesPlan = () =>
  [["Domaine", "Famille", "Origine", "Fréquence", "Responsable", "Dernière revue", "Prochaine revue", "État"]].concat(
    perim().map((p) => [p.dom.nom, V.familles[p.dom.famille].l, p.origines.map((o) => ORIGINES[o]).join(" + "), V.frequences[p.frequence].l, p.responsable || S.profil.pilote, p.derniere, iso(p.echeance), p.etat === "retard" ? "En retard" : p.etat === "jour" ? "À faire" : "À jour"])
  );
const lignesRegistre = () =>
  [["Intitulé", "Référence", "Domaine", "Source", "Publication", "Entrée en vigueur", "Niveau", "Impacts", "Action", "Responsable", "Échéance", "Statut", "Transmis", "Notes"]].concat(
    S.registre.map((r) => [r.intitule, r.ref, (V.domaines[r.domaine] || {}).nom || r.domaine, r.source, r.datePub, r.vigueur, NIVEAUX[r.niveau] || r.niveau, r.impacts.map((i) => V.impactsLabels[i] || i).join(", "), r.action, r.resp, r.echeance, (STATUTS[r.statut] || {}).l || r.statut, r.diffuse ? "oui" : "non", r.notes])
  );

function lireCSV(txt) {
  txt = txt.replace(/^﻿/, "");
  const premiere = txt.split(/\r?\n/)[0] || "";
  const sep = premiere.split(";").length >= premiere.split(",").length ? ";" : ",";
  const lignes = [];
  let l = [];
  let c = "";
  let q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) {
      if (ch === '"' && txt[i + 1] === '"') {
        c += '"';
        i++;
      } else if (ch === '"') q = false;
      else c += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      l.push(c);
      c = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && txt[i + 1] === "\n") i++;
      l.push(c);
      c = "";
      if (l.some((x) => x !== "")) lignes.push(l);
      l = [];
    } else c += ch;
  }
  l.push(c);
  if (l.some((x) => x !== "")) lignes.push(l);
  return lignes;
}

function dateVersIso(s) {
  s = String(s || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? m[3] + "-" + pad(+m[2]) + "-" + pad(+m[1]) : "";
}

function importerCSV(txt) {
  const lignes = lireCSV(txt);
  if (lignes.length < 2) return toast("Fichier vide ou illisible.");
  const cols = lignes[0].map((h) => norm(h).replace(/[^a-z]/g, ""));
  const idx = (...noms) => cols.findIndex((c) => noms.indexOf(c) >= 0);
  const I = {
    intitule: idx("intitule", "texte", "titre"),
    ref: idx("reference", "ref"),
    domaine: idx("domaine"),
    source: idx("source"),
    pub: idx("publication", "datedepublication"),
    vig: idx("entreeenvigueur", "vigueur"),
    niveau: idx("niveau", "niveaudimpact"),
    impacts: idx("impacts", "natureimpacts"),
    action: idx("action"),
    resp: idx("responsable"),
    ech: idx("echeance"),
    statut: idx("statut"),
    transmis: idx("transmis", "diffuse"),
    notes: idx("notes")
  };
  if (I.intitule < 0) return toast("Colonne « Intitulé » introuvable. Exportez d’abord le registre pour voir le format attendu.");
  const domParNom = {};
  Object.keys(V.domaines).forEach((k) => {
    domParNom[norm(V.domaines[k].nom)] = k;
    domParNom[norm(k)] = k;
  });
  const parLabel = (dict, v, def) => {
    const n = norm(v);
    return Object.keys(dict).filter((k) => norm(typeof dict[k] === "string" ? dict[k] : dict[k].l) === n || k === n)[0] || def;
  };
  let n = 0;
  lignes.slice(1).forEach((L) => {
    const g = (k) => (I[k] >= 0 ? (L[I[k]] || "").trim() : "");
    if (!g("intitule")) return;
    S.registre.push({
      id: uid(),
      intitule: g("intitule"),
      ref: g("ref"),
      domaine: domParNom[norm(g("domaine"))] || "",
      source: g("source"),
      datePub: dateVersIso(g("pub")),
      vigueur: dateVersIso(g("vig")),
      niveau: parLabel(NIVEAUX, g("niveau"), "modere"),
      impacts: g("impacts").split(/[,|]/).map((x) => parLabel(V.impactsLabels, x.trim(), "")).filter(Boolean),
      action: g("action"),
      resp: g("resp"),
      echeance: dateVersIso(g("ech")),
      statut: parLabel(STATUTS, g("statut"), "a_analyser"),
      diffuse: /^(oui|1|true|x)$/i.test(g("transmis")),
      notes: g("notes"),
      cree: iso(today())
    });
    n++;
  });
  save();
  render({ keepScroll: true });
  toast(n + " " + plural(n, "entrée importée", "entrées importées") + ".");
}

/* ---------------------------------------------------------------- actions */
function armer(el, texte, fn) {
  const rendre = () => {
    if (!el.dataset.arme) return;
    clearTimeout(+el.dataset.arme);
    el.innerHTML = el.dataset.avant;
    el.classList.remove("arme");
    delete el.dataset.arme;
    delete el.dataset.avant;
  };
  if (el.dataset.arme) {
    rendre();
    fn();
    return;
  }
  el.dataset.avant = el.innerHTML;
  el.innerHTML = esc(texte);
  el.classList.add("arme");
  el.dataset.arme = setTimeout(rendre, 4000);
}

const ACT = {
  goto(el) {
    $("#drawer").open && $("#drawer").close();
    go(el.dataset.v);
  },
  theme() {
    appliquerTheme(THEME === "auto" ? "light" : THEME === "light" ? "dark" : "auto");
  },
  radarVue(el) {
    UI.radar = el.dataset.v;
    render({ keepScroll: true });
  },
  regVue(el) {
    UI.registre = el.dataset.v;
    render({ keepScroll: true });
  },
  detail(el) {
    ouvrirFiche(el.dataset.id);
  },
  closeDrawer() {
    $("#drawer").close();
  },
  closeEditor() {
    $("#editor").close();
  },
  revue(el) {
    faireRevue(el.dataset.id);
  },
  planFam(el) {
    UI.planFam = el.dataset.f;
    render({ keepScroll: true });
  },
  planRetard() {
    UI.planRetard = !UI.planRetard;
    render({ keepScroll: true });
  },
  addDomain() {
    const v = $("#add-dom").value;
    if (v) ajouterDomaine(v);
  },
  addDomainId(el) {
    ajouterDomaine(el.dataset.id);
  },
  exclude(el) {
    const id = el.dataset.id;
    if (S.ajouts.indexOf(id) >= 0) S.ajouts = S.ajouts.filter((x) => x !== id);
    else if (S.exclus.indexOf(id) < 0) S.exclus.push(id);
    save();
    $("#drawer").close();
    render({ keepScroll: true });
    toast("« " + V.domaines[id].nom + " » retiré du plan.", () => {
      S.exclus = S.exclus.filter((x) => x !== id);
      if (!perim().some((p) => p.id === id)) S.ajouts.push(id);
      save();
      refresh();
    });
  },
  restore(el) {
    S.exclus = S.exclus.filter((x) => x !== el.dataset.id);
    save();
    render({ keepScroll: true });
  },
  pickSection(el) {
    UI.section = el.dataset.s === UI.section ? "" : el.dataset.s;
    UI.nafRecherche = "";
    render({ keepScroll: true });
  },
  pickNaf(el) {
    S.profil.division = el.dataset.div;
    S.profil.naf = el.dataset.naf;
    UI.nafRecherche = "";
    UI.section = "";
    save();
    render({ keepScroll: true });
    toast("Activité retenue : division " + el.dataset.div + ".");
  },
  effacerNaf() {
    S.profil.division = "";
    S.profil.naf = "";
    save();
    render({ keepScroll: true });
  },
  jour(el) {
    UI.jour = el.dataset.d;
    render({ keepScroll: true });
  },
  newEntry(el) {
    ouvrirEditeur(null, el.dataset.domaine);
  },
  editEntry(el) {
    ouvrirEditeur(el.dataset.id);
  },
  delEntry(el) {
    armer(el, "Confirmer la suppression", () => {
      const id = el.dataset.id;
      const sauve = S.registre.filter((r) => r.id === id)[0];
      S.registre = S.registre.filter((r) => r.id !== id);
      save();
      $("#editor").close();
      render({ keepScroll: true });
      toast("Entrée supprimée.", () => {
        S.registre.push(sauve);
        save();
        refresh();
      });
    });
  },
  exportPlan() {
    telecharger("vigie-plan-de-veille.csv", versCSV(lignesPlan()));
    toast("Plan exporté.");
  },
  copyPlan() {
    copier(versTSV(lignesPlan()), "Plan copié. Collez-le dans Excel ou Sheets.");
  },
  exportReg() {
    telecharger("vigie-registre.csv", versCSV(lignesRegistre()));
    toast("Registre exporté.");
  },
  copyReg() {
    copier(versTSV(lignesRegistre()), "Registre copié. Collez-le dans Excel ou Sheets.");
  },
  importReg() {
    $("#import-file").click();
  },
  print() {
    window.print();
  },
  copySynth() {
    copier(syntheseTexte(), "Texte de la note copié.");
  },
  demoClear() {
    S = blank();
    UI.section = UI.nafRecherche = UI.jour = UI.planFam = UI.regTexte = UI.regDomaine = UI.regStatut = "";
    UI.planRetard = false;
    save();
    go("profil");
    render();
    toast("Espace vidé. Commencez par votre code NAF.");
  },
  demoRestore(el) {
    armer(el, "Confirmer", () => {
      S = exemple();
      UI.jour = "";
      save();
      render();
      toast("Exemple rechargé.");
    });
  },
  wipe(el) {
    armer(el, "Confirmer", () => {
      ACT.demoClear();
    });
  },
  undo() {
    if (annuler) annuler();
    annuler = null;
    $("#toast").classList.remove("on");
  }
};

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (fn) fn(el, e);
});
document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches('[role="button"][data-act]')) {
    e.preventDefault();
    e.target.click();
  }
  if (e.key === "Enter" && e.target.id === "naf-q") {
    const p = $("#naf-res .res");
    if (p) {
      e.preventDefault();
      p.click();
    }
  }
});

/* ---------------------------------------------------------------- changement */
const CHG = {
  decl(el) {
    const i = S.declencheurs.indexOf(el.value);
    if (el.checked && i < 0) S.declencheurs.push(el.value);
    if (!el.checked && i >= 0) S.declencheurs.splice(i, 1);
    save();
    el.closest(".decl").classList.toggle("on", el.checked);
    $("#perim-n").textContent = perim().length;
    renderNav();
  },
  profil(el) {
    S.profil[el.dataset.f] = el.value;
    save();
  },
  planField(el) {
    const id = el.dataset.id;
    S.plan[id] = S.plan[id] || {};
    S.plan[id][el.dataset.f] = el.value;
    save();
    if (el.dataset.f !== "responsable") {
      majLignePlan(id);
      majFicheRevue(id);
    }
    const tot = main.querySelector(".plan-tot");
    if (tot) {
      const P = perim();
      tot.textContent = P.length + " domaines · " + P.filter((p) => p.etat === "retard").length + " en retard · charge estimée " + heures(chargeMensuelle(P).total) + " par mois";
    }
  },
  statut(el) {
    const r = S.registre.filter((x) => x.id === el.dataset.id)[0];
    if (!r) return;
    const avant = r.statut;
    r.statut = el.value;
    save();
    refresh();
    toast("Statut : " + STATUTS[r.statut].l + ".", () => {
      r.statut = avant;
      save();
      refresh();
    });
  },
  check(el) {
    const id = el.dataset.id;
    const n = V.domaines[id].obligations.length;
    const c = (S.checks[id] = (S.checks[id] || []).slice(0, n));
    while (c.length < n) c.push(false);
    c[+el.dataset.i] = el.checked;
    save();
    const d = $("#drawer");
    const k = c.filter(Boolean).length;
    const prog = d.querySelector("[data-prog]");
    const barre = d.querySelector(".barre-prog i");
    if (prog) prog.textContent = k + " / " + n;
    if (barre) barre.style.width = Math.round((k / n) * 100) + "%";
  },
  regFiltre(el) {
    UI[el.dataset.f] = el.value;
    $("#reg-liste").innerHTML = registreListeHTML();
  }
};
document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.id === "import-file") {
    const f = el.files && el.files[0];
    if (!f) return;
    const lect = new FileReader();
    lect.onload = () => importerCSV(String(lect.result));
    lect.readAsText(f, "utf-8");
    el.value = "";
    return;
  }
  const fn = el.dataset && CHG[el.dataset.chg];
  if (fn) fn(el);
});

const INP = {
  profil(el) {
    S.profil[el.dataset.f] = el.value;
    save();
  },
  naf(el) {
    UI.nafRecherche = el.value;
    UI.section = "";
    $("#naf-res").innerHTML = nafResultatsHTML();
    $$(".sec-btn").forEach((b) => {
      b.classList.remove("on");
      b.setAttribute("aria-pressed", "false");
    });
  },
  regTexte(el) {
    UI.regTexte = el.value;
    $("#reg-liste").innerHTML = registreListeHTML();
  },
  src(el) {
    $("#src-liste").innerHTML = sourcesHTML(el.value);
  }
};
document.addEventListener("input", (e) => {
  const fn = e.target.dataset && INP[e.target.dataset.inp];
  if (fn) fn(e.target);
});

/* Le formulaire du registre se valide par submit (Entrée comprise). */
document.addEventListener("submit", (e) => {
  if (e.target.id === "editeur-form") {
    e.preventDefault();
    enregistrerEntree();
  }
});

/* -------------------------------------------------------- glisser-déposer */
let glisse = null;
document.addEventListener("dragstart", (e) => {
  const c = e.target.closest && e.target.closest(".carte");
  if (!c) return;
  glisse = c.dataset.id;
  c.classList.add("glisse");
  e.dataTransfer.effectAllowed = "move";
  try {
    e.dataTransfer.setData("text/plain", glisse);
  } catch (x) {
    /* certains navigateurs refusent */
  }
});
document.addEventListener("dragend", () => {
  glisse = null;
  $$(".glisse,.depot").forEach((n) => n.classList.remove("glisse", "depot"));
});
document.addEventListener("dragover", (e) => {
  const col = glisse && e.target.closest && e.target.closest(".col");
  if (!col) return;
  e.preventDefault();
  $$(".depot").forEach((n) => n !== col && n.classList.remove("depot"));
  col.classList.add("depot");
});
document.addEventListener("drop", (e) => {
  const col = glisse && e.target.closest && e.target.closest(".col");
  if (!col) return;
  e.preventDefault();
  const r = S.registre.filter((x) => x.id === glisse)[0];
  glisse = null;
  if (!r || r.statut === col.dataset.statut) return render({ keepScroll: true });
  const avant = r.statut;
  r.statut = col.dataset.statut;
  save();
  render({ keepScroll: true });
  toast("« " + libelleCourt(r.intitule, 40) + " » : " + STATUTS[r.statut].l + ".", () => {
    r.statut = avant;
    save();
    render({ keepScroll: true });
  });
});

/* --------------------------------------------------------------- info-bulle */
const tip = $("#tip");
function contenuTip(id) {
  const p = perim().filter((x) => x.id === id)[0];
  if (!p) return "";
  return (
    "<b>" + esc(p.dom.nom) + '</b><span>' + esc(V.familles[p.dom.famille].l) + " · revue " + esc(p.frequence) + "</span>" +
    "<span>" + (p.responsable ? esc(p.responsable) : "Responsable à désigner") + "</span>" +
    '<span class="' + (p.etat === "retard" ? "t-al" : "") + '">' + (p.jamais ? "Jamais revu" : p.etat === "retard" ? esc(relRetard(p.jours)) : "Prochaine revue " + esc(rel(p.jours))) + "</span>" +
    '<span class="t-p">' + Math.round(p.pct * 100) + " % des obligations vérifiées</span>"
  );
}
function poserTip(x, y) {
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  let l = x + 14;
  let t = y + 14;
  if (l + w > window.innerWidth - 8) l = x - w - 14;
  if (t + h > window.innerHeight - 8) t = y - h - 14;
  tip.style.left = Math.max(8, l) + "px";
  tip.style.top = Math.max(8, t) + "px";
}
document.addEventListener("pointerover", (e) => {
  const b = e.target.closest && e.target.closest(".blip");
  if (!b || e.pointerType === "touch") return;
  tip.innerHTML = contenuTip(b.dataset.tip);
  tip.hidden = false;
  poserTip(e.clientX, e.clientY);
});
document.addEventListener("pointermove", (e) => {
  if (!tip.hidden) poserTip(e.clientX, e.clientY);
});
document.addEventListener("pointerout", (e) => {
  if (e.target.closest && e.target.closest(".blip")) tip.hidden = true;
});
document.addEventListener("focusin", (e) => {
  const b = e.target.closest && e.target.closest(".blip");
  if (!b) return;
  const r = b.getBoundingClientRect();
  tip.innerHTML = contenuTip(b.dataset.tip);
  tip.hidden = false;
  poserTip(r.right, r.top);
});
document.addEventListener("focusout", (e) => {
  if (e.target.closest && e.target.closest(".blip")) tip.hidden = true;
});

/* ---------------------------------------------------------- fenêtres modales */
["drawer", "editor"].forEach((id) => {
  const d = document.getElementById(id);
  d.addEventListener("click", (e) => {
    if (e.target === d) d.close();
  });
  if (id === "drawer") d.addEventListener("close", () => render({ keepScroll: true }));
});

/* ------------------------------------------------------------------ démarrage */
(function demarrer() {
  let t = "auto";
  try {
    t = localStorage.getItem(THEME_KEY) || "auto";
  } catch (e) {
    /* thème automatique */
  }
  appliquerTheme(["auto", "light", "dark"].indexOf(t) >= 0 ? t : "auto");
  save();
  window.addEventListener("hashchange", route);
  route();
})();
