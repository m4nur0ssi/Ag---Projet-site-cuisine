# Liste de courses — améliorations à reprendre

Date : 7 octobre 2026.

## Statut et périmètre

Les fonctionnalités sont remises en place et publiées à la demande de Manu (7 octobre 2026). Ce document conserve le cahier des améliorations et les critères de validation. La vérification dans chaque magasin avec une extension installée reste distincte des tests locaux.

Le commit annulé est `94dcf953` : `fix: unify shopping views and remaining quantities with store assistant`. La référence avant ces changements est `422d75b7`. Le retour arrière concerne le site, les moteurs d’ingrédients, la synchronisation, le pont magasin, l’extension Chrome, son archive et les tests ajoutés.

Le retour arrière du code ne restaure pas les données de courses des utilisateurs et ne rétrograde pas automatiquement une extension déjà chargée dans Chrome.

## Reprise locale

- Les trois vues et les quantités restantes sont remises localement.
- Les moteurs ordinateur/mobile partagent le même code.
- Le libellé « As 5s patate » provient du format source `4 à 5 patates` : les intervalles sont désormais reconnus comme des plages, sans choisir une quantité arbitraire.
- Les unités incompatibles restent affichées et ne sont pas remplacées par une quantité en pièces.
- Les retouches sont des besoins totaux ; les achats validés sont déduits et les retouches périmées sont retirées lors d’un changement de source.
- L’annulation d’un vidage restaure aussi les articles déjà pris et les quantités retouchées.
- Les masques et validations sont réconciliés avant affichage lorsque les recettes ou leurs accompagnements changent.
- Les ajouts hors planning restent persistants et utilisent le même état d’achat.
- Le planificateur et la liste emploient « Menu spécial » pour `JourJ`.
- L’extension locale 1.6.0 transporte une file stable, un identifiant de session et les quantités à afficher.
- Le passage au suivant attend deux secondes après le dernier ajout, une preuve visible de l’ajout (ou une confirmation manuelle explicite) et un accusé de réception de la liste.
- Si le retour vers la liste est indisponible, l’assistant le dit et ne prétend pas que l’article a été barré.
- Aucune extension n’est installée ou activée dans Chrome par ces changements de code. Les parcours réels par enseigne restent à vérifier avec cette version chargée.
- Publié en production le 7 octobre 2026, à la demande de Manu.

## Architecture relevée

- L’interface utilisée sur ordinateur et mobile est `src/mobile/screens/tv/TVCourses.tsx`.
- La route `/shopping-list` redirige vers `/tv-courses`. `DesktopPage.tsx` est une ancienne interface ; le tutoriel utilise encore son composant `ExtensionBubble`.
- Le moteur de calcul utilisé par cette interface est `src/mobile/lib/ingredients.ts`. Une autre version existe dans `src/lib/ingredients.ts` : leurs différences sont à surveiller.
- Les sources sont le planning de semaine, le menu `JourJ`, les accompagnements, les ingrédients choisis depuis une fiche recette et les articles saisis à la main.
- L’état est stocké dans le navigateur. Le planning est synchronisé via `meal_plans`, les courses via `shopping_state` dans Supabase.
- Le classement par rayon se trouve dans `src/lib/rayons.ts`.
- La communication magasin vers liste se trouve dans `src/lib/storeFeedback.ts` ; les URLs de recherche dans `src/lib/stores.ts` ; l’assistant dans `chrome-extension-courses/`.

## 1. Clarifier les trois vues

Organisation proposée et approuvée pendant la conversation, à reprendre après le retour arrière :

| Vue | Contenu | Usage |
| --- | --- | --- |
| Tout acheter | Semaine, menu spécial inclus et ajouts supplémentaires, regroupés par produit | Faire les courses avec les quantités restantes |
| Par jour | Besoins d’une journée, présentés avec leurs recettes et accompagnements | Comprendre l’origine des besoins et acheter pour ce jour |
| En + | Articles ajoutés hors planning, depuis une fiche recette ou à la main | Gérer les suppléments qui restent lors d’un changement de menu |

Ces vues doivent lire un état d’achat commun, et non maintenir des cases indépendantes.

### Définir Jour J

- Si `JourJ` désigne aujourd’hui, il doit être intégré à « Par jour ».
- Si `JourJ` désigne un repas ou un événement distinct du planning, l’intitulé proposé est « Menu spécial ».
- Le code actuel le stocke séparément. La proposition était de le montrer comme un menu spécial consultable et inclus dans les courses selon un réglage explicite.
- Garder une seule définition entre planificateur et liste de courses.

## 2. Calculer ce qui reste à acheter

Distinguer le besoin total du besoin restant. Les validations doivent être appliquées aux ingrédients d’origine avant le calcul des quantités restantes.

### Exemple de référence : ail dans trois recettes

1. Lundi, mardi et mercredi demandent chacun `1 × ail`.
2. « Tout acheter » indique `3 × ail`.
3. Valider l’ail du lundi barre uniquement le besoin du lundi ; la fusionnée indique `2 × ail restant à acheter`.
4. Valider les deux ails restants depuis la fusionnée barre aussi les besoins du mardi et du mercredi.
5. Valider directement les trois ails depuis la fusionnée barre les trois occurrences journalières.
6. Remettre une occurrence « à prendre » recalcule la quantité restante et remet les vues en cohérence.

Préserver les lignes entièrement achetées sous forme barrée pour pouvoir les remettre à prendre. Utiliser seulement les besoins restants pour le partage et le parcours magasin.

## 3. Fiabiliser les quantités et les unités

Constats dans le code initial :

- Les contenants comme gousse, tranche, tasse ou sachet sont retirés du nom sans conserver systématiquement l’unité. Des mesures deviennent alors des « pièces » trompeuses.
- Le moteur peut réunir un produit exprimé en pièces et en grammes, puis l’écran n’afficher que la quantité du premier groupe alors que le texte de fusion contient les deux.
- Les fractions, les cuillères et certaines variantes d’écriture d’unités demandent un traitement cohérent.

À faire :

- Conserver les unités et contenants utiles : `2 gousses d’ail` doit rester deux gousses, et non deux têtes ou deux pièces indéfinies.
- Additionner les unités compatibles : `1 kg + 200 g = 1,2 kg`, et convertir correctement les volumes compatibles.
- Ne pas inventer de conversion entre pièces, gousses, grammes et contenants lorsque l’équivalence n’est pas connue.
- Afficher toutes les mesures lorsque des unités incompatibles restent sur une même ligne : par exemple `1 pièce + 200 g`.
- Préserver les mesures dans les fractions et les formulations de cuillères.
- Définir une quantité retouchée comme un besoin total ou une quantité restant à acheter, et rendre ce choix explicite. La proposition réalisée avant annulation était un besoin total dont les achats validés sont déduits.
- Vérifier qu’une retouche ne reste pas appliquée par erreur à un nouveau planning et ne transforme pas une combinaison d’unités en simple nombre de pièces.

## 4. Améliorer les noms et les rayons

Exemples observés sur la page :

- `As 5s patate` : libellé source mal formé à examiner ; sa bonne correction ne peut pas être déduite avec certitude du seul texte.
- `Fécules de maïs` classées dans les fruits et légumes.
- `Grand bol d’eau froide avec 2 tasse de glaçon` traité comme un article du rayon surgelé.
- Des aliments et leurs préparations peuvent produire des variantes ou des doublons.

Le classement actuel utilise le premier mot-clé reconnu : « maïs » peut gagner avant « fécule ».

À faire :

- Donner la priorité au produit réel et aux expressions précises : fécule de maïs en épicerie, sucre glace hors surgelés, lait de coco selon le conditionnement et le rayon choisi.
- Éviter les faux positifs des mots-clés et distinguer aliment frais, poudre, conserve et préparation quand cela change l’achat.
- Repérer les consignes de préparation, l’eau de cuisson et les bains de glaçons afin de ne pas les traiter automatiquement comme des produits à acheter.
- Corriger les données sources quand elles sont mal extraites ; ne pas masquer une mauvaise extraction avec une quantité inventée.
- Conserver les reclassements manuels par rayon et vérifier leur synchronisation.

## 5. Ne pas supposer que les basiques sont déjà disponibles

L’interface initiale barre automatiquement certains produits reconnus comme des basiques du placard lors de leur première apparition.

Proposition :

- Garder ces ingrédients à acheter tant que l’utilisateur n’a rien confirmé.
- Proposer « Tu les as déjà ? » avec les produits concernés.
- Une confirmation peut barrer tous les basiques explicitement présentés ; chaque produit reste modifiable individuellement.
- Préserver les achats confirmés. Les anciennes marques automatiques et manuelles ne sont pas forcément distinguables : prévoir une migration prudente.

## 6. Unifier les validations entre les vues

Constats :

- Les clés de la fusionnée comprennent des sous-indices, tandis que certaines vues journalières utilisent seulement l’indice d’ingrédient.
- Les accompagnements ont aussi des conventions de clé différentes selon les vues.
- « En + » possède un état de cases séparé, qui doit être remplacé par un état partagé et persistant.

À faire :

- Utiliser une identité stable pour chaque besoin d’origine, avec une distinction entre plat, accompagnement et sous-ligne.
- Faire correspondre les validations dans toutes les vues.
- Garder une identité propre pour chaque ajout hors planning, même lorsqu’il est fusionné avec un produit du planning.
- Ne pas perdre les validations au rechargement ni les appliquer à une autre recette qui réutilise le même créneau.
- Lorsqu’un ingrédient source contient plusieurs produits, supprimer ou valider une sous-ligne ne doit pas supprimer les autres.

## 7. Partage et magasin : respecter la vue de départ

Dans le code initial, le parcours magasin et le partage en vue journalière filtrent des produits issus du total fusionné, sans recalculer toutes les quantités pour le seul jour choisi.

Comportement attendu :

- « Tout acheter » transmet tous les produits restant à acheter, avec les quantités restantes.
- « Par jour » transmet seulement les besoins restants du jour ou du menu spécial consulté.
- « En + » transmet seulement les ajouts supplémentaires restants.
- Les articles déjà barrés ne repartent pas dans la file magasin.
- La validation dans le magasin barre les besoins de la vue qui a lancé les courses, puis met à jour les autres vues liées.

## 8. Extension Chrome : activation et navigation

Demande de Manu : cliquer sur un magasin doit lancer l’assistant automatiquement et permettre de parcourir les produits.

Conditions et limites :

- L’extension doit être installée, activée dans Chrome et autorisée sur le magasin concerné.
- Le site ne peut pas installer l’extension ni réactiver une extension désactivée par Chrome.
- Une extension Chrome ne fonctionne pas dans l’application Safari utilisée pour Recettes Magiques.
- La gestion des extensions Chrome n’a pas pu être inspectée par l’outil navigateur : l’accès à `chrome://extensions/` a été bloqué par la politique de sécurité.

À faire :

- Détecter la présence réelle de l’extension sur la page. Un ancien drapeau stocké dans le navigateur ne prouve pas qu’elle est encore active.
- Lancer la file au clic sur le bouton magasin, sans activation manuelle supplémentaire de l’assistant lorsque l’extension est déjà active.
- Garder la file lors des navigations dans le magasin.
- Relire une nouvelle file lorsqu’on réutilise le même onglet, y compris si seuls l’ancre ou les paramètres changent.
- Couvrir les enseignes proposées par le site. L’extension initiale couvre Carrefour, Picard, Monoprix et Leclerc ; Auchan et Intermarché sont aussi proposés côté site et doivent être traités et vérifiés.
- Garder l’archive téléchargeable cohérente avec les sources et le numéro de version.
- Prévoir les retours qui échouent lorsque le magasin coupe `window.opener` ou ferme la page d’origine. Ne pas affirmer que la validation a atteint la liste si ce retour n’est pas confirmé.

## 9. Délai de deux secondes après ajout au panier

Demande de Manu : laisser le temps d’ajouter plusieurs unités avant le produit suivant.

Comportement attendu :

1. Un clic d’ajout au panier ou d’augmentation de quantité lance un délai de deux secondes.
2. Chaque nouveau clic d’ajout ou d’augmentation relance ce délai de deux secondes.
3. La validation est envoyée à la liste une seule fois à la fin du délai.
4. L’assistant passe ensuite au produit suivant.
5. Le dernier produit est aussi validé ; la liste peut se terminer sans navigation supplémentaire.
6. Fermer l’assistant ou revenir au produit précédent annule une transition en attente.

Vérifier les boutons réels des enseignes, les composants utilisant un Shadow DOM et les boutons désactivés. Un clic peut échouer à ajouter le produit : distinguer la détection du clic de la confirmation réelle du panier, et éviter de barrer un produit lorsque l’ajout échoue.

## 10. Garder une file magasin stable

Le retour de l’extension utilise l’indice d’un produit dans la file envoyée. Le code initial le cherche dans une liste restante qui raccourcit après chaque validation : l’indice peut alors désigner un autre article.

À faire :

- Garder un instantané de la file envoyée et des identités de ses besoins.
- Associer les retours à cette file, idéalement avec un identifiant de session et de produit.
- Vérifier l’origine et la fenêtre qui envoient la validation.
- Ne jamais barrer un article au simple lancement de la recherche magasin.
- Prévoir une validation manuelle explicite lorsque l’assistant n’est pas disponible.

## 11. Compléter et harmoniser la synchronisation

Constat : les quantités retouchées et le réglage « semaine incluse » ne font pas partie de toutes les clés synchronisées. Deux versions du module de synchronisation existent, avec des protections différentes contre les anciens états du cloud.

À faire :

- Harmoniser les modules utilisés par l’ordinateur et le mobile.
- Synchroniser les ajouts, les validations, les suppressions, les quantités retouchées, les rayons personnalisés et les réglages d’inclusion.
- Propager une suppression réelle au lieu de laisser une ancienne valeur sur l’autre appareil lorsqu’une clé disparaît du cloud.
- Empêcher un ancien état du cloud de défaire un geste local récent.
- Éviter les boucles où l’application réécrit immédiatement un état qu’elle vient de recevoir.
- Garder les signatures nécessaires au changement de planning cohérentes entre les appareils.

## 12. Vider, supprimer et changer de planning

Constat : « Vider » masque les ingrédients du plat principal, mais oublie ceux des accompagnements.

À faire :

- Inclure les accompagnements dans le vidage.
- Retirer les ajouts visés sans effacer le menu planifié.
- Maintenir l’annulation proposée à l’utilisateur.
- Ne pas faire réapparaître une ligne supprimée lors du recalcul.
- Ne pas conserver un masque positionnel qui cache une nouvelle recette dans le même créneau.
- Respecter une liste volontairement vidée tant que le planning correspondant ne change pas.
- Conserver les ajouts de « En + » lorsqu’on change le planning ; les retirer seulement par une action explicite adaptée.

## 13. Validation avant nouvelle publication

Les modifications annulées avaient passé des tests de logique et une compilation complète du site. Le parcours réel dans les magasins n’avait pas été vérifié avec la nouvelle extension chargée. Une reprise doit donc refaire les vérifications, et non considérer les tests précédents comme une preuve de fonctionnement actuel.

Scénarios à vérifier :

- Trois recettes avec un ail : fusion à trois, validation journalière à un, reste à deux, validation fusionnée du reste, remise à prendre.
- Produit partagé entre planning, accompagnement et « En + » : bon périmètre de validation dans chaque vue.
- Quantités en grammes et kilogrammes, volumes compatibles, fractions, cuillères, gousses et unités incompatibles.
- Article sans quantité, quantité retouchée et achat partiel.
- En + : rechargement, retrait d’un article, changement de planning et absence de cases indépendantes.
- Menu spécial inclus ou exclu, consultable et commandable séparément.
- Vider avec accompagnements, annuler, supprimer une sous-ligne et replanifier dans le même créneau.
- Basiques proposés sans validation automatique.
- Synchronisation ordinateur/mobile, retours cloud différés et suppression d’une clé.
- Extension : lancement, navigation, relancement dans le même onglet, validation du premier puis du deuxième produit, ajouts multiples espacés de moins de deux secondes, dernier produit, fermeture, erreur d’ajout au panier.
- Parcours réel sur chaque enseigne prise en charge, avec l’extension mise à jour et active.
- Compilation du site et vérification de l’archive servie après déploiement.
