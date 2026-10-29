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
--   inconnu : un compte sans rien ; neuf : un compte qui vient d'être créé ; axel : l'administrateur du service
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

do $$ begin raise notice 'TOUS LES TESTS D''ISOLATION SONT PASSÉS'; end $$;

rollback;
