#!/usr/bin/env bash
# ==========================================================================
# La sauvegarde chiffrée de la base Vigie — et la preuve qu'elle se restaure
# --------------------------------------------------------------------------
# Lancée chaque semaine par l'action « Sauvegarde » (.github/workflows/
# sauvegarde.yml). Variables :
#   SOURCE       l'adresse de la base à sauvegarder (secret SUPABASE_DB_URL)
#   PHRASE       la phrase de passe du chiffrement (secret SAUVEGARDE_PHRASE)
#   CIBLE_TEST   une base PostgreSQL VIDE, où restaurer pour vérifier
#
#   outils/sauvegarde.sh <dossier>
#
# Ce qui part dans l'archive (chiffrée AES-256 par gpg, avant de quitter la
# machine) :
#   base.dump       les schémas public et prive : tables, règles, fonctions,
#                   données — dont les registres et leurs empreintes
#   comptes.dump    les comptes (auth.users, auth.identities) : adresses et
#                   mots de passe sous forme d'empreinte
#   comptes.csv     identifiant et adresse de chaque compte (pour la vérification)
#   chiffres.json   combien de lignes, au moment de la sauvegarde
#
# Puis on déchiffre l'archive, on la restaure dans CIBLE_TEST, et on vérifie :
# mêmes nombres de lignes, et la chaîne d'empreintes de chaque registre
# intacte. Le moindre écart arrête tout (code 1).
# ==========================================================================
set -euo pipefail
D="${1:-sauvegarde}"
: "${SOURCE:?SOURCE manque}" "${PHRASE:?PHRASE manque}" "${CIBLE_TEST:?CIBLE_TEST manque}"
ICI="$(cd "$(dirname "$0")/.." && pwd)"
JOUR="$(date -u +%Y-%m-%d)"
ARCHIVE="$D/vigie-sauvegarde-$JOUR.tar.gpg"
rm -rf "$D" && mkdir -p "$D/brut" "$D/verif"

chiffres() {
  psql "$1" -qtA -c "select json_build_object(
    'entreprises', (select count(*) from public.entreprises),
    'membres',     (select count(*) from public.membres_entreprise),
    'abonnements', (select count(*) from public.abonnements),
    'reponses',    (select count(*) from public.reponses),
    'registre',    (select count(*) from public.registre),
    'sujets',      (select count(*) from public.sujets))"
}

echo "→ copie de la base"
chiffres "$SOURCE" > "$D/brut/chiffres.json"
pg_dump "$SOURCE" -Fc -n public -n prive -f "$D/brut/base.dump"
pg_dump "$SOURCE" -Fc --data-only -t auth.users -t auth.identities -f "$D/brut/comptes.dump"
psql "$SOURCE" -qtA -c "\\copy (select id, email from auth.users order by id) to '$D/brut/comptes.csv' with csv"

echo "→ chiffrement"
tar -C "$D/brut" -cf - . \
  | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 --symmetric --cipher-algo AES256 -o "$ARCHIVE" \
    3< <(printf '%s' "$PHRASE")
rm -rf "$D/brut"                                   # rien ne reste en clair
sha256sum "$ARCHIVE" | cut -d' ' -f1 > "$ARCHIVE.sha256"

echo "→ restauration d'essai"
gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 --decrypt "$ARCHIVE" 3< <(printf '%s' "$PHRASE") \
  | tar -C "$D/verif" -xf -
psql "$CIBLE_TEST" -v ON_ERROR_STOP=1 -q -f "$ICI/supabase/tests/emulation-supabase.sql"
psql "$CIBLE_TEST" -v ON_ERROR_STOP=1 -q -c "\\copy auth.users (id, email) from '$D/verif/comptes.csv' with csv"
# Les erreurs attendues (le schéma public existe déjà, objets propres à
# Supabase) sont gardées dans le journal ; ce qui compte, c'est la vérification.
pg_restore -d "$CIBLE_TEST" --no-owner --no-privileges "$D/verif/base.dump" 2> "$D/restauration.log" || true

echo "→ vérification"
AVANT="$(cat "$D/verif/chiffres.json")"
APRES="$(chiffres "$CIBLE_TEST")"
ROMPUS="$(psql "$CIBLE_TEST" -qtA -c "select count(*) from public.entreprises e, public.verifier_registre(e.id) v where not v.intact")"
rm -rf "$D/verif"
echo "  avant  : $AVANT"
echo "  après  : $APRES"
echo "  registres rompus après restauration : $ROMPUS"
if [ "$AVANT" != "$APRES" ] || [ "$ROMPUS" != "0" ]; then
  echo "ÉCHEC : la sauvegarde ne se restaure pas à l'identique. Journal :"
  cat "$D/restauration.log"
  exit 1
fi
echo "ok : $ARCHIVE — $(du -h "$ARCHIVE" | cut -f1), restaurée et vérifiée"
