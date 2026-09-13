#!/usr/bin/env bash
#
# Faut-il construire ce commit ?
# ==============================
#
# Vercel garde CHAQUE déploiement, build compris, et ne les efface jamais : le
# quota « Deployment Storage » additionne tout depuis le premier jour. Or 4
# commits sur 10 ne changent rien à ce que voit un visiteur — la file du bot
# TikTok, un script d'atelier, une note. Chacun déclenchait pourtant un
# déploiement complet, stocké à vie.
#
# Convention Vercel, contre-intuitive : sortir en 0 SAUTE le build, sortir en 1
# le LANCE. Au moindre doute, on sort en 1 : un déploiement de trop ne coûte que
# du stockage, un déploiement manquant laisse le site en arrière.
#
# Ce qui NE déclenche pas de build : la file et le code du bot, le plugin
# WordPress, l'extension Chrome, les workflows GitHub, la documentation.
# Tout le reste construit — `scripts/` compris : `build-home-data.js` fabrique
# les données de l'accueil à chaque build, le toucher change le site.
set -u

precedent() { git rev-parse --verify HEAD^ >/dev/null 2>&1; }

# Chez Vercel le dépôt arrive en clone superficiel : le commit précédent peut
# manquer. On le réclame, et faute de mieux on construit.
if ! precedent; then
    git fetch --depth=2 origin "${VERCEL_GIT_COMMIT_REF:-main}" >/dev/null 2>&1 || true
fi
if ! precedent; then
    echo "Historique trop court pour comparer — on construit."
    exit 1
fi

# Une FUSION rassemble plusieurs commits : la comparer à son seul premier
# parent ne dit rien de ce que l'autre branche apportait. C'est ce qui a fait
# sauter le déploiement du 13 septembre — le correctif de la liste de courses
# est resté à quai parce que la fusion, elle, ne touchait que la file du bot.
if git rev-parse --verify HEAD^2 >/dev/null 2>&1; then
    echo "Commit de fusion — on construit."
    exit 1
fi

# Quand Vercel nous dit ce qui était déployé avant, on compare à ÇA : un envoi
# de plusieurs commits d'un coup n'échappe pas au contrôle.
base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -n "$base" ] && ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
    git fetch --depth=50 origin "$base" >/dev/null 2>&1 || true
fi
if [ -n "$base" ] && git cat-file -e "${base}^{commit}" 2>/dev/null; then
    plage="${base}..HEAD"
else
    plage="HEAD^ HEAD"
fi

fichiers=$(git diff --name-only $plage)
if [ -z "$fichiers" ]; then
    echo "Commit sans fichier modifié — on construit."
    exit 1
fi

# Un seul fichier hors de cette liste suffit à justifier le déploiement.
hors_site='^(tiktok-bot/|wordpress-plugin/|chrome-extension-courses/|\.github/|docs/|[^/]*\.md$|[^/]*\.command$|[^/]*\.bat$)'
if echo "$fichiers" | grep -qvE "$hors_site"; then
    echo "Le site est touché — on construit."
    exit 1
fi

echo "Rien qui change le site (bot, plugin, extension, doc) — déploiement sauté."
exit 0
