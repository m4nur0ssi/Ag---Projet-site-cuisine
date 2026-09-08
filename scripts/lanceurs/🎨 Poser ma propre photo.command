#!/bin/bash
#
# Double-clique-moi.
#
# Je pose TA photo sur une recette — celle que ChatGPT t'a faite, une photo
# d'appareil, une retouche. Si tu veux au contraire la refaire automatiquement
# d'après la vidéo TikTok, c'est l'autre fichier :
#
#     🖼️ Refaire une photo de recette.command
#
# Comment ça se passe
# -------------------
#   1. je demande la recette — son NUMÉRO (7467) ou son NOM (« Escalope à la
#      milanaise »), les accents et les majuscules n'ont pas d'importance ;
#   2. je demande l'image. GLISSE le fichier depuis le Finder dans la fenêtre :
#      le chemin s'écrit tout seul, tu n'as rien à taper ;
#   3. je la recadre au centre au format du site (3:4, portrait) et j'en écris
#      les DEUX tailles : la grande pour la fiche, la petite pour les cartes ;
#   4. je demande s'il y en a une autre. Tant que tu réponds, on continue.
#
# Quand tu appuies simplement sur Entrée, TOUT part d'un coup : WordPress et le
# site. Rien n'est envoyé avant la fin — tu peux remplacer cinq photos et ne
# déclencher qu'un seul déploiement.
#
# Si tu as déjà déposé toi-même les deux fichiers .webp dans le projet, réponds
# Entrée à la question de l'image : je saute la conversion et j'envoie tel quel.
#
# L'ancienne photo est mise de côté sur le Bureau, dans
# « anciennes-photos-recettes/remplacees », avant d'être remplacée.
#
cd "/Users/manu/CloudStation/Anti Gravity/Ag - Projet site cuisine" || {
    echo "Projet introuvable."; read -n1; exit 1;
}

echo "🎨  Poser ma propre photo sur une recette"
echo
echo "    Astuce : pour donner l'image, glisse-la depuis le Finder"
echo "    directement dans cette fenêtre."
echo

bash scripts/photo-perso.sh
status=$?

echo
if [ $status -eq 0 ]; then
    echo "✅ Fini. Vercel déploie dans la minute."
else
    echo "❌ Erreur (code $status)."
fi
echo "   (Appuie sur une touche pour fermer)"
read -n 1 -s
