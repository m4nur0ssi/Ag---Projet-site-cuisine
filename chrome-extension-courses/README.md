# Courses Magiques — extension navigateur

Permet de parcourir ta liste de courses **ingrédient par ingrédient directement sur
le site du magasin** (Carrefour, Picard, Monoprix, Franprix), **sans changer d'onglet**.

## Comment ça marche
1. Sur le site des recettes, tu coches tes ingrédients et tu cliques sur le bouton magasin
   (ex. Carrefour). Le site ouvre le magasin **avec toute ta liste** encodée dans l'URL.
2. L'extension lit cette liste et affiche un **widget flottant** en bas à droite de la
   page du magasin : produit courant, position (ex. 3/8), boutons ◀ / « Ajouté → suivant ».
3. Tu ajoutes le produit au panier, tu cliques **« Ajouté → suivant »** → la recherche
   du produit suivant se lance **dans le même onglet**. Tu ne quittes jamais le magasin.
4. Bonus : si l'extension détecte ton clic sur « Ajouter au panier », elle avance toute seule.

## Installation (une seule fois)
1. Ouvre **Chrome** (ou Edge) → `chrome://extensions`
2. Active **« Mode développeur »** (en haut à droite)
3. Clique **« Charger l'extension non empaquetée »**
4. Sélectionne le dossier **`chrome-extension-courses`**
5. C'est prêt. Va sur le site des recettes, lance des courses → le widget apparaît sur le magasin.

## Maintenance
Si un magasin change la structure de son bouton « Ajouter au panier », l'auto-détection
peut ne plus marcher — le bouton **« Ajouté → suivant »** du widget reste fiable dans tous les cas.

> Note : il manque `icon.png` (optionnel). L'extension marche sans. Ajoute une icône 128×128
> nommée `icon.png` dans ce dossier si tu veux un visuel dans la barre Chrome.
