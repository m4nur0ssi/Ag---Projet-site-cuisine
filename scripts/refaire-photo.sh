#!/bin/bash
#
# Refaire la photo d'une ou plusieurs recettes, puis tout envoyer d'un coup.
# =========================================================================
#
# Le déroulé :
#
#   1. on donne une recette — son NUMÉRO (7402) ou son NOM (« Chèvre rôti au
#      miel »), accents et majuscules indifférents ;
#   2. la vidéo TikTok est retéléchargée, l'IA regarde les quatre premières
#      secondes puis la fin, et fabrique la photo en 1200 px (la fiche) et
#      760 px (les cartes de l'accueil) ;
#   3. on demande s'il y en a une autre. Tant qu'on répond, on recommence ;
#   4. quand c'est fini, TOUT part ensemble : les grandes versions sur
#      WordPress, les deux tailles sur le site.
#
# L'envoi n'a lieu qu'à la fin : on peut refaire cinq photos et ne déclencher
# qu'un seul déploiement.
#
# L'ancienne photo est copiée sur le Bureau, dans
# « anciennes-photos-recettes/remplacees », avant d'être écrasée.
#
#   bash scripts/refaire-photo.sh                     (mode conversation)
#   bash scripts/refaire-photo.sh 7402                (première recette fournie)
#   bash scripts/refaire-photo.sh "Chèvre rôti au miel"
#
set -e
cd "$(dirname "$0")/.."
PROJET="$PWD"

TRAITEES=""     # identifiants dont la photo a été refaite

# Résout une saisie (numéro(s) ou nom) puis régénère. Renvoie 1 si rien fait.
generer() {
    local saisie="$1"
    local ids
    if ! ids=$(node scripts/trouver-recette.js "$saisie"); then
        return 1     # le résolveur a déjà expliqué pourquoi
    fi
    local liste
    liste=$(echo "$ids" | tr ' ' ',')
    echo "🎬 Régénération de la photo…"
    node scripts/generate-recipe-images.js --ids "$liste" --force
    TRAITEES="$TRAITEES $ids"
    return 0
}

# ── Première recette : en argument, ou demandée ──────────────────────────────
PREMIERE="$*"
if [ -z "$PREMIERE" ]; then
    echo "Quelle recette ? Son numéro (7402) ou son nom (Chèvre rôti au miel)."
    printf "→ "
    read -r PREMIERE
fi
[ -z "$PREMIERE" ] && { echo "Rien à faire."; exit 0; }

generer "$PREMIERE" || true

# ── Encore une ? ─────────────────────────────────────────────────────────────
while true; do
    echo
    echo "Une autre photo à refaire ? Donne le nom ou le numéro."
    echo "(Entrée seule = c'est fini, on envoie tout)"
    printf "→ "
    read -r SUITE
    [ -z "$SUITE" ] && break
    generer "$SUITE" || true
done

# On enlève les espaces en trop, et on écarte les doublons.
TRAITEES=$(echo "$TRAITEES" | tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' ')
if [ -z "$(echo "$TRAITEES" | tr -d ' ')" ]; then
    echo
    echo "Aucune photo refaite — rien à envoyer."
    exit 0
fi

echo
echo "════════════════════════════════════════════"
echo "Photos refaites :$TRAITEES"
echo "════════════════════════════════════════════"

# ── WordPress ────────────────────────────────────────────────────────────────
# `auto-upload-wp.js` travaille par DOSSIER : il rapproche le nom du fichier du
# titre de la recette. On lui prépare donc une copie nommée d'après le titre.
DEPOT="$HOME/Downloads/wordpress"
mkdir -p "$DEPOT"
PREPARES=0
for id in $TRAITEES; do
    GRANDE="public/recipes-ia/$id.webp"
    [ -f "$GRANDE" ] || { echo "   ⚠️  $id : pas de photo générée, on passe."; continue; }
    TITRE=$(node -e "
        const fs=require('fs');
        const s=fs.readFileSync('src/data/mockData.ts','utf8');
        const d=s.indexOf('= [', s.indexOf('mockRecipes'))+2;
        const rs=JSON.parse(s.slice(d, s.lastIndexOf('];')+1));
        const r=rs.find(x=>String(x.id)==='$id');
        process.stdout.write(r ? r.title.replace(/[\/:]/g,' ') : '');
    ")
    [ -z "$TITRE" ] && continue
    cp "$GRANDE" "$DEPOT/$TITRE.webp"
    PREPARES=$((PREPARES+1))
done

if [ "$PREPARES" -gt 0 ]; then
    echo
    echo "📤 Envoi vers WordPress ($PREPARES photo(s))…"
    export WP_XMLRPC_URL="${WP_XMLRPC_URL:-http://109.221.250.122/wordpress/xmlrpc.php}"
    if ! node auto-upload-wp.js; then
        echo
        echo "   ⚠️  WordPress a refusé. Causes possibles, dans l'ordre :"
        echo "      • identifiants périmés dans .env.local (WP_USERNAME / WP_PASSWORD)"
        echo "        → vérifie avec : npm run wp:verifier"
        echo "      • NAS éteint, ou son adresse publique a changé"
        echo "   Sans conséquence pour le site : c'est le dépôt Git qui décide"
        echo "   de la photo affichée. On continue."
    fi
fi

# ── Le site ──────────────────────────────────────────────────────────────────
echo
echo "🚀 Envoi vers le site…"
cd "$PROJET"
bash scripts/pousser-photos.sh

echo
echo "✅ Terminé pour :$TRAITEES"
