---
name: image-direction
description: Définir une direction artistique et rédiger des prompts pour générer ou retoucher des images cohérentes avec un projet, puis vérifier les résultats lorsque la génération est disponible.
---

# Génération d’images et direction artistique

## Objectif

Transformer la demande en un brief visuel précis, puis en un prompt exploitable. Cette méthode reprend les principes de préparation des images de Codex : usage explicite, style concret, composition utile, contraintes préservées et corrections ciblées. Elle ne prescrit pas un style universel.

## Définir le style et la DA

Avant de choisir une esthétique, examiner les références accessibles, les images existantes, la charte et l’endroit où l’image sera utilisée. Inspecter réellement les références ; ne pas prétendre les avoir vues si elles sont inaccessibles.

La direction artistique décrit l’intention globale et la cohérence de la série. Le style décrit son exécution visuelle : photographie, illustration, peinture, collage ou rendu 3D.

Exprimer la DA avec des choix observables :

- **Usage et intention** : hero de site, fiche produit, recette, campagne ; émotion ou information à transmettre.
- **Médium et réalisme** : photographie éditoriale naturelle, illustration à aplats, rendu 3D mat, etc.
- **Composition** : angle, distance, profondeur, hiérarchie du sujet, place disponible pour du texte si nécessaire.
- **Lumière** : source, direction, douceur, contraste et température.
- **Couleurs** : palette du projet ou des références ; saturation et rapport entre fond et sujet.
- **Matières** : textures visibles et finition, par exemple céramique mate, bois usé ou papier grainé.
- **Cohérence** : caractéristiques à conserver d’une image à l’autre.

Éviter les descriptions uniquement abstraites comme « beau », « premium » ou « moderne ». Les traduire en caractéristiques visibles. Ne pas imposer une palette, un décor ou des accessoires étrangers à la demande. Si aucune DA n’existe, choisir une proposition sobre adaptée à l’usage et la présenter comme une proposition, pas comme une charte existante.

Si la demande est détaillée, la structurer sans ajouter de nouvelles exigences créatives. Si elle est vague, ajouter seulement les précisions utiles au résultat. Poser une question uniquement lorsqu’une information manquante empêche de réussir.

## Choisir la bonne opération

- **Nouvelle image** : créer un visuel original, éventuellement guidé par des références de style ou de composition.
- **Retouche** : modifier une image existante en conservant explicitement les éléments non concernés.
- **Visuel natif** : pour un schéma simple, un SVG ou une icône appartenant à un système vectoriel existant, utiliser le format éditable adapté plutôt qu’une image bitmap générée.

Attribuer un rôle à chaque entrée : cible de retouche, référence de style, référence de composition ou élément à insérer. Une référence n’est pas automatiquement une image à modifier.

## Préparer le prompt

Utiliser uniquement les champs utiles, sans remplir artificiellement le modèle :

```text
Usage : [destination de l’image et format souhaité]
Demande principale : [objectif de l’utilisateur]
Références : [image 1 et son rôle ; image 2 et son rôle]
Scène / fond : [environnement]
Sujet : [sujet principal et détails nécessaires]
Style / médium : [traitement visuel concret]
Composition : [angle, cadrage, hiérarchie, espace utile]
Lumière / ambiance : [source, douceur, contraste, émotion]
Couleurs : [palette justifiée par le brief]
Matières / textures : [détails visibles]
Texte exact : "[texte fourni, uniquement si demandé]"
Contraintes : [éléments obligatoires ou à préserver]
À éviter : [défauts ou éléments indésirables pertinents]
```

Pour une photographie réaliste, demander explicitement le photoréalisme et des textures naturelles. Employer le vocabulaire du cadrage et de la lumière ; préciser une focale seulement si elle sert l’intention.

Réserver un espace vide lorsqu’il doit accueillir du texte ou une interface. Ne choisir son côté qu’après avoir examiné la mise en page. Pour un site, préférer du texte HTML superposé si le texte n’a pas besoin d’appartenir à l’image.

Pour du texte intégré, citer le contenu exact et préciser sa place et sa typographie. Vérifier chaque mot après génération.

Pour une retouche, écrire : « Modifier uniquement X ; conserver Y et Z ». Répéter ces invariants lors de chaque correction. Pour un détourage, demander une véritable transparence et vérifier le canal alpha ; un damier dessiné ne constitue pas un fond transparent.

## Exécuter selon les outils disponibles

Utiliser un outil de génération ou de retouche réellement disponible dans l’environnement de Claude, en respectant ses paramètres documentés. Les noms d’outils et les options de Codex ne sont pas automatiquement disponibles dans Claude.

Sans outil de génération connecté, livrer le brief et le prompt prêts à utiliser, et indiquer que l’image n’a pas été générée. Ne pas présenter une image recherchée sur Internet comme une création originale. Ne pas installer un service payant, engager des frais ou demander des secrets dans la conversation pour contourner un outil manquant.

Le ratio et la résolution souhaités appartiennent au brief ; leur prise en charge exacte dépend de l’outil. Ne pas promettre une taille ou une transparence que l’outil ne permet pas.

## Contrôler et itérer

Inspecter le résultat : sujet, style, cadrage, espace utile, textures, cohérence de lumière, texte, éventuelles déformations et contraintes de retouche. Pour une série, comparer aussi les palettes, angles, arrière-plans et niveaux de contraste.

Corriger le défaut principal avec une instruction ciblée, en conservant la DA et les invariants. Ne pas changer simultanément le cadrage, la lumière et le style sans nécessité. Après deux corrections sans progrès, expliquer le problème et proposer une adaptation précise du brief.

Conserver les originaux. Enregistrer les résultats retenus dans le projet avec un nom descriptif ; créer une nouvelle version sauf remplacement demandé. Si l’intégration au projet fait partie de la demande, actualiser les références aux assets et vérifier leur affichage.

Livrer l’image lorsqu’elle existe, son chemin, le prompt final, la DA retenue et les limites constatées. Ne pas annoncer une inspection ou une intégration non effectuée.

## Exemple : image de recette

Exemple de proposition, à adapter à la charte réelle. Cette DA n’est pas une préférence universelle ni une charte constatée du projet.

**DA proposée** : photographie culinaire éditoriale naturelle, chaleureuse et sobre. Le plat domine ; textures alimentaires crédibles, lumière de fenêtre diffuse, couleurs naturelles, vaisselle discrète. Éviter le rendu plastique et les décors qui détournent l’attention de la recette.

```text
Usage : image principale d’une fiche recette, cadrage horizontal.
Demande principale : photographier une assiette de pâtes à la sauce tomate et au basilic.
Scène / fond : surface neutre mate, environnement discret.
Sujet : une assiette de pâtes, sauce tomate et basilic visibles.
Style / médium : photographie culinaire éditoriale photoréaliste.
Composition : vue à trois quarts, plat au centre, bords de l’assiette visibles ; recadrage possible sans couper le plat.
Lumière / ambiance : lumière de fenêtre latérale diffuse, ombres douces, ambiance chaleureuse sans dominante orange excessive.
Couleurs : couleurs naturelles de la recette, fond peu saturé.
Matières / textures : texture des pâtes et de la sauce, feuilles de basilic naturelles, assiette en céramique mate.
Contraintes : respecter les ingrédients annoncés ; aucun texte, logo ou filigrane.
À éviter : aspect plastique, saturation excessive, accessoires superflus, ingrédients supplémentaires.
```
