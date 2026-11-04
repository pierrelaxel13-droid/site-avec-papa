/* ==========================================================================
   Vigie — télécharger un tableau, pour Excel ou en PDF (4 novembre 2026)
   --------------------------------------------------------------------------
   Au-dessus de chaque tableau marqué data-export (Ma veille réglementaire,
   Registre et conformité, Plan d'actions) : deux boutons.
   - Excel : un fichier .csv (séparateur « ; », accents gardés) qu'Excel
     ouvre directement. Les cellules qui commencent par = + - @ sont
     neutralisées, pour qu'aucune formule ne s'exécute à l'ouverture.
   - PDF : l'impression du tableau seul ; le navigateur propose
     « Enregistrer au format PDF ».
   Seules les lignes affichées partent : les filtres et la recherche
   s'appliquent à l'export. Rien n'est envoyé nulle part : tout se fait
   dans le navigateur.
   ========================================================================== */
(function () {
  "use strict";
  var tables = [].slice.call(document.querySelectorAll("table[data-export]"));
  if (!tables.length) return;

  function propre(t) { return String(t || "").replace(/\s+/g, " ").trim(); }
  /* Ce que montre une cellule : le choix d'une liste, la valeur d'un champ,
     « Oui » / « Non » pour une case, sinon son texte. */
  function texteCellule(td) {
    var morceaux = [];
    var champs = td.querySelectorAll("select, input, textarea");
    if (champs.length) {
      [].forEach.call(champs, function (c) {
        if (c.tagName === "SELECT") morceaux.push(c.selectedOptions[0] ? c.selectedOptions[0].textContent : "");
        else if (c.type === "checkbox") morceaux.push(c.checked ? "Oui" : "Non");
        else if (c.type !== "hidden" && c.value) morceaux.push(c.value);
      });
      var etat = td.querySelector(".applicable-etat, .conf-etat, .pa-etat");
      if (etat && propre(etat.textContent)) morceaux.push("(" + propre(etat.textContent) + ")");
      return propre(morceaux.join(" "));
    }
    var copie = td.cloneNode(true);
    [].forEach.call(copie.querySelectorAll("[hidden], .cat-secondaire, .cache-visuellement, .analyse, svg, button"), function (x) { x.remove(); });
    // Le lien vers le texte officiel : son adresse, plus utile dans un tableur que « Lire le texte officiel ».
    [].forEach.call(copie.querySelectorAll("a.lien-officiel"), function (a) { a.textContent = a.href; });
    [].forEach.call(copie.querySelectorAll("li"), function (li) { li.textContent = "• " + li.textContent + " "; });
    // Une espace entre les morceaux (date, pastille, lien…), qui se collaient.
    [].forEach.call(copie.querySelectorAll("span, time, a, p, strong, em"), function (x) { x.after(" "); });
    return propre(copie.textContent);
  }
  function visibles(table) {
    return [].slice.call(table.querySelectorAll("tbody tr")).filter(function (tr) {
      return !tr.hidden && !tr.classList.contains("hors-filtre") && tr.offsetParent !== null;
    });
  }
  function champ(t) {
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
    return /[";\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }
  function nomFichier(table, ext) {
    var ent = (document.getElementById("tete-nom") || {}).textContent || "";
    var base = (table.getAttribute("data-export") + (ent ? "-" + ent : "")).normalize("NFD")
      .replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return base + "-" + new Date().toISOString().slice(0, 10) + "." + ext;
  }

  function versExcel(table) {
    var entetes = [].map.call(table.querySelectorAll("thead th"), function (th) { return propre(th.textContent); });
    var lignes = visibles(table).map(function (tr) { return [].map.call(tr.children, texteCellule); });
    var csv = "﻿" + [entetes].concat(lignes).map(function (l) { return l.map(champ).join(";"); }).join("\r\n") + "\r\n";
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = nomFichier(table, "csv");
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    return lignes.length;
  }

  function versPdf(table) {
    var cadre = table.closest("section") || table.parentNode;
    var titre = table.getAttribute("data-titre-export") || document.title;
    var ent = propre((document.getElementById("tete-nom") || {}).textContent);
    var tete = document.createElement("div");
    tete.className = "export-entete";
    tete.innerHTML = "<strong></strong><span></span>";
    tete.firstChild.textContent = titre + (ent ? " — " + ent : "");
    tete.lastChild.textContent = "Édité le " + new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) +
      " · " + visibles(table).length + " ligne(s) · Ne constitue pas un conseil juridique.";
    cadre.insertBefore(tete, cadre.firstChild);
    cadre.classList.add("export-cible");
    // Un champ vide (délai, responsable…) ne s'imprime pas : pas de « jj/mm/aaaa » sur le papier.
    var vides = [].filter.call(table.querySelectorAll("input"), function (i) { return !i.value && i.type !== "checkbox"; });
    vides.forEach(function (i) { i.classList.add("export-vide"); });
    document.body.classList.add("export-impression");
    var fin = function () {
      document.body.classList.remove("export-impression");
      cadre.classList.remove("export-cible");
      tete.remove();
      vides.forEach(function (i) { i.classList.remove("export-vide"); });
      window.removeEventListener("afterprint", fin);
    };
    window.addEventListener("afterprint", fin);
    window.print();
    window.setTimeout(function () { if (document.body.classList.contains("export-impression")) fin(); }, 60000);
  }

  tables.forEach(function (table) {
    var barre = document.createElement("div");
    barre.className = "export-barre";
    barre.setAttribute("role", "group");
    barre.setAttribute("aria-label", "Télécharger le tableau");
    var lib = document.createElement("span");
    lib.className = "export-libelle"; lib.textContent = "Télécharger le tableau";
    var bx = document.createElement("button");
    bx.type = "button"; bx.className = "export-bouton"; bx.textContent = "Excel";
    bx.title = "Fichier .csv, s'ouvre dans Excel (lignes affichées)";
    var bp = document.createElement("button");
    bp.type = "button"; bp.className = "export-bouton"; bp.textContent = "PDF";
    bp.title = "Imprimer le tableau ou l'enregistrer en PDF (lignes affichées)";
    var etat = document.createElement("span");
    etat.className = "export-etat"; etat.setAttribute("role", "status");
    bx.addEventListener("click", function () {
      var n = versExcel(table);
      etat.textContent = n + " ligne" + (n > 1 ? "s" : "") + " exportée" + (n > 1 ? "s" : "") + ".";
    });
    bp.addEventListener("click", function () { etat.textContent = ""; versPdf(table); });
    barre.appendChild(lib); barre.appendChild(bx); barre.appendChild(bp); barre.appendChild(etat);
    var avant = table.closest(".defile-tableau") || table;
    avant.parentNode.insertBefore(barre, avant);
  });
})();
