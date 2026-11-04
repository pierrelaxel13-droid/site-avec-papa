/* ==========================================================================
   Vigie réglementaire — télécharger ou envoyer un tableau (4 novembre 2026)
   --------------------------------------------------------------------------
   Au-dessus de chaque tableau marqué data-export (Ma veille réglementaire,
   Registre et conformité, Plan d'actions) : trois boutons.
   - Excel : un vrai classeur .xlsx mis en forme (titre, en-tête en couleur,
     lignes alternées, colonnes dimensionnées, filtres, en-tête figé,
     évaluations colorées), écrit ici même, sans bibliothèque.
   - PDF : une mise en page dédiée à l'impression (A4 paysage, bandeau,
     tableau propre, pied de page) ; le navigateur propose « Enregistrer au
     format PDF ».
   - Envoyer par e-mail : sur téléphone, le partage du système (Mail,
     Outlook…) avec le fichier Excel joint ; sur ordinateur, le fichier est
     téléchargé et la messagerie s'ouvre, adressée au destinataire saisi.
   Seules les lignes affichées partent : les filtres et la recherche
   s'appliquent. Rien n'est envoyé à nos serveurs : tout se fait dans le
   navigateur.
   ========================================================================== */
(function () {
  "use strict";
  var tables = [].slice.call(document.querySelectorAll("table[data-export]"));
  if (!tables.length) return;

  function propre(t) { return String(t || "").replace(/\s+/g, " ").trim(); }
  function entreprise() { return propre((document.getElementById("tete-nom") || {}).textContent); }
  function aujourdhui() { return new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); }

  /* --- Lire le tableau ---------------------------------------------------- */
  /* Ce que montre une cellule : le choix d'une liste, la valeur d'un champ,
     « Oui » / « Non » pour une case, sinon son texte. */
  function texteCellule(td) {
    var morceaux = [];
    var champs = td.querySelectorAll("select, input, textarea");
    if (champs.length) {
      [].forEach.call(champs, function (c) {
        if (c.tagName === "SELECT") morceaux.push(c.selectedOptions[0] ? c.selectedOptions[0].textContent : "");
        else if (c.type === "checkbox") morceaux.push(c.checked ? "Oui" : "Non");
        else if (c.type !== "hidden" && c.value) morceaux.push(c.type === "date" ? dateFr(c.value) : c.value);
      });
      return propre(morceaux.join(" "));
    }
    var copie = td.cloneNode(true);
    [].forEach.call(copie.querySelectorAll("[hidden], .cat-secondaire, .cache-visuellement, .analyse, .lien-officiel, .etat-recent, .marque-nouveau, svg, button"), function (x) { x.remove(); });
    [].forEach.call(copie.querySelectorAll("li"), function (li) { li.textContent = "• " + propre(li.textContent) + "\n"; });
    [].forEach.call(copie.querySelectorAll("span, time, a, p, strong, em"), function (x) { x.after(" "); });
    return copie.textContent.split("\n").map(propre).filter(Boolean).join("\n");
  }
  function dateFr(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? m[3] + "/" + m[2] + "/" + m[1] : iso;
  }
  function lienDe(tr) { var a = tr.querySelector("a.lien-officiel"); return a ? a.href : ""; }
  function analyseDe(tr) {
    var d = tr.querySelector(".analyse .analyse-champs");
    if (!d) return "";
    return [].map.call(d.children, function (div) {
      var dt = div.querySelector("dt"), dd = div.querySelector("dd");
      if (!dt || !dd) return "";
      var lis = dd.querySelectorAll("li");
      var v = lis.length ? [].map.call(lis, function (li) { return "• " + propre(li.textContent); }).join("\n") : propre(dd.textContent);
      return propre(dt.textContent) + " : " + (lis.length ? "\n" : "") + v;
    }).filter(Boolean).join("\n");
  }
  function visibles(table) {
    return [].slice.call(table.querySelectorAll("tbody tr")).filter(function (tr) {
      return !tr.hidden && !tr.classList.contains("hors-filtre") && !tr.classList.contains("ligne-analyse") && tr.offsetParent !== null;
    });
  }
  function donnees(table) {
    var entetes = [].map.call(table.querySelectorAll("thead th"), function (th) { return propre(th.textContent); });
    var trs = visibles(table);
    var avecAnalyse = trs.some(function (tr) { return tr.querySelector(".analyse"); });
    var avecLien = trs.some(function (tr) { return tr.querySelector("a.lien-officiel"); });
    var lignes = trs.map(function (tr) {
      var l = [].map.call(tr.children, texteCellule);
      if (avecLien) l.push(lienDe(tr));
      if (avecAnalyse) l.push(analyseDe(tr));
      return l;
    });
    if (avecLien) entetes.push("Lien officiel");
    if (avecAnalyse) entetes.push("Analyse synthétique");
    return { titre: table.getAttribute("data-titre-export") || document.title, entetes: entetes, lignes: lignes,
      nLien: avecLien ? entetes.length - (avecAnalyse ? 2 : 1) : -1 };
  }
  function nomFichier(table, ext) {
    var ent = entreprise();
    var base = (table.getAttribute("data-export") + (ent ? "-" + ent : "")).normalize("NFD")
      .replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return base + "-" + new Date().toISOString().slice(0, 10) + "." + ext;
  }
  /* Une évaluation, un statut : la couleur qui va avec. */
  function teinte(t) {
    var x = String(t || "").toLowerCase();
    if (/^non conforme|^non applicable|^en retard/.test(x)) return "rouge";
    if (/^partiellement|^à évaluer|^à décider|^en cours/.test(x)) return "ambre";
    if (/^conforme|^applicable|^fait|^réalisé|^validé|^en vigueur/.test(x)) return "vert";
    return "";
  }

  /* --- Excel : un classeur .xlsx --------------------------------------- */
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(o) { var c = 0xFFFFFFFF; for (var i = 0; i < o.length; i++) c = CRC[(c ^ o[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  /* Une archive zip sans compression : c'est tout ce qu'un .xlsx demande. */
  function zip(fichiers) {
    var enc = new TextEncoder(), morceaux = [], central = [], pos = 0;
    fichiers.forEach(function (f) {
      var nom = enc.encode(f[0]), data = enc.encode(f[1]), crc = crc32(data);
      var tete = new DataView(new ArrayBuffer(30));
      tete.setUint32(0, 0x04034b50, true); tete.setUint16(4, 20, true); tete.setUint16(6, 0x0800, true);
      tete.setUint16(8, 0, true); tete.setUint16(10, 0, true); tete.setUint16(12, 0x21, true);
      tete.setUint32(14, crc, true); tete.setUint32(18, data.length, true); tete.setUint32(22, data.length, true);
      tete.setUint16(26, nom.length, true); tete.setUint16(28, 0, true);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, nom.length, true); c.setUint32(42, pos, true);
      morceaux.push(tete.buffer, nom, data); central.push(c.buffer, nom);
      pos += 30 + nom.length + data.length;
    });
    var taille = central.reduce(function (s, x) { return s + (x.byteLength || x.length); }, 0);
    var fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, fichiers.length, true); fin.setUint16(10, fichiers.length, true);
    fin.setUint32(12, taille, true); fin.setUint32(16, pos, true);
    return new Blob(morceaux.concat(central, [fin.buffer]), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  function xml(t) {
    return String(t).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function colonne(i) { var s = ""; i++; while (i) { var r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }

  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="6">' +
    '<font><sz val="10"/><color rgb="FF15152B"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="16"/><color rgb="FF4A2BE8"/><name val="Calibri"/></font>' +
    '<font><sz val="10"/><color rgb="FF5E5E79"/><name val="Calibri"/></font>' +
    '<font><i/><sz val="9"/><color rgb="FF5E5E79"/><name val="Calibri"/></font>' +
    '<font><u/><sz val="10"/><color rgb="FF4A2BE8"/><name val="Calibri"/></font>' +
    '</fonts>' +
    '<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF4A2BE8"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF7F6FF"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE3F5EA"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFDE8E8"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF3DC"/></patternFill></fill></fills>' +
    '<borders count="2"><border/><border><left style="thin"><color rgb="FFE6E4F4"/></left><right style="thin"><color rgb="FFE6E4F4"/></right>' +
    '<top style="thin"><color rgb="FFE6E4F4"/></top><bottom style="thin"><color rgb="FFE6E4F4"/></bottom></border></borders>' +
    '<cellStyleXfs count="1"><xf/></cellStyleXfs>' +
    '<cellXfs count="11">' +
    '<xf/>' +                                    // 0
    '<xf fontId="2" applyFont="1"/>' +           // 1 titre
    '<xf fontId="3" applyFont="1"/>' +           // 2 sous-titre
    '<xf fontId="4" applyFont="1"/>' +           // 3 note
    '<xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' + // 4 en-tête
    '<xf borderId="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' + // 5 cellule
    '<xf fillId="3" borderId="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' + // 6 ligne alternée
    '<xf fillId="4" borderId="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' + // 7 vert
    '<xf fillId="5" borderId="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' + // 8 rouge
    '<xf fillId="6" borderId="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' + // 9 ambre
    '<xf fontId="5" borderId="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' + // 10 lien
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function classeur(d) {
    var nCol = d.entetes.length, entete = 5, liens = [];
    function cellule(ref, v, s) { return '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + xml(v) + "</t></is></c>"; }
    var ent = entreprise();
    var lignesXml = [
      '<row r="1" ht="24" customHeight="1">' + cellule("A1", d.titre + (ent ? " — " + ent : ""), 1) + "</row>",
      '<row r="2">' + cellule("A2", "Édité le " + aujourdhui() + " · " + d.lignes.length + " ligne" + (d.lignes.length > 1 ? "s" : "") + " · Vigie réglementaire", 2) + "</row>",
      '<row r="3">' + cellule("A3", "Ne constitue pas un conseil juridique : seul le texte officiel fait foi.", 3) + "</row>",
      '<row r="' + entete + '" ht="22" customHeight="1">' + d.entetes.map(function (h, i) { return cellule(colonne(i) + entete, h, 4); }).join("") + "</row>"
    ];
    d.lignes.forEach(function (l, k) {
      var r = entete + 1 + k, base = k % 2 ? 6 : 5;
      lignesXml.push('<row r="' + r + '">' + l.map(function (v, i) {
        var s = base, t = teinte(v);
        if (i === d.nLien && v) { s = 10; liens.push([colonne(i) + r, v]); }
        else if (t && v.length < 40) s = t === "vert" ? 7 : t === "rouge" ? 8 : 9;
        return cellule(colonne(i) + r, v, s);
      }).join("") + "</row>");
    });
    // Largeur des colonnes : d'après leur contenu, entre 10 et 60 caractères.
    var largeurs = d.entetes.map(function (h, i) {
      var m = h.length;
      d.lignes.forEach(function (l) { String(l[i] || "").split("\n").forEach(function (x) { m = Math.max(m, x.length); }); });
      return Math.max(10, Math.min(i === d.nLien ? 30 : 60, Math.round(m * 0.9) + 2));
    });
    var derCol = colonne(Math.max(nCol - 1, 0)), derLigne = entete + d.lignes.length;
    var feuille = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
      '<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="' + entete + '" topLeftCell="A' + (entete + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/>' +
      "<cols>" + largeurs.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join("") + "</cols>" +
      "<sheetData>" + lignesXml.join("") + "</sheetData>" +
      (d.lignes.length ? '<autoFilter ref="A' + entete + ":" + derCol + derLigne + '"/>' : "") +
      '<mergeCells count="3"><mergeCell ref="A1:' + derCol + '1"/><mergeCell ref="A2:' + derCol + '2"/><mergeCell ref="A3:' + derCol + '3"/></mergeCells>' +
      (liens.length ? "<hyperlinks>" + liens.map(function (x, i) { return '<hyperlink ref="' + x[0] + '" r:id="rL' + i + '"/>'; }).join("") + "</hyperlinks>" : "") +
      '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
      '<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>' +
      "</worksheet>";
    var relsFeuille = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      liens.map(function (x, i) { return '<Relationship Id="rL' + i + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="' + xml(x[1]) + '" TargetMode="External"/>'; }).join("") +
      "</Relationships>";
    var nomFeuille = d.titre.replace(/[\\\/?*\[\]:]/g, " ").slice(0, 31);
    var refFeuille = "'" + nomFeuille.replace(/'/g, "''") + "'";
    return zip([
      ["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
      ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ["xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="' + xml(nomFeuille) + '" sheetId="1" r:id="rId1"/></sheets>' +
        (d.lignes.length ? "<definedNames>" +
          '<definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">' + xml(refFeuille) + "!$A$" + entete + ":$" + derCol + "$" + derLigne + "</definedName>" +
          '<definedName name="_xlnm.Print_Titles" localSheetId="0">' + xml(refFeuille) + "!$" + entete + ":$" + entete + "</definedName></definedNames>" : "") +
        "</workbook>"],
      ["xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ["xl/styles.xml", STYLES],
      ["xl/worksheets/sheet1.xml", feuille],
      ["xl/worksheets/_rels/sheet1.xml.rels", relsFeuille]
    ]);
  }
  function telecharger(blob, nom) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  /* --- PDF : une mise en page pour l'impression ------------------------- */
  function versPdf(table) {
    var d = donnees(table);
    var ent = entreprise();
    var bloc = document.createElement("div");
    bloc.id = "export-imprime";
    var tete = document.createElement("header");
    tete.className = "ei-tete";
    tete.innerHTML = '<p class="ei-marque">Vigie réglementaire</p><h1></h1><p class="ei-infos"></p>';
    tete.querySelector("h1").textContent = d.titre;
    tete.querySelector(".ei-infos").textContent = (ent ? ent + " · " : "") + "Édité le " + aujourdhui() + " · " +
      d.lignes.length + " ligne" + (d.lignes.length > 1 ? "s" : "");
    bloc.appendChild(tete);
    // Sur le papier : ni lien brut ni analyse, pour garder un tableau lisible.
    var garde = d.entetes.map(function (h, i) { return i; }).filter(function (i) { return d.entetes[i] !== "Lien officiel" && d.entetes[i] !== "Analyse synthétique"; });
    var t = document.createElement("table");
    var thead = t.createTHead().insertRow();
    garde.forEach(function (i) { var th = document.createElement("th"); th.textContent = d.entetes[i]; thead.appendChild(th); });
    var tb = t.createTBody();
    d.lignes.forEach(function (l) {
      var tr = tb.insertRow();
      garde.forEach(function (i) {
        var td = tr.insertCell(), v = l[i] || "", c = teinte(v);
        if (c && v.length < 40) { var s = document.createElement("span"); s.className = "ei-pastille ei-" + c; s.textContent = v; td.appendChild(s); }
        else td.textContent = v;
      });
    });
    bloc.appendChild(t);
    var pied = document.createElement("p");
    pied.className = "ei-pied";
    pied.textContent = "Ne constitue pas un conseil juridique : seul le texte officiel fait foi. Document établi avec Vigie réglementaire.";
    bloc.appendChild(pied);
    document.body.appendChild(bloc);
    document.body.classList.add("export-impression");
    var fin = function () {
      document.body.classList.remove("export-impression");
      bloc.remove();
      window.removeEventListener("afterprint", fin);
    };
    window.addEventListener("afterprint", fin);
    window.print();
    window.setTimeout(function () { if (document.getElementById("export-imprime")) fin(); }, 60000);
  }

  /* --- Envoyer par e-mail ----------------------------------------------- */
  var TYPE_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  function fichierExcel(table) {
    var d = donnees(table);
    return { d: d, fichier: new File([classeur(d)], nomFichier(table, "xlsx"), { type: TYPE_XLSX }) };
  }
  // Le partage de fichiers du système : surtout sur téléphone.
  var partageFichiers = (function () {
    try { return !!(navigator.canShare && window.matchMedia("(pointer: coarse)").matches && navigator.canShare({ files: [new File(["x"], "x.xlsx", { type: TYPE_XLSX })] })); }
    catch (e) { return false; }
  })();

  tables.forEach(function (table, n) {
    var barre = document.createElement("div");
    barre.className = "export-barre";
    barre.setAttribute("role", "group");
    barre.setAttribute("aria-label", "Télécharger ou envoyer le tableau");
    function bouton(texte, titre, icone) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "export-bouton"; b.title = titre;
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + icone + "</svg><span></span>";
      b.lastChild.textContent = texte;
      return b;
    }
    var bx = bouton("Excel", "Classeur Excel mis en forme (lignes affichées)", '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M9 13l4 5M13 13l-4 5"/>');
    var bp = bouton("PDF", "Imprimer le tableau ou l'enregistrer en PDF (lignes affichées)", '<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/>');
    var bm = bouton("Envoyer par e-mail", "Envoyer le tableau Excel à un destinataire", '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>');
    bm.classList.add("export-bouton-fort");
    var etat = document.createElement("span");
    etat.className = "export-etat"; etat.setAttribute("role", "status");

    // Le formulaire d'envoi (ordinateur) : le destinataire, puis la messagerie s'ouvre.
    var form = document.createElement("form");
    form.className = "export-envoi"; form.hidden = true; form.noValidate = true;
    var idc = "export-dest-" + n;
    form.innerHTML = '<label for="' + idc + '">Destinataire</label>' +
      '<div class="export-envoi-ligne"><input type="email" id="' + idc + '" autocomplete="email" placeholder="prenom.nom@entreprise.fr" required>' +
      '<button type="submit" class="export-bouton export-bouton-fort">Préparer l\'e-mail</button>' +
      '<button type="button" class="export-bouton export-annuler">Annuler</button></div>' +
      '<p class="export-aide">Le fichier Excel est téléchargé et votre messagerie s\'ouvre, adressée au destinataire : il reste à joindre le fichier, puis à envoyer.</p>';

    bx.addEventListener("click", function () {
      var d = donnees(table);
      telecharger(classeur(d), nomFichier(table, "xlsx"));
      etat.textContent = d.lignes.length + " ligne" + (d.lignes.length > 1 ? "s" : "") + " exportée" + (d.lignes.length > 1 ? "s" : "") + ".";
    });
    bp.addEventListener("click", function () { etat.textContent = ""; versPdf(table); });
    bm.addEventListener("click", function () {
      etat.textContent = "";
      if (partageFichiers) {
        var x = fichierExcel(table);
        navigator.share({ files: [x.fichier], title: x.d.titre, text: x.d.titre + (entreprise() ? " — " + entreprise() : "") + ", édité le " + aujourdhui() + "." })
          .then(function () { etat.textContent = "Tableau partagé."; })
          .catch(function (e) { if (e && e.name !== "AbortError") etat.textContent = "Le partage n'a pas abouti."; });
        return;
      }
      form.hidden = !form.hidden;
      bm.setAttribute("aria-expanded", String(!form.hidden));
      if (!form.hidden) form.querySelector("input").focus();
    });
    form.querySelector(".export-annuler").addEventListener("click", function () { form.hidden = true; bm.setAttribute("aria-expanded", "false"); bm.focus(); });
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var champ = form.querySelector("input"), dest = champ.value.trim();
      if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(dest)) { champ.setAttribute("aria-invalid", "true"); etat.textContent = "Adresse e-mail à vérifier."; champ.focus(); return; }
      champ.removeAttribute("aria-invalid");
      var x = fichierExcel(table);
      telecharger(x.fichier, x.fichier.name);
      var ent = entreprise();
      var sujet = x.d.titre + (ent ? " — " + ent : "");
      var corps = "Bonjour,\n\nVous trouverez ci-joint le tableau « " + x.d.titre + " »" + (ent ? " de " + ent : "") +
        ", édité le " + aujourdhui() + " (" + x.d.lignes.length + " ligne" + (x.d.lignes.length > 1 ? "s" : "") + ").\n\n" +
        "Fichier : " + x.fichier.name + "\n\nCe document ne constitue pas un conseil juridique : seul le texte officiel fait foi.\n\nBien cordialement,";
      window.location.href = "mailto:" + encodeURIComponent(dest) + "?subject=" + encodeURIComponent(sujet) + "&body=" + encodeURIComponent(corps);
      etat.textContent = "Fichier téléchargé : joignez « " + x.fichier.name + " » au message qui s'ouvre.";
      form.hidden = true; bm.setAttribute("aria-expanded", "false");
    });

    barre.appendChild(etat); barre.appendChild(bx); barre.appendChild(bp); barre.appendChild(bm);
    var avant = table.closest(".defile-tableau") || table;
    avant.parentNode.insertBefore(barre, avant);
    avant.parentNode.insertBefore(form, avant);
  });
})();
