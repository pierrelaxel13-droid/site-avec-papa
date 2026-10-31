-- ===========================================================================
-- Les tests d'isolation de la base Vigie
-- ---------------------------------------------------------------------------
-- Des utilisateurs fictifs, trois entreprises, un cabinet consultant, et des
-- vérifications : chacun voit et fait ce qu'il doit, et RIEN d'autre.
-- Le tout dans une transaction ANNULÉE à la fin (ROLLBACK) : on peut le jouer
-- sur la vraie base sans y laisser une trace.
--
--   psql "$URL" -v ON_ERROR_STOP=1 -f supabase/tests/isolation.sql
--
-- Le moindre échec arrête tout avec « ÉCHEC : … ». Sinon, chaque vérification
-- affiche « ok : … ».
--
-- Les personnages :
--   A  entreprise suivie par le cabinet C, qui l'a autorisé ; formule complète
--   B  entreprise sans consultant ; formule Textes (40… 59 €) : pas de registre
--   D  entreprise suivie par le cabinet C, qui NE l'a PAS autorisé
--   a_admin, a_lecteur, b_admin, d_admin : leurs membres
--   c_membre, c_lecteur : membres du cabinet C
--   inconnu : un compte sans rien ; neuf : un compte qui vient d'être créé ; seul : un compte qui n'a rien fait ; axel : l'administrateur du service
-- ===========================================================================

begin;

create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

create function tests.ok(condition boolean, quoi text) returns void language plpgsql as $$
begin
  if condition is not true then raise exception 'ÉCHEC : %', quoi; end if;
  raise notice 'ok : %', quoi;
end $$;

-- Ce qui doit échouer : on l'exécute, et on exige une erreur.
create function tests.refuse(requete text, quoi text) returns void language plpgsql as $$
begin
  begin
    execute requete;
  exception when others then
    raise notice 'ok : % (refusé : %)', quoi, left(sqlerrm, 90);
    return;
  end;
  raise exception 'ÉCHEC : % — accepté alors qu''il devait être refusé', quoi;
end $$;

create function tests.compte(requete text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from (%s) t', requete) into n;
  return n;
end $$;

-- Devenir quelqu'un (comme le fait Supabase avec le jeton de connexion).
create function tests.qui(u uuid, courriel text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'email', courriel)::text, true)
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

-- --- Le décor (en tant que propriétaire de la base) ---------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a_admin@test.fr'),
  ('00000000-0000-0000-0000-0000000000a2', 'a_lecteur@test.fr'),
  ('00000000-0000-0000-0000-0000000000b1', 'b_admin@test.fr'),
  ('00000000-0000-0000-0000-0000000000d1', 'd_admin@test.fr'),
  ('00000000-0000-0000-0000-0000000000c1', 'c_membre@test.fr'),
  ('00000000-0000-0000-0000-0000000000c2', 'c_lecteur@test.fr'),
  ('00000000-0000-0000-0000-0000000000e1', 'inconnu@test.fr'),
  ('00000000-0000-0000-0000-0000000000e2', 'nouveau@test.fr'),
  ('00000000-0000-0000-0000-0000000000e3', 'neuf@test.fr'),
  ('00000000-0000-0000-0000-0000000000e4', 'seul@test.fr'),
  ('00000000-0000-0000-0000-0000000000f1', 'axel@test.fr');

insert into public.sujets (id, nom, famille, frequence) values
  ('t_sst', 'Santé et sécurité (essai)', 'sst', 'hebdomadaire'),
  ('t_env', 'Environnement (essai)', 'env', 'mensuelle');
insert into public.textes (id, source, titre, url) values
  ('T_ESSAI_1', 'jorf', 'Arrêté d''essai', 'https://www.legifrance.gouv.fr/');

insert into public.consultants (id, nom) values ('00000000-0000-0000-0000-00000000c000', 'Cabinet C (essai)');
insert into public.entreprises (id, denomination, naf, consultant_id, acces_consultant) values
  ('00000000-0000-0000-0000-00000000a000', 'Entreprise A (essai)', '43', '00000000-0000-0000-0000-00000000c000', true),
  ('00000000-0000-0000-0000-00000000b000', 'Entreprise B (essai)', '56', null, false),
  ('00000000-0000-0000-0000-00000000d000', 'Entreprise D (essai)', '10', '00000000-0000-0000-0000-00000000c000', false);
insert into public.membres_entreprise (entreprise_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000a000', '00000000-0000-0000-0000-0000000000a1', 'admin'),
  ('00000000-0000-0000-0000-00000000a000', '00000000-0000-0000-0000-0000000000a2', 'lecteur'),
  ('00000000-0000-0000-0000-00000000b000', '00000000-0000-0000-0000-0000000000b1', 'admin'),
  ('00000000-0000-0000-0000-00000000d000', '00000000-0000-0000-0000-0000000000d1', 'admin');
insert into public.membres_consultant (consultant_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000c000', '00000000-0000-0000-0000-0000000000c1', 'membre'),
  ('00000000-0000-0000-0000-00000000c000', '00000000-0000-0000-0000-0000000000c2', 'lecteur');
insert into public.abonnements (entreprise_id, formule, periode, statut) values
  ('00000000-0000-0000-0000-00000000a000', 'complet', 'an', 'active'),
  ('00000000-0000-0000-0000-00000000b000', 'textes', 'mois', 'active'),
  ('00000000-0000-0000-0000-00000000d000', 'complet', 'mois', 'active');
insert into public.plan_sujets (entreprise_id, sujet_id, origine) values
  ('00000000-0000-0000-0000-00000000a000', 't_sst', 'metier');
insert into prive.administrateurs (user_id) values ('00000000-0000-0000-0000-0000000000f1');

-- Une entrée chez B et chez D, posées par le système (clé service).
set local role service_role;
insert into public.registre (entreprise_id, genre, objet) values
  ('00000000-0000-0000-0000-00000000b000', 'revue', 'Revue chez B (essai)'),
  ('00000000-0000-0000-0000-00000000d000', 'revue', 'Revue chez D (essai)');
reset role;

-- =========================================================================
-- 1. a_admin, admin de A
-- =========================================================================
select tests.qui('00000000-0000-0000-0000-0000000000a1', 'a_admin@test.fr');
set local role authenticated;

select tests.ok(tests.compte('select 1 from public.entreprises') = 1, 'a_admin ne voit qu''une entreprise');
select tests.ok(exists (select 1 from public.entreprises where denomination = 'Entreprise A (essai)'), 'et c''est la sienne, A');
select tests.ok(tests.compte($$select 1 from public.registre where entreprise_id <> '00000000-0000-0000-0000-00000000a000'$$) = 0,
  'a_admin ne lit aucune entrée du registre de B ou de D');

insert into public.registre (entreprise_id, genre, sujet_id, objet, date_effet)
  values ('00000000-0000-0000-0000-00000000a000', 'revue', 't_sst', 'Revue hebdomadaire santé-sécurité', current_date);
insert into public.registre (entreprise_id, genre, texte_id, objet, statut)
  values ('00000000-0000-0000-0000-00000000a000', 'qualification', 'T_ESSAI_1', 'Texte applicable chez nous', 'applicable');

select tests.ok((select auteur_id from public.registre where objet = 'Revue hebdomadaire santé-sécurité') = '00000000-0000-0000-0000-0000000000a1',
  'l''auteur est posé par la base : a_admin');
select tests.ok((select auteur_nom from public.registre where objet = 'Revue hebdomadaire santé-sécurité') = 'a_admin@test.fr',
  'son nom est figé dans l''entrée');
select tests.ok((select abs(extract(epoch from enregistre_le - now())) < 5 from public.registre where objet = 'Revue hebdomadaire santé-sécurité'),
  'l''heure d''enregistrement est posée par la base');
select tests.ok((select precedente from public.registre where objet = 'Texte applicable chez nous')
              = (select empreinte from public.registre where objet = 'Revue hebdomadaire santé-sécurité'),
  'chaque entrée porte l''empreinte de la précédente');

select tests.refuse($$insert into public.registre (entreprise_id, genre, objet) values ('00000000-0000-0000-0000-00000000b000', 'revue', 'intrusion')$$,
  'a_admin ne peut pas écrire dans le registre de B');
select tests.refuse($$insert into public.registre (entreprise_id, genre, objet, enregistre_le) values ('00000000-0000-0000-0000-00000000a000', 'revue', 'antidatée', '2020-01-01')$$,
  'a_admin ne peut pas choisir l''heure d''enregistrement');
select tests.refuse($$insert into public.registre (entreprise_id, genre, objet, auteur_id) values ('00000000-0000-0000-0000-00000000a000', 'revue', 'usurpée', '00000000-0000-0000-0000-0000000000b1')$$,
  'a_admin ne peut pas signer au nom d''un autre');
select tests.refuse($$update public.registre set objet = 'modifiée' where entreprise_id = '00000000-0000-0000-0000-00000000a000'$$,
  'a_admin ne peut pas modifier une entrée du registre');
select tests.refuse($$delete from public.registre where entreprise_id = '00000000-0000-0000-0000-00000000a000'$$,
  'a_admin ne peut pas effacer une entrée du registre');

-- Corriger : une nouvelle entrée, qui pointe vers l'ancienne.
insert into public.registre (entreprise_id, genre, objet, corrige_id)
  select '00000000-0000-0000-0000-00000000a000', 'correction', 'Erreur de saisie : la revue a eu lieu la veille', id
  from public.registre where objet = 'Revue hebdomadaire santé-sécurité';
select tests.ok(not exists (select 1 from public.registre_en_vigueur where objet = 'Revue hebdomadaire santé-sécurité'),
  'une entrée corrigée ne compte plus…');
select tests.ok(exists (select 1 from public.registre where objet = 'Revue hebdomadaire santé-sécurité'),
  '… mais elle reste dans le registre');
select tests.refuse($$insert into public.registre (entreprise_id, genre, objet) values ('00000000-0000-0000-0000-00000000a000', 'correction', 'sans cible')$$,
  'une correction doit dire ce qu''elle corrige');

select tests.ok((select intact from public.verifier_registre('00000000-0000-0000-0000-00000000a000')), 'la chaîne d''empreintes de A est intacte');
select tests.ok(exists (select 1 from public.qualifications where texte_id = 'T_ESSAI_1' and statut = 'applicable'),
  'la qualification du texte se lit dans la vue');
select tests.ok(exists (select 1 from public.echeances where sujet_id = 't_sst'), 'les échéances de A se calculent');

select tests.refuse($$delete from public.membres_entreprise where user_id = '00000000-0000-0000-0000-0000000000a1'$$,
  'le dernier admin de A ne peut pas partir');
select tests.refuse($$update public.entreprises set consultant_id = null where id = '00000000-0000-0000-0000-00000000a000'$$,
  'a_admin ne peut pas changer le consultant en direct (seulement par la fonction prévue)');
reset role;

-- =========================================================================
-- 2. a_lecteur : lit A, n'écrit pas
-- =========================================================================
select tests.qui('00000000-0000-0000-0000-0000000000a2', 'a_lecteur@test.fr');
set local role authenticated;
select tests.ok(tests.compte($$select 1 from public.registre where entreprise_id = '00000000-0000-0000-0000-00000000a000'$$) >= 2,
  'a_lecteur lit le registre de A');
select tests.refuse($$insert into public.registre (entreprise_id, genre, objet) values ('00000000-0000-0000-0000-00000000a000', 'revue', 'lecteur')$$,
  'a_lecteur ne peut pas écrire dans le registre');
reset role;

-- =========================================================================
-- 3. b_admin : formule Textes — réponses oui, plan et registre non
-- =========================================================================
select tests.qui('00000000-0000-0000-0000-0000000000b1', 'b_admin@test.fr');
set local role authenticated;
select tests.ok(tests.compte('select 1 from public.entreprises') = 1, 'b_admin ne voit que B');
insert into public.reponses (entreprise_id, declencheur, valeur) values ('00000000-0000-0000-0000-00000000b000', 'salaries', true);
select tests.ok(true, 'b_admin enregistre ses réponses (formule Textes)');
select tests.refuse($$insert into public.plan_sujets (entreprise_id, sujet_id, origine) values ('00000000-0000-0000-0000-00000000b000', 't_env', 'manuel')$$,
  'b_admin n''a pas de plan suivi en formule Textes');
select tests.refuse($$insert into public.registre (entreprise_id, genre, objet) values ('00000000-0000-0000-0000-00000000b000', 'revue', 'formule trop basse')$$,
  'b_admin n''écrit pas dans le registre en formule Textes');
select tests.ok(tests.compte($$select 1 from public.registre where entreprise_id = '00000000-0000-0000-0000-00000000b000'$$) = 1,
  'mais b_admin lit toujours ce qui est déjà dans son registre');
reset role;

-- =========================================================================
-- 4. Le cabinet C : voit A (autorisé), pas D (refusé), jamais B
-- =========================================================================
select tests.qui('00000000-0000-0000-0000-0000000000c1', 'c_membre@test.fr');
set local role authenticated;
select tests.ok(tests.compte('select 1 from public.entreprises') = 1, 'c_membre ne voit qu''une entreprise');
select tests.ok(exists (select 1 from public.entreprises where denomination = 'Entreprise A (essai)'), 'c''est A, qui l''a autorisé');
select tests.ok(tests.compte($$select 1 from public.registre where entreprise_id = '00000000-0000-0000-0000-00000000d000'$$) = 0,
  'c_membre ne lit rien chez D, qui ne l''a pas autorisé');
insert into public.registre (entreprise_id, genre, texte_id, objet, statut)
  values ('00000000-0000-0000-0000-00000000a000', 'qualification', 'T_ESSAI_1', 'Qualifié par le consultant', 'a_suivre');
select tests.ok(true, 'c_membre écrit dans le registre de A, son client');
select tests.refuse($$insert into public.registre (entreprise_id, genre, objet) values ('00000000-0000-0000-0000-00000000d000', 'revue', 'sans accord')$$,
  'c_membre n''écrit pas chez D');
reset role;

select tests.qui('00000000-0000-0000-0000-0000000000c2', 'c_lecteur@test.fr');
set local role authenticated;
select tests.ok(tests.compte($$select 1 from public.registre where entreprise_id = '00000000-0000-0000-0000-00000000a000'$$) > 0,
  'c_lecteur lit le registre de A');
select tests.refuse($$insert into public.registre (entreprise_id, genre, objet) values ('00000000-0000-0000-0000-00000000a000', 'revue', 'lecteur du cabinet')$$,
  'c_lecteur n''écrit pas chez A');
reset role;

-- A retire l'accès de son consultant : il ne voit plus rien.
select tests.qui('00000000-0000-0000-0000-0000000000a1', 'a_admin@test.fr');
set local role authenticated;
update public.entreprises set acces_consultant = false where id = '00000000-0000-0000-0000-00000000a000';
reset role;
select tests.qui('00000000-0000-0000-0000-0000000000c1', 'c_membre@test.fr');
set local role authenticated;
select tests.ok(tests.compte('select 1 from public.entreprises') = 0, 'A a retiré l''accès : c_membre ne voit plus A');
select tests.ok(tests.compte('select 1 from public.registre') = 0, 'ni son registre');
reset role;

-- =========================================================================
-- 5. Un inconnu, un visiteur non connecté, l'administrateur
-- =========================================================================
select tests.qui('00000000-0000-0000-0000-0000000000e1', 'inconnu@test.fr');
set local role authenticated;
select tests.ok(tests.compte('select 1 from public.entreprises') = 0, 'un compte sans entreprise ne voit aucune entreprise');
select tests.ok(tests.compte('select 1 from public.registre') = 0, 'ni aucun registre');
select tests.ok(tests.compte('select 1 from public.abonnements') = 0, 'ni aucun abonnement');
select tests.ok(tests.compte('select 1 from public.textes') >= 1, 'mais il lit les textes publics');
select tests.refuse($$insert into public.abonnements (entreprise_id, formule, periode, statut) values ('00000000-0000-0000-0000-00000000b000', 'complet', 'an', 'active')$$,
  'personne ne s''offre un abonnement depuis le navigateur');
select tests.refuse($$select prive.purger_entreprise('00000000-0000-0000-0000-00000000b000')$$,
  'personne ne purge une entreprise depuis le navigateur');
select tests.ok(public.creer_entreprise('Ma nouvelle entreprise (essai)', '43.21A') is not null, 'il crée sa propre entreprise…');
select tests.ok(tests.compte('select 1 from public.entreprises') = 1, '… et ne voit qu''elle');
reset role;

set local role anon;
select tests.refuse('select * from public.entreprises', 'un visiteur non connecté ne lit pas les entreprises');
select tests.refuse('select * from public.registre', 'ni le registre');
select tests.refuse($$select public.creer_entreprise('anonyme')$$, 'ni ne crée d''entreprise');
select tests.ok(tests.compte('select 1 from public.textes') >= 1, 'il lit les textes publics');
reset role;

select tests.qui('00000000-0000-0000-0000-0000000000f1', 'axel@test.fr');
set local role authenticated;
select tests.ok(tests.compte($$select 1 from public.entreprises where denomination like 'Entreprise _ (essai)'$$) = 3,
  'l''administrateur voit la liste des entreprises');
select tests.ok(tests.compte('select 1 from public.registre') = 0, 'mais aucun registre');
reset role;

-- =========================================================================
-- 6. Les invitations
-- =========================================================================
select tests.qui('00000000-0000-0000-0000-0000000000a1', 'a_admin@test.fr');
set local role authenticated;
select set_config('tests.jeton', public.inviter('nouveau@test.fr', 'lecteur', '00000000-0000-0000-0000-00000000a000'), true);
reset role;
select tests.qui('00000000-0000-0000-0000-0000000000e1', 'inconnu@test.fr');
set local role authenticated;
select tests.refuse(format('select public.accepter_invitation(%L)', current_setting('tests.jeton')),
  'une invitation ne s''accepte pas depuis une autre adresse');
reset role;
select tests.qui('00000000-0000-0000-0000-0000000000e2', 'nouveau@test.fr');
set local role authenticated;
select public.accepter_invitation(current_setting('tests.jeton'));
select tests.ok(tests.compte('select 1 from public.entreprises') = 1, 'l''invité rejoint A');
select tests.refuse(format('select public.accepter_invitation(%L)', current_setting('tests.jeton')),
  'une invitation ne sert qu''une fois');
reset role;

-- =========================================================================
-- 7. Même la clé service ne réécrit pas l'histoire
-- =========================================================================
set local role service_role;
select tests.refuse($$update public.registre set objet = 'réécrite'$$, 'la clé service ne modifie pas le registre');
select tests.refuse($$delete from public.registre$$, 'la clé service n''efface pas une entrée');
select tests.refuse($$truncate public.registre$$, 'la clé service ne vide pas le registre');
reset role;

-- Si quelqu'un passait outre (le propriétaire de la base peut désactiver un
-- déclencheur), la chaîne d'empreintes le montrerait :
alter table public.registre disable trigger registre_immuable;
update public.registre set objet = 'Revue falsifiée' where objet = 'Texte applicable chez nous';
alter table public.registre enable trigger registre_immuable;
select tests.ok(not (select intact from public.verifier_registre('00000000-0000-0000-0000-00000000a000')),
  'une entrée falsifiée en douce est détectée par la chaîne d''empreintes');

-- La purge de fin de conservation : tout d'un bloc, et journalisée.
set local role service_role;
select prive.purger_entreprise('00000000-0000-0000-0000-00000000d000');
select tests.ok(not exists (select 1 from public.entreprises where id = '00000000-0000-0000-0000-00000000d000'), 'la purge efface l''entreprise D');
select tests.ok(not exists (select 1 from public.registre where entreprise_id = '00000000-0000-0000-0000-00000000d000'), 'et tout son registre');
select tests.ok(exists (select 1 from prive.purges where entreprise_id = '00000000-0000-0000-0000-00000000d000'), 'et la purge est journalisée');
select tests.ok(coalesce(current_setting('vigie.purge', true), '') = '', 'et les protections sont remises aussitôt');
reset role;

-- =========================================================================
-- 8. Ce que le site lit à la connexion : mes_entreprises()
-- =========================================================================
select tests.qui('00000000-0000-0000-0000-0000000000a1', 'a_admin@test.fr');
set local role authenticated;
select tests.ok((select count(*) = 1 and bool_and(denomination = 'Entreprise A (essai)' and role = 'admin' and rang = 3)
                 from public.mes_entreprises()), 'a_admin : sa seule entreprise, admin, formule complète');
select tests.qui('00000000-0000-0000-0000-0000000000b1', 'b_admin@test.fr');
select tests.ok((select count(*) = 1 and bool_and(denomination = 'Entreprise B (essai)' and rang = 1)
                 from public.mes_entreprises()), 'b_admin : seulement B, formule Textes');
select tests.qui('00000000-0000-0000-0000-0000000000c1', 'c_membre@test.fr');
select tests.ok((select count(*) = 0 from public.mes_entreprises()), 'le consultant n''y voit pas les entreprises de ses clients');
select tests.qui('00000000-0000-0000-0000-0000000000e3', 'neuf@test.fr');
select tests.ok((select count(*) = 0 from public.mes_entreprises()), 'un compte qui vient d''être créé : aucune entreprise');
-- Un nouveau compte nomme son entreprise : il en est l'admin, sans abonnement.
select public.creer_entreprise('Entreprise E (essai)');
select tests.ok((select count(*) = 1 and bool_and(role = 'admin' and rang = 0) from public.mes_entreprises()),
  'une entreprise qu''on vient de nommer : admin, pas encore d''abonnement');
select tests.refuse($$insert into public.registre (entreprise_id, genre, objet)
  select entreprise_id, 'revue', 'sans abonnement' from public.mes_entreprises()$$,
  'sans abonnement, on n''écrit pas dans le registre');
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select tests.refuse($$select * from public.mes_entreprises()$$, 'un visiteur non connecté ne peut pas l''appeler');
reset role;

-- =========================================================================
-- 9. L'administration : réservée à l'administrateur, sans les registres
-- =========================================================================
-- L'abonnement de B devient « payé chez Stripe » : l'administrateur ne doit
-- jamais y toucher.
update public.abonnements set stripe_abonnement = 'sub_essai_b'
 where entreprise_id = '00000000-0000-0000-0000-00000000b000';

select tests.qui('00000000-0000-0000-0000-0000000000a1', 'a_admin@test.fr');
set local role authenticated;
select tests.ok(not public.suis_administrateur(), 'un client n''est pas administrateur');
select tests.refuse($$select public.admin_vue()$$, 'un client n''ouvre pas l''administration');
select tests.refuse($$select public.admin_abonnement('00000000-0000-0000-0000-00000000a000', 'complet')$$,
  'un client ne se donne pas de formule');
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select tests.refuse($$select public.admin_vue()$$, 'un visiteur non plus');
reset role;

select tests.qui('00000000-0000-0000-0000-0000000000f1', 'axel@test.fr');
set local role authenticated;
select tests.ok(public.suis_administrateur(), 'l''administrateur est reconnu');
select tests.ok((select json_array_length(public.admin_vue() -> 'entreprises') >= 3), 'il voit la liste des entreprises');
select tests.ok((select (public.admin_vue() -> 'entreprises')::text like '%a_admin@test.fr%'), 'avec les adresses de leurs comptes');
select tests.ok((select (public.admin_vue() -> 'sans_entreprise')::text like '%seul@test.fr%'), 'et les comptes sans entreprise');
select tests.ok((select (public.admin_vue())::text not like '%Revue chez B%'), 'mais rien de leur registre');
select tests.ok(tests.compte('select 1 from public.registre') = 0, 'et toujours aucun registre en direct');
select public.admin_abonnement('00000000-0000-0000-0000-00000000b000', 'complet');
reset role;
select tests.ok(prive.rang_entreprise('00000000-0000-0000-0000-00000000b000') = 3, 'il donne la formule complète à B');
select tests.qui('00000000-0000-0000-0000-0000000000f1', 'axel@test.fr');
set local role authenticated;
select public.admin_abonnement('00000000-0000-0000-0000-00000000b000', null);
reset role;
select tests.ok(prive.rang_entreprise('00000000-0000-0000-0000-00000000b000') = 1,
  'il la retire : B garde son abonnement Stripe (Textes), auquel il n''a pas touché');
select tests.ok((select count(*) = 2 from prive.journal_admin where entreprise_id = '00000000-0000-0000-0000-00000000b000'),
  'les deux actions sont au journal');
-- Son entreprise à lui : tout ouvert, sans abonnement.
select tests.qui('00000000-0000-0000-0000-0000000000f1', 'axel@test.fr');
set local role authenticated;
select public.creer_entreprise('Entreprise de l''administrateur (essai)');
select tests.ok((select bool_and(rang = 3) from public.mes_entreprises()), 'l''entreprise de l''administrateur est tout ouverte');
reset role;

-- =========================================================================
-- 10. L'espace : réglages, cases « Fait », alertes
-- =========================================================================
select tests.qui('00000000-0000-0000-0000-0000000000a1', 'a_admin@test.fr');
set local role authenticated;
select tests.ok((select (public.espace_lire('00000000-0000-0000-0000-00000000a000') -> 'entreprise' ->> 'denomination') = 'Entreprise A (essai)'
                   and (public.espace_lire('00000000-0000-0000-0000-00000000a000') ->> 'ecrit')::boolean),
  'a_admin lit son espace, et peut y écrire');
select tests.refuse($$select public.espace_lire('00000000-0000-0000-0000-00000000b000')$$, 'mais pas celui de B');
select public.espace_reglages('00000000-0000-0000-0000-00000000a000',
  '{"nom": "Entreprise A bis (essai)", "naf": "43.21A", "effectif": "25", "ville": "Istres",
    "responsable": "Mme Martin", "contexte": ["salaries"], "plus": {"siret": "12345678900011"}}');
select tests.ok((select naf = '43.21A' and effectif = 25 and implantation = 'Istres' and denomination = 'Entreprise A bis (essai)'
                    and reglages ->> 'responsable' = 'Mme Martin' and not reglages ? 'contexte'
                 from public.entreprises where id = '00000000-0000-0000-0000-00000000a000'),
  'les réglages sont enregistrés (colonnes et reste du formulaire)');
select tests.ok((select valeur from public.reponses where entreprise_id = '00000000-0000-0000-0000-00000000a000' and declencheur = 'salaries'),
  'les situations cochées vont dans les réponses');
select tests.ok(tests.compte($$select 1 from public.registre where entreprise_id = '00000000-0000-0000-0000-00000000a000' and genre = 'plan'$$) = 1,
  'le changement de plan est inscrit au registre');
select public.espace_reglages('00000000-0000-0000-0000-00000000a000',
  '{"nom": "Entreprise A bis (essai)", "naf": "43.21A", "effectif": "25", "contexte": ["salaries"]}');
select tests.ok(tests.compte($$select 1 from public.registre where entreprise_id = '00000000-0000-0000-0000-00000000a000' and genre = 'plan'$$) = 1,
  'les mêmes réglages enregistrés deux fois : pas de nouvelle ligne');
select public.espace_reglages('00000000-0000-0000-0000-00000000a000', '{"naf": "43.21A", "contexte": []}');
select tests.ok(not (select valeur from public.reponses where entreprise_id = '00000000-0000-0000-0000-00000000a000' and declencheur = 'salaries'),
  'une situation décochée passe à « non »');
select tests.refuse($$select public.espace_reglages('00000000-0000-0000-0000-00000000a000', '{"naf": "4321A"}')$$, 'un code APE mal formé est refusé');

-- Les cases « Fait ».
select tests.ok(public.espace_fait('00000000-0000-0000-0000-00000000a000', 'plan:t_sst', 'Revue : Santé et sécurité', 't_sst', true) = current_date,
  'cocher « Fait » inscrit une revue datée d''aujourd''hui');
select tests.ok((select sujet_id = 't_sst' and genre = 'revue' and auteur_nom = 'a_admin@test.fr' from public.registre where cle = 'plan:t_sst' order by id desc limit 1),
  'avec son domaine et son auteur');
select tests.ok((public.espace_lire('00000000-0000-0000-0000-00000000a000') -> 'faits' ->> 'plan:t_sst') = current_date::text,
  'la case est cochée à la relecture');
select public.espace_fait('00000000-0000-0000-0000-00000000a000', 'plan:t_sst', 'Revue : Santé et sécurité', 't_sst', false);
select tests.ok((public.espace_lire('00000000-0000-0000-0000-00000000a000') -> 'faits' -> 'plan:t_sst') is null,
  'décocher : la case n''est plus cochée…');
select tests.ok(tests.compte($$select 1 from public.registre where cle = 'plan:t_sst'$$) = 2
                and exists (select 1 from public.registre where cle = 'plan:t_sst' and genre = 'correction' and corrige_id is not null),
  '… et rien n''est effacé : une correction s''ajoute');
select tests.ok(public.espace_fait('00000000-0000-0000-0000-00000000a000', 'jo:JORFARTI000055024139', 'Arrêté d''essai', null, true) is not null,
  'un texte du Journal officiel se coche aussi (sans domaine)');
select tests.refuse($$select public.espace_fait('00000000-0000-0000-0000-00000000a000', 'n''importe quoi', 'x', null, true)$$, 'une clé mal formée est refusée');
select tests.ok((select bool_and(empreinte = prive.empreinte_registre(r)) from public.registre r where cle is not null),
  'les nouvelles entrées portent une empreinte juste');
select tests.ok((select prive.empreinte_registre(r) <> prive.empreinte_registre(jsonb_populate_record(r, '{"cle": "plan:autre"}'))
                 from public.registre r where cle is not null limit 1),
  'et changer la clé changerait l''empreinte');

-- Les alertes : chacun les siennes.
select public.espace_alertes('{"rythme": "hebdomadaire", "courriel": "a_admin@test.fr"}');
select tests.ok((public.espace_lire('00000000-0000-0000-0000-00000000a000') -> 'profil' -> 'alertes' ->> 'rythme') = 'hebdomadaire',
  'les réglages d''alerte sont gardés');
-- Les textes ouverts : chacun les siens.
select public.espace_lus('{"depuis": "2026-10-29T14:00:00Z", "ids": ["jo:JORFTEXT000000000001"]}');
select tests.ok((public.espace_lire('00000000-0000-0000-0000-00000000a000') -> 'profil' -> 'lus' -> 'ids' ->> 0) = 'jo:JORFTEXT000000000001',
  'les textes ouverts sont gardés dans son profil');
select tests.ok((public.espace_lire('00000000-0000-0000-0000-00000000a000') -> 'profil' -> 'alertes' ->> 'rythme') = 'hebdomadaire',
  'sans effacer ses alertes');
select tests.refuse($$select public.espace_lus('{"ids": "pas une liste"}')$$, 'des lectures mal formées sont refusées');
select tests.refuse(format('select public.espace_lus(%L)', jsonb_build_object('ids', (select jsonb_agg(repeat('x', 100)) from generate_series(1, 1000))))::text,
  'et des lectures démesurées aussi');
reset role;

select tests.qui('00000000-0000-0000-0000-0000000000a2', 'a_lecteur@test.fr');
set local role authenticated;
select tests.ok((public.espace_lire('00000000-0000-0000-0000-00000000a000') -> 'profil' -> 'alertes') is null,
  'a_lecteur ne reçoit pas les alertes d''a_admin');
select tests.ok((public.espace_lire('00000000-0000-0000-0000-00000000a000') -> 'profil' -> 'lus') is null,
  'ni ce qu''il a lu');
select tests.refuse($$select public.espace_reglages('00000000-0000-0000-0000-00000000a000', '{"naf": "10"}')$$, 'un lecteur ne change pas les réglages');
select tests.refuse($$select public.espace_fait('00000000-0000-0000-0000-00000000a000', 'plan:t_sst', 'x', 't_sst', true)$$, 'ni ne coche « Fait »');
reset role;

select tests.qui('00000000-0000-0000-0000-0000000000b1', 'b_admin@test.fr');
set local role authenticated;
select tests.refuse($$select public.espace_fait('00000000-0000-0000-0000-00000000b000', 'plan:t_sst', 'x', 't_sst', true)$$,
  'formule Textes : pas de registre, donc pas de case « Fait »');
reset role;

select set_config('request.jwt.claims', '', true);
set local role anon;
select tests.refuse($$select public.espace_lire('00000000-0000-0000-0000-00000000a000')$$, 'un visiteur ne lit aucun espace');
reset role;

-- =========================================================================
-- 11. Qualifier un texte, ouvrir une action, la clore
-- =========================================================================
select tests.qui('00000000-0000-0000-0000-0000000000a1', 'a_admin@test.fr');
set local role authenticated;
select tests.ok(public.espace_qualifier('00000000-0000-0000-0000-00000000a000', 'jo:JORFARTI000000000001', 'Arrêté d''essai', 'a_suivre', null) = current_date,
  'qualifier un texte « à suivre »');
select public.espace_qualifier('00000000-0000-0000-0000-00000000a000', 'jo:JORFARTI000000000001', 'Arrêté d''essai', 'applicable', 'Concerne nos échafaudages.');
select tests.ok((public.espace_lire('00000000-0000-0000-0000-00000000a000') -> 'qualifications' -> 'jo:JORFARTI000000000001' ->> 'statut') = 'applicable',
  'changer d''avis : la dernière qualification fait foi');
select tests.ok(tests.compte($$select 1 from public.registre where cle = 'jo:JORFARTI000000000001' and genre = 'qualification'$$) = 2,
  'et la première reste au registre');
select tests.refuse($$select public.espace_qualifier('00000000-0000-0000-0000-00000000a000', 'jo:X1', 'x', 'peut-etre', null)$$, 'une qualification inconnue est refusée');
select tests.ok(public.espace_action('00000000-0000-0000-0000-00000000a000', 'jo:JORFARTI000000000001', 'Mettre à jour le DUERP',
  current_date + 30, null) is not null, 'ouvrir une action avec son échéance');
select tests.refuse($$select public.espace_action('00000000-0000-0000-0000-00000000a000', 'jo:X1', 'x', null, null)$$, 'une action sans échéance est refusée');
select tests.ok((select json_array_length(public.espace_lire('00000000-0000-0000-0000-00000000a000') -> 'actions')) = 1
                and (public.espace_lire('00000000-0000-0000-0000-00000000a000') -> 'actions' -> 0 ->> 'echeance') = (current_date + 30)::text,
  'elle est dans les actions ouvertes, avec son échéance');
select tests.ok(public.espace_action_faite('00000000-0000-0000-0000-00000000a000',
  (select id from public.registre where genre = 'action' and objet = 'Mettre à jour le DUERP')) = current_date, 'la dire faite');
select tests.ok((select json_array_length(public.espace_lire('00000000-0000-0000-0000-00000000a000') -> 'actions')) = 0,
  'elle n''est plus ouverte');
select tests.refuse($$select public.espace_action_faite('00000000-0000-0000-0000-00000000a000',
  (select id from public.registre where genre = 'action' and objet = 'Mettre à jour le DUERP'))$$, 'on ne la clôt pas deux fois');
select tests.ok(tests.compte($$select 1 from public.registre where genre = 'action' and entreprise_id = '00000000-0000-0000-0000-00000000a000'$$) = 2,
  'l''ouverture et la clôture restent toutes deux au registre');
reset role;

select tests.qui('00000000-0000-0000-0000-0000000000a2', 'a_lecteur@test.fr');
set local role authenticated;
select tests.refuse($$select public.espace_qualifier('00000000-0000-0000-0000-00000000a000', 'jo:X1', 'x', 'applicable', null)$$, 'un lecteur ne qualifie pas');
reset role;
select tests.qui('00000000-0000-0000-0000-0000000000b1', 'b_admin@test.fr');
set local role authenticated;
select tests.refuse($$select public.espace_qualifier('00000000-0000-0000-0000-00000000b000', 'jo:X1', 'x', 'applicable', null)$$, 'formule Textes : pas de qualification');
select tests.refuse($$select public.espace_action_faite('00000000-0000-0000-0000-00000000a000',
  (select max(id) from public.registre))$$, 'ni de clôture chez une autre entreprise');
reset role;

-- =========================================================================
-- 12. L'équipe : voir, inviter, changer un rôle, retirer
-- =========================================================================
select tests.qui('00000000-0000-0000-0000-0000000000a1', 'a_admin@test.fr');
set local role authenticated;
select tests.ok((select (public.espace_membres('00000000-0000-0000-0000-00000000a000') -> 'membres')::text like '%a_lecteur@test.fr%'),
  'l''admin voit les personnes de son entreprise, avec leur adresse');
select set_config('tests.jeton2', public.inviter('collegue@test.fr', 'membre', '00000000-0000-0000-0000-00000000a000'), true);
select tests.ok((select json_array_length(public.espace_membres('00000000-0000-0000-0000-00000000a000') -> 'invitations')) = 1,
  'et l''invitation en attente');
select tests.refuse($$select public.espace_membres('00000000-0000-0000-0000-00000000b000')$$, 'mais pas l''équipe d''une autre entreprise');
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select tests.ok((select (public.invitation_infos(current_setting('tests.jeton2')) ->> 'courriel') = 'collegue@test.fr'
                    and (public.invitation_infos(current_setting('tests.jeton2')) ->> 'valide')::boolean),
  'avec le lien, même sans compte, on sait pour qui est l''invitation');
select tests.ok(public.invitation_infos('faux-jeton') is null, 'un faux lien ne dit rien');
reset role;

select tests.qui('00000000-0000-0000-0000-0000000000a2', 'a_lecteur@test.fr');
set local role authenticated;
select tests.ok((select json_array_length(public.espace_membres('00000000-0000-0000-0000-00000000a000') -> 'invitations')) = 0,
  'un lecteur voit l''équipe, pas les invitations');
select tests.refuse($$select public.inviter('x@test.fr', 'admin', '00000000-0000-0000-0000-00000000a000')$$, 'un lecteur n''invite pas');
select tests.refuse($$select public.espace_role('00000000-0000-0000-0000-00000000a000', '00000000-0000-0000-0000-0000000000a2', 'admin')$$,
  'ni ne se nomme administrateur');
select tests.refuse($$select public.espace_retirer('00000000-0000-0000-0000-00000000a000', '00000000-0000-0000-0000-0000000000a1')$$,
  'ni ne retire quelqu''un');
reset role;

select tests.qui('00000000-0000-0000-0000-0000000000a1', 'a_admin@test.fr');
set local role authenticated;
select public.espace_role('00000000-0000-0000-0000-00000000a000', '00000000-0000-0000-0000-0000000000a2', 'membre');
select tests.ok((select role from public.membres_entreprise where user_id = '00000000-0000-0000-0000-0000000000a2') = 'membre',
  'l''admin fait d''un lecteur un membre');
select tests.refuse($$select public.espace_role('00000000-0000-0000-0000-00000000a000', '00000000-0000-0000-0000-0000000000a1', 'lecteur')$$,
  'le dernier admin ne peut pas se rétrograder');
select tests.refuse($$select public.espace_retirer('00000000-0000-0000-0000-00000000a000', '00000000-0000-0000-0000-0000000000a1')$$,
  'ni partir en laissant l''entreprise sans admin');
select public.annuler_invitation((select id from public.invitations where courriel = 'collegue@test.fr'));
select tests.ok((public.invitation_infos(current_setting('tests.jeton2'))) is null, 'une invitation annulée ne vaut plus rien');
select public.espace_retirer('00000000-0000-0000-0000-00000000a000', '00000000-0000-0000-0000-0000000000a2');
reset role;
select tests.qui('00000000-0000-0000-0000-0000000000a2', 'a_lecteur@test.fr');
set local role authenticated;
select tests.ok(tests.compte($$select 1 from public.mes_entreprises()$$) = 0, 'la personne retirée n''a plus accès à l''entreprise');
reset role;

-- =========================================================================
-- 13. Un cabinet consultant, de bout en bout
-- =========================================================================
select tests.qui('00000000-0000-0000-0000-0000000000e4', 'seul@test.fr');
set local role authenticated;
select set_config('tests.cab', public.creer_cabinet('Cabinet S (essai)')::text, true);
select tests.ok((select count(*) = 1 and bool_and(not actif) from public.mes_cabinets()), 'un consultant crée son cabinet (abonnement pas encore actif)');
select set_config('tests.cli', public.creer_entreprise_cliente(current_setting('tests.cab')::uuid, 'Client S1 (essai)')::text, true);
select tests.ok((select count(*) = 1 and bool_and(role = 'consultant' and rang = 0) from public.mes_acces()
                 where entreprise_id = current_setting('tests.cli')::uuid), 'il crée l''espace d''un client, et y a accès comme consultant');
select tests.ok((select json_array_length(public.cabinet_vue(current_setting('tests.cab')::uuid) -> 'clients')) = 1,
  'son tableau de cabinet liste ce client');
select public.espace_reglages(current_setting('tests.cli')::uuid, '{"naf": "43.21A", "contexte": ["salaries"]}');
select tests.ok((select naf from public.entreprises where id = current_setting('tests.cli')::uuid) = '43.21A',
  'il règle le plan de son client');
select tests.refuse(format('select public.espace_fait(%L, %L, %L, null, true)', current_setting('tests.cli'), 'plan:t_sst', 'x'),
  'sans abonnement du cabinet, pas de registre chez le client');
reset role;

select tests.qui('00000000-0000-0000-0000-0000000000a1', 'a_admin@test.fr');
set local role authenticated;
select tests.refuse(format('select public.cabinet_vue(%L)', current_setting('tests.cab')), 'une entreprise ne voit pas le tableau d''un cabinet');
select tests.ok(tests.compte(format('select 1 from public.mes_acces() where entreprise_id = %L', current_setting('tests.cli'))) = 0,
  'ni l''espace de ses clients');
select tests.refuse(format('select public.admin_abonnement_cabinet(%L, true)', current_setting('tests.cab')), 'ni ne s''ouvre un abonnement de cabinet');
reset role;

select tests.qui('00000000-0000-0000-0000-0000000000f1', 'axel@test.fr');
set local role authenticated;
select public.admin_abonnement_cabinet(current_setting('tests.cab')::uuid, true);
select tests.ok((public.admin_vue() -> 'cabinets')::text like '%Cabinet S (essai)%', 'l''administrateur voit le cabinet');
reset role;
select tests.ok(prive.rang_entreprise(current_setting('tests.cli')::uuid) = 3, 'abonnement du cabinet ouvert : son client a la formule complète');

select tests.qui('00000000-0000-0000-0000-0000000000e4', 'seul@test.fr');
set local role authenticated;
select tests.ok(public.espace_fait(current_setting('tests.cli')::uuid, 'plan:t_sst', 'Revue (essai)', 't_sst', true) is not null,
  'le consultant coche une revue chez son client');
select set_config('tests.jeton3', public.inviter('neuf@test.fr', 'admin', current_setting('tests.cli')::uuid), true);
reset role;

select tests.qui('00000000-0000-0000-0000-0000000000e3', 'neuf@test.fr');
set local role authenticated;
select public.accepter_invitation(current_setting('tests.jeton3'));
select tests.ok((public.mon_consultant(current_setting('tests.cli')::uuid) ->> 'nom') = 'Cabinet S (essai)', 'le client invité voit qui est son consultant');
select public.espace_acces_consultant(current_setting('tests.cli')::uuid, false);
reset role;

select tests.qui('00000000-0000-0000-0000-0000000000e4', 'seul@test.fr');
set local role authenticated;
select tests.ok(tests.compte(format('select 1 from public.mes_acces() where entreprise_id = %L', current_setting('tests.cli'))) = 0,
  'le client coupe l''accès : le consultant n''entre plus');
select tests.refuse(format('select public.espace_lire(%L)', current_setting('tests.cli')), 'et ne lit plus rien');
select tests.ok((select (c ->> 'acces')::boolean = false and json_typeof(c -> 'actions_ouvertes') = 'null'
                 from json_array_elements(public.cabinet_vue(current_setting('tests.cab')::uuid) -> 'clients') c),
  'son tableau garde le client, sans aucun chiffre');
reset role;
select tests.ok(tests.compte(format('select 1 from public.registre where entreprise_id = %L and auteur_nom = %L', current_setting('tests.cli'), 'seul@test.fr')) = 1,
  'ce qu''il a fait reste au registre du client, à son nom');

-- ---------------------------------------------------------------------------
-- 14. Revue de sécurité du 31 octobre 2026
-- ---------------------------------------------------------------------------
-- Un admin d'entreprise ne se rattache pas, seul, au cabinet abonné d'un autre.
select tests.qui('00000000-0000-0000-0000-0000000000b1', 'b_admin@test.fr');
set local role authenticated;
select tests.refuse(format('select public.choisir_consultant(%L, %L)', '00000000-0000-0000-0000-00000000b000', current_setting('tests.cab')),
  'une entreprise ne se rattache pas seule à un cabinet (elle aurait sa veille complète à ses frais)');
select tests.ok(prive.rang_entreprise('00000000-0000-0000-0000-00000000b000') < 3 or exists (
    select 1 from public.abonnements a where a.entreprise_id = '00000000-0000-0000-0000-00000000b000' and a.formule = 'complet'),
  'et son rang ne vient pas de l''abonnement du cabinet');
reset role;
-- Le client, lui, peut toujours se détacher de son cabinet.
select tests.qui('00000000-0000-0000-0000-0000000000e3', 'neuf@test.fr');
set local role authenticated;
select public.choisir_consultant(current_setting('tests.cli')::uuid, null);
select tests.ok((select consultant_id is null from public.entreprises where id = current_setting('tests.cli')::uuid),
  'le client peut se détacher de son cabinet');
reset role;
-- Les réglages personnels d'un membre ne se lisent pas par ses collègues.
select tests.qui('00000000-0000-0000-0000-0000000000a2', 'a_lecteur@test.fr');
set local role authenticated;
select tests.ok(tests.compte('select 1 from public.profils where id <> auth.uid()') = 0,
  'un collègue ne lit pas le profil (adresse d''alerte, textes ouverts) d''un autre');
select tests.ok(tests.compte('select 1 from public.collectes') = 0, 'le journal du robot n''est pas lisible par un client');
reset role;
set local role anon;
select tests.refuse('select count(*) from public.collectes', 'ni par un visiteur non connecté');
reset role;

do $$ begin raise notice 'TOUS LES TESTS D''ISOLATION SONT PASSÉS'; end $$;

rollback;
