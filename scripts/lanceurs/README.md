# Les lanceurs à double-cliquer

Ces deux fichiers `.command` ne servent à rien **ici**. Ce sont des copies de
sauvegarde. Les originaux vivent dans le Finder, sous :

```
~/Downloads/wordpress/
```

C'est là qu'on les double-clique. Ils ne contiennent aucune logique : ils se
placent dans le dossier du projet, appellent un script de `scripts/`, et
laissent la fenêtre du Terminal ouverte pour qu'on puisse lire ce qui s'est
passé.

| Lanceur | Appelle | Ce qu'il fait |
|---|---|---|
| 🖼️ Refaire une photo de recette | `scripts/refaire-photo.sh` | regarde la vidéo TikTok (4 premières et 4 dernières secondes) et régénère la photo |
| 🎨 Poser ma propre photo | `scripts/photo-perso.sh` | pose une image venue d'ailleurs (ChatGPT, appareil photo), la recadre en 3:4 et l'écrit aux deux tailles |

Les deux finissent pareil : WordPress, puis le site — en un seul déploiement,
même après cinq recettes.

## Pourquoi une copie dans le dépôt

Le dossier des Téléchargements se vide. Un ménage, une réinstallation, et les
lanceurs disparaissent sans que personne s'en aperçoive avant d'en avoir besoin.
Ici, ils sont versionnés.

## Les remettre en place

```bash
cp scripts/lanceurs/*.command ~/Downloads/wordpress/
chmod +x ~/Downloads/wordpress/*.command
```

Le chemin du projet est écrit **en dur** dans chaque lanceur (`cd "/Users/manu/
CloudStation/…"`). Si le projet déménage, il faut corriger cette ligne dans les
deux fichiers — c'est la seule chose qu'ils savent du monde extérieur.

## Modifier un lanceur

Éditer la copie du dépôt, puis la recopier vers `~/Downloads/wordpress` avec la
commande ci-dessus. L'inverse — éditer dans les Téléchargements et oublier de
reporter ici — est le meilleur moyen de perdre la modification au prochain
ménage.
