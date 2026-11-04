/* ==========================================================================
   Vigie réglementaire — l'analyse synthétique, sur toute la largeur
   (4 novembre 2026)
   --------------------------------------------------------------------------
   Dans les tableaux (Ma veille réglementaire, Plan d'actions, Registre et
   conformité), le bouton « Analyse synthétique » est dans la cellule du
   texte, souvent étroite. À l'ouverture, la fiche s'affiche sur une ligne à
   part, juste sous le texte, sur toute la largeur du tableau ; elle se
   referme avec le bouton et suit la ligne du texte quand un filtre la cache.
   ========================================================================== */
(function () {
  "use strict";
  var tables = [].slice.call(document.querySelectorAll("table"));
  tables = tables.filter(function (t) { return t.querySelector("details.analyse"); });
  if (!tables.length) return;

  function ligneDe(tr) {
    var n = tr.nextElementSibling;
    return n && n.classList.contains("ligne-analyse") ? n : null;
  }
  function suivre(tr) {
    var l = ligneDe(tr);
    if (l) l.hidden = tr.hidden || tr.classList.contains("hors-filtre");
  }

  tables.forEach(function (table) {
    var colonnes = (table.querySelector("thead tr") || {}).children ? table.querySelector("thead tr").children.length : 1;
    [].forEach.call(table.querySelectorAll("details.analyse"), function (d) {
      var tr = d.closest("tr");
      if (!tr) return;
      d.classList.add("analyse-deportee");
      d.addEventListener("toggle", function () {
        var deja = ligneDe(tr);
        if (!d.open) { if (deja) deja.remove(); tr.classList.remove("analyse-ouverte"); return; }
        if (deja) return;
        var l = document.createElement("tr");
        l.className = "ligne-analyse";
        var td = document.createElement("td");
        td.colSpan = colonnes;
        var titre = tr.getAttribute("data-objet") || "";
        var fiche = d.querySelector(".analyse-corps").cloneNode(true);
        if (titre) {
          var h = document.createElement("p");
          h.className = "analyse-titre";
          h.textContent = titre;
          fiche.insertBefore(h, fiche.firstChild);
        }
        var fermer = document.createElement("button");
        fermer.type = "button"; fermer.className = "analyse-fermer"; fermer.textContent = "Fermer";
        fermer.setAttribute("aria-label", "Fermer l'analyse synthétique");
        fermer.addEventListener("click", function () { d.open = false; d.querySelector("summary").focus(); });
        fiche.insertBefore(fermer, fiche.firstChild);
        td.appendChild(fiche);
        l.appendChild(td);
        tr.after(l);
        tr.classList.add("analyse-ouverte");
        suivre(tr);
      });
    });
    // Un filtre, une recherche cachent la ligne du texte : la fiche suit.
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { if (m.target.tagName === "TR" && !m.target.classList.contains("ligne-analyse")) suivre(m.target); });
    }).observe(table.tBodies[0] || table, { subtree: true, attributes: true, attributeFilter: ["hidden", "class"] });
  });
})();
