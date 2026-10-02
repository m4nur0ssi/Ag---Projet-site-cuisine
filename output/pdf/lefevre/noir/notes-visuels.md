# Édition noire — Lefèvre

Quatre PDF, aux formats d’origine, avec textes vectoriels et polices intégrées. Tous les prix et les descriptions ont été comparés aux PDF d’origine. Originaux conservés.

## Visuels

Les onze visuels finaux sont conservés dans `assets/`. Les fonds ont été adaptés avec l’outil intégré ImageGen, sans API ni CLI. Aucune photo de la boulangerie n’est utilisée. Les images sont des visuels d’illustration.

## Consignes des images

Consigne commune des dix premiers visuels :

Use case: background-extraction / lighting-weather. EDIT THE REFERENCE PHOTO. Preserve the exact products, their number, arrangement, shapes, ingredients, colors and all existing brand logos and label text. Replace ONLY the white background and white surface with a seamless uniformly PURE BLACK #000000 studio background and surface extending right to every image edge. Retain realistic rich natural product colors and enough soft rim lighting to separate food, glass and metallic edges from black. Premium sophisticated French bakery advertising product photography. No new products, no omitted products, no rearrangement, no extra decoration, no wood, no slate, no plates beyond those already present, no new text, no bakery storefront, no frame. Full original product silhouettes visible, no cropping. Preserve the original aspect ratio and high resolution. Deep black edges are critical for placing this image seamlessly on a pure black printed menu.

Pour cafés, viennoiseries, assortiment et canettes, ajout : « This reference is the [nom] product group. All of its products must remain identical and complete. »

Pour thon, dinde-beurre, dinde-fromage, poulet, saumon et red-bull, ajout : « Input image: edit target. This is the [nom] product photo. Keep the exact same filling and bread, or branded can, as applicable. »

Consigne finale du fricassé :

Use case: background-extraction. EDIT THE REFERENCE PHOTO. Preserve the exact products, number, arrangement, shapes, ingredients, colors and existing brand logos and label text. Replace ONLY the white background and white surface with a seamless uniformly PURE BLACK #000000 studio background and surface extending right to every image edge. Retain realistic rich natural product colors and soft rim lighting to separate edges from black. Premium French bakery advertising product photography. No new products, no omitted products, no rearrangement, no extra decoration, no wood, no slate, no added plates, no new text, no bakery storefront, no frame. Full original product silhouettes visible, no cropping. Preserve original aspect ratio and high resolution. Deep black edges are critical for placing this image seamlessly on a pure black printed menu. Input image: edit target. This is the fricasse sandwich. Keep identical bread, tuna, sliced eggs, black olives and lettuce filling and original composition.

## Fichiers de travail

`composition.py` : mise en page des quatre affiches.
`verification.py` : contrôle des formats, prix et textes.
`verification.json` : résultat des contrôles.
`apercus/` : rendus de contrôle.

Les cartes A4 sont au format 210 × 297 mm ; l’affiche formules mesure 1 000 × 500 mm. Les PDF sont au format fini, sans traits de coupe ajoutés.

