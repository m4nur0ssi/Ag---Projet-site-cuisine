# Affiches Lefèvre - 100 x 50 cm

Deux propositions : moderne (blanc, vert profond, typographie sans empattement) et authentique (crème, terracotta du store, typographie d'enseigne et illustration de la devanture fournie).

## Impression et vérification

- Chaque PDF contient une page de 1 000 x 500 mm, horizontale, à imprimer à 100 %.
- Textes vectoriels et polices incorporées. Les photos de sandwichs sont intégrées à environ 190 ppp à leur taille d'impression, sans agrandissement artificiel.
- Titres des sandwichs : environ 30 pt ; ingrédients : 25 pt ; allergènes : 21 pt. Mise en page conçue pour une lecture à environ deux mètres ; une épreuve à taille réelle reste le moyen de confirmer la lisibilité dans l'éclairage de la boutique.
- PDF RVB, sans fond perdu ni profil imprimeur imposé. Demander à l'imprimeur ses spécifications avant la production finale.
- Contrôles effectués : dimensions, une page, douze prix, six intitulés, description de la formule, polices incorporées, rendu visuel des deux PDF.

## Contenu à confirmer avant impression

Les six garnitures, les noms et les prix proviennent de « Formules A3 — photos réelles.pdf ». La baguette tradition remplace le pain de toutes les recettes. Le fricassé conserve son titre et sa garniture, mais devient une baguette tradition huilée : il s'agit de l'interprétation de la demande « des sandwichs avec de la baguette tradition française », à confirmer par la boulangerie.

Les formules comprennent un sandwich, une pâtisserie au choix et une boisson en canette 33 cl au choix. Les photographies des pâtisseries et des canettes illustrent le choix : elles ne signifient pas que deux pâtisseries et deux boissons sont incluses.

Les allergènes affichés sont indicatifs, déduits des compositions, et non une fiche validée. La mayonnaise est supposée contenir œuf et moutarde ; beurre et fromage contiennent du lait ; pain au blé, thon et saumon et œuf dur sont identifiés. Vérifier impérativement les fiches des farines, mayonnaises, jambons de dinde, charcuteries de poulet et fromages : soja, lait ou autres allergènes peuvent s'y ajouter. Le PDF source mentionne le soja globalement mais sans l'attribuer à une recette, ce qui ne permet pas de l'assigner de façon fiable. Vérifier les traces croisées avec l'atelier. Les allergènes des pâtisseries et boissons dépendent des produits choisis. La mention « Fait maison » est reprise du document fourni dans la version moderne et doit correspondre aux produits vendus.

Source de contexte sur l'information allergènes : https://entreprendre.service-public.gouv.fr/vosdroits/F32192

## Visuels et prompts

Outil utilisé : ImageGen intégré, sans API/CLI de remplacement. Les huit images originales sont enregistrées dans assets/. Il s'agit de visuels générés, pas de photographies des produits réels de la boulangerie. Le fichier composition.py contient la mise en page vectorielle ; contenu.json reprend le texte et les prix.

Prompt commun aux six sandwichs :
« Premium photorealistic French artisan bakery advertising photo, ONE whole long sandwich in real baguette de tradition française, rustic golden crackly crust, pointed ends, natural irregular ear scoring and subtle flour, never smooth industrial bread. Generously filled, ingredients clearly visible and overflowing tastefully, believable food. Side three-quarter slightly elevated view, sandwich horizontal left-to-right filling 90% width, entire sandwich and both tips visible. Landscape 3:2 image. Pure white seamless studio background, soft contact shadow. No plate, board, paper, text, logo, decor or extra ingredients. Very high detail for large format print. »

Garnitures spécifiées séparément :
- thon.png : thon émietté, mayonnaise crémeuse, salade verte. Ni tomate, ni œuf, ni fromage.
- dinde-beurre.png : plis de jambon de dinde rose pâle, beurre visible, salade et mayonnaise. Ni fromage, ni tomate.
- dinde-fromage.png : jambon de dinde, tranches de fromage jaune pâle clairement visibles, salade, mayonnaise. Sans tomate.
- poulet.png : tranches fines de charcuterie de poulet à bord légèrement doré, salade et mayonnaise. Pas de morceaux de poulet rôti, ni fromage, ni tomate.
- saumon.png : tranches généreuses de saumon fumé corail, salade et mayonnaise. Sans fromage frais, concombre, tomate, citron ou aneth.
- fricasse.png : thon, rondelles d'œuf dur, olives noires, salade ; pain légèrement huilé. Pas de mayonnaise, de tomate ni de fromage. Baguette tradition malgré le titre fricassé.

formule.png : « Premium photorealistic French artisan bakery food advertising still life, isolated on seamless pure white background. A glossy chocolate éclair and a small beautiful strawberry tartlet on the left, and TWO standard 330 ml soft drink aluminium cans on the right, one plain burnt orange and one plain dark forest green, visible silver tops with ring pulls. No text or brands on cans. Pastries in front and drinks behind. All objects fully visible with generous clean margins. Soft natural studio lighting and delicate contact shadows, eye level slightly above, delicious real bakery textures, no plate, no bottle, no cups, no unrelated props. Wide horizontal image 3:2, highest detail. This illustrates a choice of pastry and canned drink in a sandwich meal deal. »

boutique.png : « Input image is a reference photograph of the real Boulangerie Pâtisserie Lefèvre storefront. Create a charming carefully drawn architectural pen-and-watercolour vignette of THIS EXACT corner bakery, preserve angled two-sided storefront, white/grey facade, dark charcoal metalwork, prominent burnt orange awnings on front and right and French bakery sign. Elegant antique French illustrated shop trade card style, fine brown ink lines, warm grey and terracotta washes. Isolated on clean pale ivory background with soft irregular watercolor edges. Remove foreground pavement barriers/poles and parked clutter, remove surroundings except a suggestion of stone wall. The shop fills the image width; landscape 3:2 composition. This is a small illustration for the top of a large bakery menu poster. Do not invent date, address, signage or slogan; retain simple readable Lefèvre if a name appears. No poster layout or added graphic text. »
