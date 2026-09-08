#!/bin/bash
#
# Double-clique-moi.
#
# Je REGARDE LA VIDÉO TikTok de la recette — ses 4 premières et ses 4
# dernières secondes, là où l'assiette finie apparaît — et je refais la photo
# d'après ce que j'y vois.
#
# Si tu veux au contraire poser TA propre photo (ChatGPT, un appareil photo),
# c'est l'autre fichier :
#
#     🎨 Poser ma propre photo.command
#
# Je demande une recette — son NUMÉRO (7402) ou son NOM (« Chèvre rôti au
# miel ») —, je refais sa photo, puis je demande s'il y en a une autre.
# Tant que tu réponds, on continue. Quand tu appuies simplement sur Entrée,
# TOUT part d'un coup : WordPress et le site.
#
# Compte une dizaine de secondes par recette : lire une vidéo prend du temps,
# et le quota de vision impose une pause entre deux.
#
# Rien n'est envoyé avant la fin : tu peux refaire cinq photos et ne
# déclencher qu'un seul déploiement.
#
# L'ancienne photo est mise de côté sur le Bureau, dans
# « anciennes-photos-recettes/remplacees », avant d'être remplacée.
#
cd "/Users/manu/CloudStation/Anti Gravity/Ag - Projet site cuisine" || {
    echo "Projet introuvable."; read -n1; exit 1;
}

echo "🖼️  Refaire des photos de recettes"
echo

bash scripts/refaire-photo.sh
status=$?

echo
if [ $status -eq 0 ]; then
    echo "✅ Fini. Vercel déploie dans la minute."
else
    echo "❌ Erreur (code $status)."
fi
echo "   (Appuie sur une touche pour fermer)"
read -n 1 -s
