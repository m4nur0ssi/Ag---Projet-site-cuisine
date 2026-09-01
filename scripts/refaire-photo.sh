#!/bin/bash
#
# Refaire la photo d'une recette, et l'envoyer partout.
# =====================================================
#
# Trois gestes en un :
#
#   1. RÉGÉNÉRER — la vidéo TikTok est retéléchargée, l'IA regarde les quatre
#      premières secondes (l'accroche montre presque toujours le plat fini) puis
#      la fin, décrit le plat, et fabrique la photo. Deux tailles en sortent :
#      1200 px pour la fiche, 760 px pour les cartes de l'accueil.
#   2. WORDPRESS — la grande version part en image à la une du billet.
#   3. VERCEL — les deux fichiers sont commités et poussés ; c'est CE chemin-là
#      qui décide de ce que le site affiche (voir sync-recipes.js : un fichier
#      local l'emporte toujours sur l'image à la une).
#
# Usage :
#   bash scripts/refaire-photo.sh 7402
#   bash scripts/refaire-photo.sh 7402 7398        (plusieurs d'un coup)
#   bash scripts/refaire-photo.sh                  (demande les identifiants)
#
# L'ancienne photo est copiée sur le Bureau, dans
# « anciennes-photos-recettes/remplacees », avant d'être écrasée.
#
set -e
cd "$(dirname "$0")/.."
PROJET="$PWD"

IDS="$*"
if [ -z "$IDS" ]; then
    echo "Identifiant(s) de recette à refaire (séparés par un espace) :"
    read -r IDS
fi
[ -z "$IDS" ] && { echo "Rien à faire."; exit 0; }

LISTE=$(echo "$IDS" | tr ' ' ',')

echo "🎬 1/3 — Régénération de la photo ($LISTE)…"
node scripts/generate-recipe-images.js --ids "$LISTE" --force

# ── 2. WordPress ─────────────────────────────────────────────────────────────
# `auto-upload-wp.js` fonctionne par DOSSIER : il rapproche le nom du fichier du
# titre de la recette. On lui prépare donc une copie nommée d'après le titre.
DEPOT="$HOME/Downloads/wordpress"
mkdir -p "$DEPOT"
ENVOYES=0
for id in $IDS; do
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
    [ -z "$TITRE" ] && { echo "   ⚠️  $id : recette introuvable, on passe."; continue; }
    cp "$GRANDE" "$DEPOT/$TITRE.webp"
    ENVOYES=$((ENVOYES+1))
done

if [ "$ENVOYES" -gt 0 ]; then
    echo
    echo "📤 2/3 — Envoi vers WordPress…"
    # L'adresse publique du NAS : hors réseau local, l'adresse interne ne répond pas.
    export WP_XMLRPC_URL="${WP_XMLRPC_URL:-http://109.221.250.122/wordpress/xmlrpc.php}"
    if ! node auto-upload-wp.js; then
        echo
        echo "   ⚠️  WordPress a refusé la photo. Causes possibles, dans l'ordre :"
        echo "      • identifiants périmés dans .env.local (WP_USERNAME / WP_PASSWORD)."
        echo "        Vérifie : node scripts/verifier-wordpress.js"
        echo "      • NAS éteint, ou son adresse publique a changé (WP_XMLRPC_URL)."
        echo "   Sans conséquence pour le site : c'est le dépôt Git qui décide de"
        echo "   la photo affichée. On continue."
    fi
fi

# ── 3. Vercel ────────────────────────────────────────────────────────────────
echo
echo "🚀 3/3 — Envoi vers le site…"
cd "$PROJET"
bash scripts/pousser-photos.sh

echo
echo "✅ Terminé pour : $IDS"
