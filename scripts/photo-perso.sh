#!/bin/bash
#
# Poser TA photo sur une recette, puis tout envoyer.
# ==================================================
#
# À utiliser quand la photo vient d'ailleurs : ChatGPT, un appareil photo, une
# retouche. Si tu veux au contraire la refaire automatiquement d'après la
# vidéo TikTok, c'est l'autre script :
#
#     npm run photo:refaire
#
# Le déroulé
# ----------
#   1. tu donnes la recette — son NUMÉRO (7467) ou son NOM (« Escalope à la
#      milanaise »), accents et majuscules indifférents ;
#   2. tu donnes le fichier image. Tu peux le GLISSER depuis le Finder dans le
#      Terminal : le chemin s'écrit tout seul ;
#   3. l'image est recadrée au centre en 3:4 (le format du site) puis écrite en
#      DEUX tailles : 1200 px pour la fiche, 760 px pour les cartes ;
#   4. on demande s'il y en a une autre. Tant que tu réponds, on recommence ;
#   5. quand c'est fini, TOUT part ensemble : WordPress, puis le site.
#
# L'envoi n'a lieu qu'à la fin : tu peux remplacer cinq photos et ne déclencher
# qu'un seul déploiement.
#
# L'ancienne photo est copiée sur le Bureau, dans
# « anciennes-photos-recettes/remplacees », avant d'être écrasée.
#
# Le cas « j'ai déjà tout fait à la main »
# ----------------------------------------
# Si tu as déjà déposé toi-même les deux .webp dans public/recipes-ia, lance ce
# script SANS donner d'image (Entrée seule à la question du fichier) : il saute
# la conversion et se contente d'envoyer.
#
#   bash scripts/photo-perso.sh                                  (conversation)
#   bash scripts/photo-perso.sh 7467                             (recette fournie)
#   bash scripts/photo-perso.sh 7467 ~/Downloads/escalope.png    (tout fourni)
#   bash scripts/photo-perso.sh "Escalope à la milanaise" ~/Downloads/esc.png
#
set -e
cd "$(dirname "$0")/.."
PROJET="$PWD"

TRAITEES=""     # identifiants dont la photo a changé

# Nettoie un chemin glissé depuis le Finder : le Terminal ajoute des guillemets
# et échappe les espaces par des antislashs. Sans ça, « Mon dossier/photo.png »
# arrive en deux morceaux et le fichier paraît introuvable.
nettoyer_chemin() {
    printf '%s' "$1" | sed -e "s/^['\"]//" -e "s/['\"]$//" -e 's/\\ / /g' -e 's/[[:space:]]*$//'
}

# Résout une saisie (numéro ou nom) vers UN identifiant, écrit sur la sortie
# standard. Renvoie 1 si c'est introuvable ou ambigu — on veut le savoir AVANT
# de réclamer un fichier image.
resoudre() {
    local saisie="$1"
    local ids
    if ! ids=$(node scripts/trouver-recette.js "$saisie"); then
        return 1     # le résolveur a déjà expliqué pourquoi
    fi
    # Une image pour plusieurs recettes n'a pas de sens : on refuse.
    local nb
    nb=$(echo "$ids" | wc -w | tr -d ' ')
    if [ "$nb" != "1" ]; then
        echo "   ⚠️  « $saisie » désigne $nb recettes ($ids)." >&2
        echo "      Donne un numéro précis : une photo ne vaut que pour une recette." >&2
        return 1
    fi
    printf '%s' "$ids"
}

# Pose une image sur une recette DÉJÀ résolue. Renvoie 1 si on n'a rien pu faire.
poser() {
    local ids="$1"
    local image="$2"

    if [ -z "$image" ]; then
        # Pas d'image à convertir : on prétend envoyer ce qui est déjà là. Encore
        # faut-il que quelque chose ait VRAIMENT changé.
        #
        # La première version se contentait de vérifier que les deux fichiers
        # EXISTAIENT — ce qui est vrai de toutes les recettes du catalogue. Elle
        # annonçait donc « on les enverra tels quels », puis l'envoi vers le site
        # répondait « aucune photo modifiée, rien à envoyer » : deux messages
        # contradictoires dans la même exécution, et l'impression que le script
        # n'avait traité qu'une image sur deux.
        local manquants=""
        [ -f "public/recipes-ia/$ids.webp" ] || manquants="$manquants $ids.webp"
        [ -f "public/recipes-ia/$ids-carte.webp" ] || manquants="$manquants $ids-carte.webp"
        if [ -n "$manquants" ]; then
            echo "   ⚠️  Fichier(s) absent(s) de public/recipes-ia :$manquants"
            echo "      Donne une image à convertir, ou dépose les deux .webp toi-même."
            return 1
        fi

        # git est le seul juge : c'est lui qui décide de ce qui partira.
        local change
        change=$(git status --porcelain -- \
            "public/recipes-ia/$ids.webp" "public/recipes-ia/$ids-carte.webp" | wc -l | tr -d ' ')
        if [ "$change" = "0" ]; then
            echo "   ⚠️  Les deux fichiers existent, mais AUCUN n'a été modifié."
            echo "      La photo en ligne est déjà celle qui est sur ce disque :"
            echo "      il n'y a rien à envoyer, et rien ne changerait sur le site."
            echo
            echo "      Si tu voulais poser une nouvelle photo, relance et GLISSE"
            echo "      le fichier image quand la question est posée."
            return 1
        fi
        echo "   ✔ $change fichier(s) modifié(s) à la main, on les enverra tels quels."
        TRAITEES="$TRAITEES $ids"
        return 0
    fi

    if [ ! -f "$image" ]; then
        echo "   ⚠️  Image introuvable : $image"
        return 1
    fi

    echo "🖼  Conversion pour la recette $ids…"
    node scripts/convertir-photo.js "$ids" "$image"

    # Ceinture et bretelles : on RELIT les deux fichiers et on montre leurs
    # dimensions. Une photo de carte sans sa grande version laisse la fiche sur
    # l'ancienne image — le genre de panne qui ne se voit qu'une fois en ligne.
    if ! node scripts/verifier-paire-photo.js "$ids"; then
        echo "   ⚠️  La paire est incomplète : on n'enverra pas cette recette."
        return 1
    fi

    TRAITEES="$TRAITEES $ids"
    return 0
}

# Demande une recette puis son image, et pose. Renvoie 1 si l'utilisateur a
# renoncé (Entrée seule sur la recette).
demander_et_poser() {
    local invite="$1"
    local recette image ids
    echo
    echo "$invite"
    printf "→ "
    read -r recette
    [ -z "$recette" ] && return 1

    # On résout AVANT de réclamer un fichier : réclamer une image pour une
    # recette qui n'existe pas fait perdre deux questions à l'utilisateur.
    if ! ids=$(resoudre "$recette"); then
        return 0     # on ne s'arrête pas : la boucle reposera la question
    fi

    echo
    echo "Quelle image ? Glisse le fichier ici depuis le Finder."
    printf "→ "
    read -r image
    image=$(nettoyer_chemin "$image")

    # Entrée seule était trop facile à taper par réflexe, et menait au chemin
    # « les fichiers sont déjà en place » sans qu'on l'ait voulu. On redemande
    # une fois, en disant ce que le silence signifie.
    if [ -z "$image" ]; then
        echo
        echo "   Aucune image donnée."
        echo "   • Pour en poser une : glisse le fichier maintenant."
        echo "   • Si tu as DÉJÀ remplacé les deux .webp toi-même dans"
        echo "     public/recipes-ia : appuie simplement sur Entrée."
        printf "→ "
        read -r image
        image=$(nettoyer_chemin "$image")
    fi

    poser "$ids" "$image" || true
    return 0
}

# ── Premier passage : arguments, ou conversation ─────────────────────────────
RECETTE="$1"
IMAGE=$(nettoyer_chemin "${2:-}")

if [ -n "$RECETTE" ]; then
    if [ -z "$IMAGE" ] && [ -n "$2" ]; then
        echo "⚠️  Le chemin d'image fourni est vide après nettoyage."
    fi
    if ID=$(resoudre "$RECETTE"); then
        poser "$ID" "$IMAGE" || true
    fi
else
    demander_et_poser "Quelle recette ? Son numéro (7467) ou son nom (Escalope à la milanaise)." || {
        echo "Rien à faire."
        exit 0
    }
fi

# ── Encore une ? ─────────────────────────────────────────────────────────────
while true; do
    demander_et_poser "Une autre photo à remplacer ? Numéro ou nom.
(Entrée seule = c'est fini, on envoie tout)" || break
done

# On enlève les espaces en trop, et on écarte les doublons.
TRAITEES=$(echo "$TRAITEES" | tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' ')
if [ -z "$(echo "$TRAITEES" | tr -d ' ')" ]; then
    echo
    echo "Aucune photo posée — rien à envoyer."
    exit 0
fi

echo
echo "════════════════════════════════════════════"
echo "Photos remplacées :$TRAITEES"
echo "════════════════════════════════════════════"

# ── WordPress ────────────────────────────────────────────────────────────────
# Envoi PAR IDENTIFIANT : l'id d'une recette EST l'id de son post WordPress.
# `--force` parce qu'ici on remplace sciemment une image à la une qui existe.
echo
echo "📤 Envoi vers WordPress…"
if ! node scripts/pousser-photo-wp.js --ids "$(echo "$TRAITEES" | tr ' ' ',' | sed 's/,$//')" --force; then
    echo
    echo "   ⚠️  WordPress a refusé. Causes possibles, dans l'ordre :"
    echo "      • identifiants périmés dans .env.local (WP_USERNAME / WP_PASSWORD)"
    echo "        → vérifie avec : npm run wp:verifier"
    echo "      • NAS éteint, ou son adresse publique a changé"
    echo "   Sans conséquence pour le site : c'est le dépôt Git qui décide"
    echo "   de la photo affichée. On continue."
fi

# ── Le site ──────────────────────────────────────────────────────────────────
echo
echo "🚀 Envoi vers le site…"
cd "$PROJET"
bash scripts/pousser-photos.sh

echo
echo "✅ Terminé pour :$TRAITEES"
