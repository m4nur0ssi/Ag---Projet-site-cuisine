# Génération des images de recettes

Ce document décrit le process à suivre pour générer ou régénérer les images des recettes du site.

## Objectif

Chaque image doit représenter fidèlement la vraie recette publiée sur WordPress, en se basant sur la vidéo TikTok associée. Le but n'est pas de produire une belle image générique, mais une photo réaliste qui ressemble au plat réel vu dans la vidéo.

## Règle principale

Avant de générer une image, toujours lire :

- les 4 premières secondes de la vidéo TikTok ;
- les 4 dernières secondes de la vidéo TikTok.

Ces deux extraits servent à comprendre :

- le vrai plat ;
- les ingrédients visibles ;
- la couleur finale ;
- la texture ;
- la vaisselle ;
- le dressage ;
- le contexte autour du plat.

## Étapes

### 1. Identifier la recette

Récupérer dans les données du projet ou dans WordPress :

- l'ID de la recette ;
- le titre exact ;
- le `tiktokId` ;
- l'image actuelle.

Dans le projet, les images générées doivent être stockées ici :

```text
public/recipes-ia/<id>.webp
public/recipes-ia/<id>-carte.webp
```

### 2. Synchroniser WordPress si nécessaire

Si la recette vient d'être publiée ou modifiée sur WordPress, lancer :

```bash
npm run sync-recipes
```

Puis reconstruire les données d'accueil :

```bash
npm run build:home-data
```

### 3. Récupérer la vidéo TikTok

À partir du `tiktokId`, récupérer la vidéo liée à la recette. Si TikTok direct ne fonctionne pas, utiliser une source miroir ou une API déjà utilisée dans le projet pour obtenir le MP4.

Exemple de logique :

```text
https://www.tiktok.com/@x/video/<tiktokId>
```

La vidéo peut ensuite être stockée temporairement dans `/private/tmp`.

### 4. Extraire les références vidéo

Extraire les 4 premières secondes :

```bash
ffmpeg -y -ss 0 -t 4 -i /private/tmp/tiktok_<id>.mp4 -vf fps=1 /private/tmp/tiktok_<id>_start_%02d.jpg
```

Extraire les 4 dernières secondes :

```bash
ffmpeg -y -sseof -4 -i /private/tmp/tiktok_<id>.mp4 -vf fps=1 /private/tmp/tiktok_<id>_end_%02d.jpg
```

Créer ensuite des planches contact pour lire rapidement les images :

```bash
ffmpeg -y -i /private/tmp/tiktok_<id>_start_%02d.jpg \
  -vf "scale=260:-1,tile=4x1:padding=6:margin=4:color=white" \
  -frames:v 1 -update 1 /private/tmp/tiktok_<id>_start_contact.jpg

ffmpeg -y -i /private/tmp/tiktok_<id>_end_%02d.jpg \
  -vf "scale=260:-1,tile=4x1:padding=6:margin=4:color=white" \
  -frames:v 1 -update 1 /private/tmp/tiktok_<id>_end_contact.jpg
```

### 5. Observer avant de générer

Regarder les planches de début et de fin avant d'écrire le prompt.

Il faut noter :

- si le plat est entier, découpé, en bol, en assiette, en gratin, sur planche, etc. ;
- la forme et la couleur de la vaisselle ;
- les garnitures réellement visibles ;
- les sauces, fromages, herbes, textures croustillantes ou fondantes ;
- le cadrage final de la vidéo.

### 6. Générer l'image

Utiliser ImageGen avec les planches TikTok comme références.

Le prompt doit toujours demander :

- une photo réaliste ;
- une vue de haut ou quasi de haut ;
- un rendu fidèle à la vidéo TikTok ;
- du contexte naturel autour du plat ;
- une vaisselle variée ;
- aucun élément parasite.

Contraintes obligatoires :

```text
No people, no hands, no faces, no TikTok UI, no captions, no watermark, no logo, no in-image text.
```

Il faut aussi éviter de répéter toujours la même assiette blanche ronde. Varier selon le plat :

- bol céramique ;
- plat ovale ;
- plat à gratin ;
- planche bois ;
- assiette sombre ;
- plat terracotta ;
- plaque ou lèchefrite ;
- plateau rectangulaire.

### 7. Vérifier l'image générée

Avant de l'intégrer au projet, vérifier que :

- le plat correspond bien à la vidéo ;
- la recette n'a pas été transformée en plat générique ;
- il n'y a pas de main, visage, texte, logo ou watermark ;
- le cadrage fonctionne en format vertical ;
- la vaisselle varie par rapport aux autres recettes du lot.

Si l'image est belle mais fausse, il faut la refaire.

### 8. Exporter les deux formats

Créer la grande image :

```bash
ffmpeg -y -i "<image-generee>.png" \
  -vf "scale='if(gte(iw/ih,1200/1586),-1,1200)':'if(gte(iw/ih,1200/1586),1586,-1)',crop=1200:1586" \
  -frames:v 1 -update 1 /private/tmp/<id>_1200.png

cwebp -quiet -q 88 /private/tmp/<id>_1200.png -o public/recipes-ia/<id>.webp
```

Créer l'image carte :

```bash
ffmpeg -y -i "<image-generee>.png" \
  -vf "scale='if(gte(iw/ih,760/1004),-1,760)':'if(gte(iw/ih,760/1004),1004,-1)',crop=760:1004" \
  -frames:v 1 -update 1 /private/tmp/<id>_760.png

cwebp -quiet -q 86 /private/tmp/<id>_760.png -o public/recipes-ia/<id>-carte.webp
```

### 9. Reconstruire les données

Après avoir ajouté ou remplacé les images :

```bash
npm run build:home-data
```

Si une recette affichait encore `/images/recipe-placeholder.svg`, relancer d'abord :

```bash
npm run sync-recipes
```

Puis :

```bash
npm run build:home-data
```

Le script de synchro associe automatiquement une recette à son image locale si le fichier suivant existe :

```text
public/recipes-ia/<id>-carte.webp
```

### 10. Vérifier

Vérifier les dimensions :

```bash
file public/recipes-ia/<id>.webp public/recipes-ia/<id>-carte.webp
```

Les dimensions attendues sont :

```text
public/recipes-ia/<id>.webp       1200x1586
public/recipes-ia/<id>-carte.webp 760x1004
```

Vérifier que la recette pointe bien vers :

```text
/recipes-ia/<id>-carte.webp
```

### 11. Build final

Avant de publier :

```bash
npm run build
```

Les warnings existants ne bloquent pas forcément le déploiement, mais le build doit se terminer avec succès.

### 12. Commit et push

Ajouter uniquement les fichiers utiles :

```bash
git add public/recipes-ia/<id>.webp public/recipes-ia/<id>-carte.webp \
  src/data/mockData.ts \
  src/mobile/data/mockData.ts \
  src/mobile/data/home-recipes.ts \
  src/mobile/data/home-details.ts \
  src/mobile/data/home-videos.ts \
  src/data/sync-stats.json \
  translate-cache.json
```

Créer le commit :

```bash
git commit -m "Refresh latest recipe images"
```

Pousser :

```bash
git push origin main
```

Le push déclenche ensuite le déploiement Vercel.

## Vérification production

Après le déploiement, vérifier que l'image servie par Vercel correspond au fichier local.

Exemple :

```bash
shasum -a 256 public/recipes-ia/<id>-carte.webp
curl -L -s --fail "https://www.lesrecettesmagiques.fr/recipes-ia/<id>-carte.webp" -o /private/tmp/prod_<id>-carte.webp
shasum -a 256 /private/tmp/prod_<id>-carte.webp
```

Les deux hashes doivent être identiques.

Si les hashes sont identiques mais que l'ancienne image apparaît encore dans le navigateur, le problème vient probablement du cache navigateur, PWA ou CDN.

## Checklist rapide

- [ ] Recette identifiée avec son ID et son `tiktokId`.
- [ ] 4 premières secondes extraites.
- [ ] 4 dernières secondes extraites.
- [ ] Planches contact observées.
- [ ] Image générée fidèle au vrai plat.
- [ ] Vue de haut ou quasi de haut.
- [ ] Contexte naturel autour du plat.
- [ ] Vaisselle variée.
- [ ] Aucun visage, main, texte, logo, watermark ou UI TikTok.
- [ ] `public/recipes-ia/<id>.webp` créé en `1200x1586`.
- [ ] `public/recipes-ia/<id>-carte.webp` créé en `760x1004`.
- [ ] `npm run build:home-data` exécuté.
- [ ] Chemin `/recipes-ia/<id>-carte.webp` vérifié dans les données.
- [ ] `npm run build` OK.
- [ ] Commit créé.
- [ ] Push effectué.
- [ ] Production vérifiée si nécessaire.
