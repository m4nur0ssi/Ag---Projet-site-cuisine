#!/bin/bash
#
# Envoie en production les photos déposées dans public/recipes-ia.
# =================================================================
#
# Les photos des recettes ne viennent PLUS de WordPress : le site les sert
# depuis le dépôt Git (voir sync-recipes.js — un fichier local l'emporte
# toujours sur l'image à la une). Les retoucher ne suffit donc pas ; il faut
# les commiter. Rien ne le fait tout seul : la synchro WordPress ne touche que
# `mockData.ts`, et le pipeline TikTok que sa file d'attente.
#
# Deux fichiers par recette : `<id>-carte.webp` (760 px, l'accueil) et
# `<id>.webp` (1200 px, la fiche). Ne remplacer que le premier laisse la fiche
# sur l'ancienne photo — le script prévient quand un des deux manque.
#
#   npm run photos:push
#
set -e
cd "$(dirname "$0")/.."

MODIFIEES=$(git status --porcelain -- public/recipes-ia | wc -l | tr -d ' ')
if [ "$MODIFIEES" = "0" ]; then
    echo "Aucune photo modifiée dans public/recipes-ia — rien à envoyer."
    exit 0
fi

echo "📸 $MODIFIEES fichier(s) à envoyer :"
git status --short -- public/recipes-ia | sed 's/^/   /'
echo

# Une photo de carte sans sa grande version : la fiche garderait l'ancienne.
for f in $(git status --porcelain -- public/recipes-ia | awk '{print $2}'); do
    base=$(basename "$f" .webp)
    id=${base%-carte}
    if [ "$base" != "$id" ] && ! git status --porcelain -- "public/recipes-ia/$id.webp" | grep -q .; then
        echo "⚠️  $id : la vignette change mais pas $id.webp — la fiche gardera l'ancienne photo."
    fi
done

# Le dépôt a pu avancer entre-temps (bot WordPress, pipeline TikTok).
echo "🔄 Récupération du dépôt…"
git fetch origin --quiet
git merge --ff-only origin/main 2>/dev/null || echo "   (rien à récupérer, ou fusion impossible — on continue)"

git add public/recipes-ia
git commit -q -m "feat(photos): $MODIFIEES fichier(s) retouché(s) en production"
git push origin main
echo
echo "✅ Envoyé. Vercel déploie dans la minute qui vient."
