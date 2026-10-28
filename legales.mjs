/* ==========================================================================
   Les pages légales : mentions légales, confidentialité, CGV
   --------------------------------------------------------------------------
   VERSIONS DE TRAVAIL. Elles ont été rédigées sans avocat. Sur ce produit —
   de l'information réglementaire sur laquelle des entreprises prennent des
   décisions —, la clause de limitation de responsabilité doit être relue par
   un avocat avant tout lancement commercial. Un modèle ne suffit pas.

   Deux marques dans le texte :
     [À COMPLÉTER : …]  une information à fournir (SIRET, adresse…). Elle se
                        renseigne dans SITE.editeur (build.mjs) : vide, la
                        marque s'affiche ; remplie, elle disparaît partout.
     [À DÉCIDER]        une règle commerciale à trancher (durée, préavis…).
                        La proposition est écrite juste après : la garder,
                        c'est retirer la marque ici, dans ce fichier.

   Le nom du produit vient de SITE.nom : s'il change, ces pages suivent.
   ========================================================================== */

export function pagesLegales({ page, SITE, FORMULES, TVA, esc, eur }) {
  const E = SITE.editeur || {};
  const manque = (v, quoi) => v ? esc(v) : `<mark class="a-completer">[À COMPLÉTER : ${esc(quoi)}]</mark>`;
  const decider = `<mark class="a-decider">[À DÉCIDER]</mark>`;
  const nom = esc(SITE.nom);
  const contact = `<a href="mailto:${esc(SITE.courriel)}">${esc(SITE.courriel)}</a>`;
  const denomination = manque(E.denomination, `${SITE.societe || "dénomination"}, société en cours de création`);
  const avertissement = (vente) => `<p class="reserve legal-statut"><strong>Version de travail.</strong> Ce texte doit être
    relu par un avocat avant l'ouverture des abonnements payants.${vente ? ` Il ne s'applique à aucune vente tant qu'il
    n'est pas finalisé.` : ""}</p>`;

  const gabarit = ({ fichier, titre, sous, maj, sections, vente = false }) => [fichier, page({
    titre: `${titre} | ${SITE.nom}`, description: sous, zone: "public",
    corps: `
<section class="heros heros-court">
  <div class="enveloppe">
    <div class="heros-texte"><h1>${esc(titre)}</h1></div>
    <p class="heros-sous">${esc(sous)}</p>
  </div>
</section>
<section class="section">
  <div class="enveloppe legal">
    ${avertissement(vente)}
    <p class="legal-maj">Dernière mise à jour : ${esc(maj)}</p>
    <nav class="legal-sommaire" aria-label="Sommaire">
      <ol>${sections.map((s, k) => `<li><a href="#s${k + 1}">${esc(s.t)}</a></li>`).join("")}</ol>
    </nav>
    ${sections.map((s, k) => `<section class="legal-article" id="s${k + 1}">
      <h2>${k + 1}. ${esc(s.t)}</h2>
      ${s.c}
    </section>`).join("\n    ")}
  </div>
</section>`
  })];

  /* --- Mentions légales ---------------------------------------------------- */
  const mentions = gabarit({
    fichier: "mentions-legales.html", titre: "Mentions légales", maj: "28 octobre 2026",
    sous: `Qui édite ${SITE.nom}, qui l'héberge, et comment nous joindre.`,
    sections: [
      { t: "Éditeur du site", c: `
        <p>Le site et le service ${nom} sont édités par :</p>
        <ul>
          <li><strong>Dénomination :</strong> ${denomination}</li>
          <li><strong>Forme juridique :</strong> ${manque(E.forme, "entreprise individuelle (micro-entreprise), SAS, SARL…")}${E.capital ? `, au capital de ${esc(E.capital)}` : ""}</li>
          <li><strong>Siège :</strong> ${manque(E.adresse, "adresse complète")}</li>
          <li><strong>SIRET :</strong> ${manque(E.siret, "numéro SIRET (14 chiffres)")}</li>
          <li><strong>Immatriculation :</strong> ${manque(E.immatriculation, "RCS de … ou Registre national des entreprises")}</li>
          <li><strong>TVA :</strong> ${SITE.tva === "franchise" ? esc(TVA.mention) : manque(E.tvaIntra, "numéro de TVA intracommunautaire")}</li>
          <li><strong>Contact :</strong> ${contact}${SITE.telephone ? ` — ${esc(SITE.telephone)}` : ""}</li>
        </ul>` },
      { t: "Directeur de la publication", c: `
        <p>${manque(E.directeurPublication, "nom du directeur de la publication — le représentant légal")}</p>` },
      { t: "Hébergement", c: `
        <p>Le site est hébergé par <strong>${esc(SITE.hebergeur.nom)}</strong>, ${esc(SITE.hebergeur.adresse)}
        (<a href="${esc(SITE.hebergeur.site)}" target="_blank" rel="noopener">${esc(SITE.hebergeur.site.replace(/^https:\/\//, ""))}</a>).</p>
        <p>L'hébergement des comptes clients et de leurs données sera précisé ici à l'ouverture de l'espace client,
        et dans la <a href="confidentialite.html">politique de confidentialité</a>.</p>` },
      { t: "Contenus et propriété intellectuelle", c: `
        <p>Les textes législatifs et réglementaires reproduits ou cités proviennent des sources officielles
        (Légifrance, Journal officiel, EUR-Lex et sites publics cités sur chaque fiche). Ils sont réutilisés
        conformément à leurs conditions de réutilisation, avec mention de leur source et lien vers l'original.
        Seul le texte publié par la source officielle fait foi.</p>
        <p>Les autres contenus du site — organisation des sujets, fiches, textes de méthode, mise en page,
        logo — sont la propriété de l'éditeur. Toute reproduction sans autorisation est interdite.</p>` },
      { t: "Pas de conseil juridique", c: `
        <p>Les informations publiées sur ce site sont fournies à titre méthodologique. Elles ne constituent pas
        un conseil juridique et ne remplacent pas l'avis d'un professionnel du droit sur une situation précise.</p>` },
      { t: "Liens vers d'autres sites", c: `
        <p>Le site renvoie vers des sites officiels. L'éditeur n'a pas la maîtrise de leur contenu ni de leur
        disponibilité. Un lien qui ne répond plus peut nous être signalé à ${contact}.</p>` },
      { t: "Données personnelles", c: `
        <p>Voir la <a href="confidentialite.html">politique de confidentialité</a>.</p>` }
    ]
  });

  /* --- Politique de confidentialité ----------------------------------------- */
  const confidentialite = gabarit({
    fichier: "confidentialite.html", titre: "Politique de confidentialité", maj: "28 octobre 2026",
    sous: "Quelles données nous traitons, pourquoi, combien de temps, et comment exercer vos droits.",
    sections: [
      { t: "En bref", c: `
        <ul>
          <li><strong>Aujourd'hui</strong>, le site ne pose aucun cookie, ne mesure pas l'audience et ne
            transmet aucune donnée : vos réglages et vos cases « Fait » restent dans votre navigateur.</li>
          <li><strong>À l'ouverture de l'espace client</strong>, les données de votre entreprise — dont votre
            registre de preuves — seront conservées sur nos serveurs, isolées de celles des autres clients,
            et ne serviront qu'à vous rendre le service.</li>
          <li>Nous ne vendons, ne louons et n'exploitons commercialement aucune donnée. Nous ne les
            utilisons pas pour entraîner des modèles d'intelligence artificielle.</li>
        </ul>` },
      { t: "Responsable du traitement", c: `
        <p>${denomination}, ${manque(E.adresse, "adresse du siège")} — ${contact}.</p>
        <p>Pour les données personnelles que vous saisissez dans votre registre (par exemple le nom de la
        personne qui a fait une revue), c'est votre entreprise qui en est responsable ; nous agissons alors
        pour son compte, comme sous-traitant au sens de l'article 28 du RGPD. Un accord de traitement des
        données sera annexé aux conditions générales de vente.</p>` },
      { t: "Ce que nous traitons aujourd'hui", c: `
        <ul>
          <li><strong>Visite du site.</strong> Aucun cookie, aucune mesure d'audience, aucun outil publicitaire.
            L'hébergeur (${esc(SITE.hebergeur.nom)}) traite, pour la sécurité de son service, des données
            techniques de connexion comme l'adresse IP ; voir sa propre politique de confidentialité.</li>
          <li><strong>Démonstration et réglages.</strong> Ce que vous saisissez dans l'application de
            démonstration (votre métier, vos réponses, vos chiffres, vos cases « Fait ») est enregistré dans
            votre navigateur uniquement (stockage local). Rien ne nous est envoyé ; vous l'effacez en vidant les
            données du site dans votre navigateur.</li>
          <li><strong>Vos courriels.</strong> Quand vous nous écrivez, nous utilisons votre message et votre
            adresse pour vous répondre, et les conservons trois ans après notre dernier échange.</li>
        </ul>` },
      { t: "À l'ouverture de l'espace client", c: `
        <p>Les données suivantes seront traitées pour fournir le service souscrit (base légale : l'exécution
        du contrat) :</p>
        <ul>
          <li><strong>Compte :</strong> adresse électronique, nom des utilisateurs, mot de passe — conservé
            uniquement sous forme d'empreinte chiffrée, jamais en clair.</li>
          <li><strong>Entreprise :</strong> dénomination, activité (code NAF), effectif, implantation, et les
            autres informations que vous renseignez dans vos réglages.</li>
          <li><strong>Conformité :</strong> votre plan de veille, vos réponses aux questions de situation, la
            qualification de chaque texte, et votre registre de preuves — revues, décisions, actions, avec
            leur date et leur auteur.</li>
          <li><strong>Facturation :</strong> formule, montants, factures. Le paiement est traité par notre
            prestataire de paiement : nous ne voyons jamais votre numéro de carte.</li>
          <li><strong>Sécurité :</strong> journaux de connexion, pour détecter et prévenir les accès frauduleux
            (base légale : notre intérêt légitime).</li>
        </ul>
        <p><strong>Les données de conformité sont sensibles</strong> : elles disent ce qui, chez vous, est fait
        et ce qui ne l'est pas. Elles sont isolées par entreprise — un utilisateur ne voit que celles de son
        entreprise, et le cas échéant son consultant, si vous l'avez autorisé —, chiffrées en transit, et
        accessibles à l'éditeur uniquement pour le support que vous demandez ou la sécurité du service.</p>` },
      { t: "Nos prestataires", c: `
        <p>${decider} À confirmer à l'ouverture de l'espace client. Prévus :</p>
        <ul>
          <li>hébergement de la base de données et des comptes — ${manque(E.hebergeurDonnees, "prestataire et région d'hébergement, dans l'Union européenne")} ;</li>
          <li>paiement — Stripe Payments Europe Ltd (Irlande) ;</li>
          <li>envoi des courriels du service (alertes, mot de passe oublié) — Brevo (France) ;</li>
          <li>hébergement du site public — ${esc(SITE.hebergeur.nom)} (États-Unis), qui ne reçoit aucune donnée
            de votre espace client.</li>
        </ul>
        <p>Chaque prestataire est lié par un contrat qui encadre le traitement des données. Les transferts hors
        de l'Union européenne, s'il y en a, sont encadrés par les garanties prévues par le RGPD.</p>` },
      { t: "Durées de conservation", c: `
        <ul>
          <li><strong>Compte et données de conformité :</strong> pendant l'abonnement, puis ${decider}
            <em>proposition : 12 mois</em> après sa fin, pour vous laisser le temps d'exporter votre registre ;
            elles sont ensuite supprimées. Votre registre est votre document d'audit : exportez-le avant.</li>
          <li><strong>Factures :</strong> dix ans, comme l'exige le Code de commerce.</li>
          <li><strong>Journaux de connexion :</strong> un an.</li>
          <li><strong>Sauvegardes :</strong> ${decider} <em>proposition : effacées par rotation au bout de
            30 jours</em>.</li>
          <li><strong>Échanges avec les prospects :</strong> trois ans après le dernier contact.</li>
        </ul>` },
      { t: "Cookies", c: `
        <p>Aujourd'hui : aucun. À l'ouverture de l'espace client, un seul cookie, strictement nécessaire :
        celui qui garde votre session ouverte. Il ne sert à rien d'autre, et n'appelle pas de consentement.</p>` },
      { t: "Vos droits", c: `
        <p>Vous pouvez demander l'accès à vos données, leur rectification, leur effacement, leur portabilité,
        la limitation de leur traitement, ou vous opposer à un traitement fondé sur notre intérêt légitime.
        Écrivez à ${contact} ; nous répondons dans le mois.</p>
        <p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL
        (<a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener">cnil.fr/fr/plaintes</a>).</p>` },
      { t: "Sécurité", c: `
        <p>Connexions chiffrées (HTTPS), mots de passe conservés sous forme d'empreinte, isolation des données de
        chaque entreprise au niveau de la base de données, sauvegardes régulières. Aucune mesure n'étant
        infaillible, toute faille qui toucherait vos données vous serait notifiée, ainsi qu'à la CNIL, dans les
        conditions prévues par le RGPD.</p>` }
    ]
  });

  /* --- CGV ---------------------------------------------------------------- */
  const lignesFormules = Object.values(FORMULES).map((f) => `<li><strong>${esc(f.l)}</strong> —
    ${esc(eur(f.an))} par an, ou ${esc(eur(f.mois))} par mois : ${esc(f.donne.join(" ; "))}.</li>`).join("");
  const cgv = gabarit({
    fichier: "cgv.html", titre: "Conditions générales de vente", maj: "28 octobre 2026", vente: true,
    sous: `Les règles de l'abonnement à ${SITE.nom}, réservé aux professionnels.`,
    sections: [
      { t: "Objet et champ d'application", c: `
        <p>Les présentes conditions régissent la vente, par ${denomination} (« l'éditeur »), d'abonnements au
        service ${nom} (« le Service »). Elles prévalent sur tout autre document, sauf accord écrit contraire.</p>
        <p><strong>Le Service est réservé aux professionnels</strong> — entreprises, associations, organismes
        — qui le souscrivent pour les besoins de leur activité (« le Client »). Il n'est pas proposé aux
        consommateurs.</p>` },
      { t: "Le Service", c: `
        <p>Le Service aide le Client à organiser sa veille réglementaire : à partir de son activité (code NAF)
        et de ses réponses à des questions sur sa situation, il propose une liste de sujets réglementaires à
        suivre, leur rythme de revue, les textes officiels qui paraissent sur ces sujets, des actions types, et,
        selon la formule, un registre daté des revues, décisions et actions.</p>
        <p>Les formules :</p>
        <ul>${lignesFormules}</ul>
        <p>Les textes proviennent de sources officielles publiques (Journal officiel, Légifrance, EUR-Lex et
        autres sites publics cités). Ils sont relevés automatiquement, à intervalle régulier ; leur apparition
        dans le Service suit leur publication avec un délai, et dépend de la disponibilité de ces sources.</p>` },
      { t: "Nature du Service : un outil méthodologique", c: `
        <p class="legal-cle">Cet article est essentiel. Le Client reconnaît l'avoir lu et accepté.</p>
        <ol>
          <li><strong>Pas de conseil juridique.</strong> Le Service est un outil méthodologique d'organisation de
            la veille. Il ne constitue pas une consultation juridique, ni un conseil juridique, et ne remplace pas
            l'avis d'un professionnel du droit sur la situation particulière du Client.</li>
          <li><strong>Pas d'exhaustivité.</strong> La liste des sujets et des textes proposée est indicative. Elle
            repose sur une classification générale par activité et sur les informations fournies par le Client.
            Elle ne prétend pas recenser toutes les obligations applicables au Client ; en particulier, elle peut
            ne pas couvrir les obligations propres à son site, à ses autorisations individuelles, aux arrêtés
            locaux ou préfectoraux, ou à ses conventions collectives.</li>
          <li><strong>Le texte officiel fait foi.</strong> Les actions types, intitulés et classements proposés
            sont des aides. Seul le texte publié par la source officielle fait foi ; le Client le consulte avant
            toute décision.</li>
          <li><strong>La conformité reste celle du Client.</strong> L'identification, l'interprétation et
            l'application des obligations qui s'imposent au Client, ainsi que les décisions qu'il prend, relèvent
            de sa seule responsabilité. Le Service ne certifie pas sa conformité ; la décision de certification
            appartient à l'organisme certificateur.</li>
          <li><strong>Résumés automatiques.</strong> Le cas échéant, un résumé produit automatiquement est établi à
            partir du texte officiel lui-même, cite sa source et renvoie à l'original. Il peut contenir des erreurs
            et ne remplace pas la lecture du texte.</li>
        </ol>` },
      { t: "Souscription et accès", c: `
        <p>L'abonnement est souscrit en ligne, par le paiement de la formule choisie. Il donne accès à un espace
        client pour les utilisateurs désignés par le Client. Le Client fournit des informations exactes, garde ses
        identifiants confidentiels, et répond de l'usage qui est fait de son espace.</p>` },
      { t: "Prix", c: `
        <p>Les prix sont ceux affichés sur la page des tarifs au jour de la souscription, en euros.
        ${esc(TVA.mention)}.</p>
        <p>L'éditeur peut modifier ses prix ; le nouveau prix ne s'applique qu'au renouvellement suivant, après
        en avoir informé le Client ${decider} <em>proposition : au moins 30 jours à l'avance</em>.</p>` },
      { t: "Paiement et facturation", c: `
        <p>L'abonnement annuel est payable d'avance pour douze mois ; l'abonnement mensuel, d'avance chaque mois.
        Le paiement est traité par le prestataire de paiement de l'éditeur. Une facture est émise à chaque
        échéance.</p>
        <p>Tout retard de paiement entraîne de plein droit, sans rappel préalable, des pénalités de retard au taux
        de trois fois le taux d'intérêt légal, et une indemnité forfaitaire pour frais de recouvrement de 40 €
        (article L. 441-10 du Code de commerce). Après une mise en demeure restée sans effet pendant
        ${decider} <em>proposition : 15 jours</em>, l'éditeur peut suspendre l'accès au Service.</p>` },
      { t: "Durée, renouvellement et résiliation", c: `
        <ul>
          <li><strong>Abonnement mensuel :</strong> il se renouvelle chaque mois et peut être résilié à tout
            moment ; la résiliation prend effet à la fin du mois en cours.</li>
          <li><strong>Abonnement annuel :</strong> il est souscrit pour douze mois et se renouvelle pour douze
            mois, sauf résiliation ${decider} <em>proposition : avant la date d'échéance</em>. L'éditeur rappelle
            l'échéance au Client ${decider} <em>proposition : 30 jours avant</em>.</li>
          <li>Les sommes versées pour la période en cours ne sont pas remboursées ${decider}.</li>
          <li>La résiliation se fait depuis l'espace client ou par courriel à ${contact}.</li>
          <li>En cas de manquement grave de l'une des parties, l'autre peut résilier après une mise en demeure
            restée sans effet pendant 30 jours.</li>
        </ul>` },
      { t: "Fin de l'abonnement : récupérer son registre", c: `
        <p>Le registre de preuves est le document d'audit du Client. Pendant toute la durée de l'abonnement, et
        pendant ${decider} <em>proposition : 90 jours</em> après sa fin, le Client peut l'exporter, ainsi que
        ses autres données, dans un format lisible et réutilisable (PDF et tableur). Passé le délai prévu par la
        <a href="confidentialite.html">politique de confidentialité</a>, les données sont supprimées.</p>` },
      { t: "Disponibilité", c: `
        <p>L'éditeur s'efforce d'assurer l'accès au Service en continu, et le cas échéant d'informer le Client
        des interruptions prévues. Il est tenu à une obligation de moyens. Le Service affiche la date de la
        dernière collecte réussie des textes, pour que le Client sache s'il est à jour.</p>` },
      { t: "Limitation de responsabilité", c: `
        <p class="legal-cle">À faire relire par un avocat en priorité.</p>
        <ol>
          <li>L'éditeur est tenu d'une obligation de moyens.</li>
          <li>Il n'est pas responsable : du contenu, des erreurs, omissions ou retards de publication des sources
            officielles ; des conséquences d'informations inexactes ou incomplètes fournies par le Client ; des
            décisions prises par le Client, ni de leurs suites ; d'un usage du Service non conforme aux présentes
            conditions.</li>
          <li>Il ne répond pas des dommages indirects, tels que la perte de chiffre d'affaires, de clientèle ou de
            certification, les amendes, sanctions ou pénalités infligées au Client, et les conséquences d'un
            contrôle ou d'un audit.</li>
          <li>Sauf faute lourde ou dolosive, sa responsabilité est limitée, toutes causes confondues, au montant
            payé par le Client au titre du Service au cours des douze mois précédant le fait générateur.</li>
        </ol>` },
      { t: "Données et confidentialité", c: `
        <p>Les données du Client lui appartiennent. L'éditeur les traite uniquement pour fournir le Service, selon
        la <a href="confidentialite.html">politique de confidentialité</a>, et les tient confidentielles. Pour les
        données personnelles que le Client saisit, l'éditeur agit comme sous-traitant ; l'accord prévu par
        l'article 28 du RGPD est annexé aux présentes ${decider}
        <em>à rédiger avec l'avocat</em>.</p>` },
      { t: "Propriété intellectuelle", c: `
        <p>L'abonnement confère au Client un droit d'usage du Service, personnel et non exclusif, pour la durée de
        l'abonnement et pour ses besoins internes. Les textes officiels restent librement réutilisables dans les
        conditions de leurs sources. Le reste du Service demeure la propriété de l'éditeur.</p>` },
      { t: "Force majeure", c: `
        <p>Aucune partie n'est responsable d'un manquement causé par un événement de force majeure au sens de
        l'article 1218 du Code civil.</p>` },
      { t: "Modification des conditions", c: `
        <p>L'éditeur peut modifier les présentes conditions ; il en informe le Client, et la nouvelle version
        s'applique au renouvellement suivant.</p>` },
      { t: "Droit applicable et litiges", c: `
        <p>Les présentes conditions sont soumises au droit français. Les parties recherchent d'abord une solution
        amiable. À défaut, le litige est porté devant ${manque(E.tribunal, "tribunal compétent — à valider avec l'avocat")}.</p>` }
    ]
  });

  return [mentions, confidentialite, cgv];
}

/* Ce qui manque encore dans SITE.editeur : la construction l'affiche. */
export function champsLegauxManquants(SITE) {
  const E = SITE.editeur || {};
  return [["denomination", "dénomination"], ["forme", "forme juridique"], ["adresse", "adresse du siège"],
    ["siret", "SIRET"], ["immatriculation", "immatriculation"], ["directeurPublication", "directeur de la publication"],
    ["hebergeurDonnees", "hébergeur des données clients"], ["tribunal", "tribunal compétent"]]
    .filter(([k]) => !E[k]).map(([, l]) => l);
}
