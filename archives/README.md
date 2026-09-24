# Archives — scripts ponctuels

Ces fichiers étaient à la racine du dépôt. Ce sont des outils **à usage unique**
(corrections de masse déjà passées, tests d'API, inspections de brouillons
WordPress, exports) : aucun workflow, aucun script de `package.json`, ni le site,
ni le bot ne les appelle. Ils ont été rangés ici le 24 septembre 2026 pour
alléger la racine, **sans rien supprimer**.

Pour en relancer un : le remettre d'abord à la racine (`git mv
archives/scripts-ponctuels/<fichier> .`). Beaucoup lisent ou écrivent des
chemins relatifs à la racine (`src/data/mockData.ts`, `ingredient-icons.json`…)
et ne marcheraient pas depuis ce dossier.

Les outils toujours en service sont restés à la racine : `sync-recipes.js`
(et ses modules `foursquare.js`, `place-lookup.js`), `translate-*.js`,
`add-youtube-recipe.js`, `auto-upload-*.js`, `apply-restaurants-info.js`.
