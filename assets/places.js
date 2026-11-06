/* ==========================================================================
   Vigie — le nombre de clients de l'abonnement consultant (6 novembre 2026)
   --------------------------------------------------------------------------
   Un consultant abonné pour N clients ne peut pas en inscrire un de plus sans
   augmenter son abonnement : la base le refuse (migration 26). Ici, on le dit
   avant qu'il remplisse le formulaire, avec le moyen de modifier l'abonnement.
   window.VIGIE_PLACES(cabinetId, formulaire, contact)
   ========================================================================== */
(function () {
  "use strict";
  var MESSAGE = "Vous devez modifier votre abonnement pour ajouter un client supplémentaire.";
  function modifier(contact, nom, max) {
    return "mailto:" + contact + "?subject=" + encodeURIComponent("Modifier mon abonnement consultant" + (nom ? " — " + nom : "")) +
      "&body=" + encodeURIComponent("Bonjour,\n\nMon abonnement couvre " + max + " client" + (max > 1 ? "s" : "") +
        ". Je souhaite le passer à " + (max + 1) + " clients.\n");
  }
  window.VIGIE_PLACES = function (cabinet, form, contact, nom) {
    var V = window.VIGIE;
    if (!V || !form || !cabinet) return;
    var bloc = form.parentNode.querySelector(".places-pleines");
    V.rpc("cabinet_places", { c: cabinet }).then(function (r) {
      if (!r.ok || !r.donnees) return;
      var d = r.donnees, plein = d.max !== null && d.max !== undefined && d.clients >= d.max;
      [].forEach.call(form.querySelectorAll("input, button, select"), function (x) { x.disabled = plein; });
      if (!plein) { if (bloc) bloc.remove(); return; }
      if (!bloc) {
        bloc = document.createElement("div");
        bloc.className = "reserve places-pleines";
        bloc.setAttribute("role", "status");
        form.parentNode.insertBefore(bloc, form);
      }
      bloc.textContent = "";
      var p = document.createElement("p"), b = document.createElement("strong");
      b.textContent = MESSAGE; p.appendChild(b); bloc.appendChild(p);
      var q = document.createElement("p");
      q.textContent = "Votre abonnement couvre " + d.max + " client" + (d.max > 1 ? "s" : "") + " et vous en avez " + d.clients + ". ";
      var a = document.createElement("a");
      a.href = modifier(contact, nom, d.max); a.textContent = "Modifier mon abonnement";
      q.appendChild(a); q.appendChild(document.createTextNode("."));
      bloc.appendChild(q);
    });
  };
  window.VIGIE_PLACES.MESSAGE = MESSAGE;
})();
