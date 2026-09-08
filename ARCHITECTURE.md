# Les Recettes Magiques — le site, de bout en bout

**À quoi sert ce fichier.** Il n'y a rien à savoir sur ce projet qui ne soit
écrit ici. Une personne — ou un assistant — qui le lit en entier peut reprendre
le travail sans poser de question : d'où viennent les recettes, qui décide de ce
qui s'affiche, où vivent les données, ce qui est fragile et pourquoi.

Il décrit le dépôt **site** (celui-ci). Le dépôt de l'app iPhone est ailleurs ;
les deux partagent le même Supabase.

Dernière révision : 8 septembre 2026.

---

## 1. En une page

Un site de recettes, en français, alimenté par des vidéos TikTok. Le parcours
complet d'une recette :

```
Une vidéo TikTok repérée sur l'iPhone
        │  (raccourci iOS → tiktok-bot/queue.json → commit)
        ▼
GitHub Actions « auto-recipe.yml »
        │  le bot lit la vidéo, écrit une recette, la publie sur WordPress
        ▼
WordPress (hébergé sur le NAS, à la maison)
        │  webhook → repository_dispatch
        ▼
GitHub Actions « wp-sync.yml » → sync-recipes.js
        │  réécrit src/data/mockData.ts et src/mobile/data/mockData.ts
        ▼
Vercel rebuild  →  prebuild: build-home-data.js  →  le site en ligne
```

Le catalogue **n'est pas** une base de données interrogée à chaud : c'est un
fichier TypeScript committé dans le dépôt (`mockData.ts`, ~688 recettes). Le
site est donc statique et rapide, mais **publier une recette veut dire
redéployer**.

Supabase ne stocke que ce qui appartient à un utilisateur : favoris, notes,
planning, liste de courses, cave, carnet de cuisine.

- **Production** : <https://lesrecettesmagiques.fr> (Vercel, domaine chez IONOS)
- **Framework** : Next.js 14 (App Router), React 18, TypeScript, CSS Modules
- **Hébergement** : Vercel — `middleware.ts` force le domaine canonique en 308

---

## 2. Deux applications dans un seul dépôt

C'est la chose la plus importante à comprendre avant de toucher au code.

`src/components/` **et** `src/mobile/components/` contiennent souvent un
composant du même nom, avec le même rôle, mais deux fichiers différents.
Ce n'est pas un accident : le rendu téléphone et le rendu bureau ont divergé
volontairement.

**L'aiguillage** est dans `src/components/AppShell.tsx` :

```ts
const detect = () =>
    window.matchMedia('(max-width: 1023px)').matches ||
    /iPhone|iPod|Android.*Mobile/i.test(navigator.userAgent);
```

Le résultat est posé dans `DeviceContext` (`src/components/device.tsx`), lu
partout via `useIsMobile()` :

| valeur | sens |
|---|---|
| `null` | pas encore déterminé — **on ne rend RIEN** |
| `true` | téléphone → arbre `src/mobile/*` |
| `false` | bureau → arbre `src/components/*` |

> **Pourquoi `null` ne rend rien.** Le SSR et le premier rendu client doivent
> produire le même arbre, sinon React lève les erreurs #418/#423. La bascule se
> fait en `useLayoutEffect` (avant peinture) : pas de flash de la version bureau.

**Conséquence pratique :** une correction d'interface doit presque toujours être
faite **deux fois**. Quand un choix produit doit rester unique, il vit dans
`src/lib/` et les deux côtés l'importent (voir §7).

### Où vit chaque écran

| Écran | Route | Téléphone | Bureau |
|---|---|---|---|
| Accueil | `/` | `mobile/screens/tv/TVHome.tsx` | `components/tvdesktop/TVDesktopHome.tsx` |
| Catégorie | `/category/[id]` | `mobile/screens/category/[id]/CategoryClient.tsx` | `app/category/[id]/CategoryClient.tsx` |
| Planificateur | `/tv-planner` | `mobile/screens/tv/TVPlanner.tsx` | même fichier, `embedded` |
| Liste de courses | `/tv-courses` | `mobile/screens/tv/TVCourses.tsx` | même fichier, `embedded` |
| Ma cave | `/ma-cave` | `mobile/screens/tv/MaCave.tsx` | idem |
| Recherche | overlay | `mobile/screens/tv/TVSpotlight.tsx` | `components/SpotlightSearch` |
| Fiche recette | feuille | `mobile/components/RecipeDetails` | `components/RecipeDetails` |

> **Piège n° 1 — la fiche recette.** La vue réellement affichée est la
> **feuille** (`RecipeDetails`, ouverte par-dessus l'écran courant), **pas** la
> route `/recipe/[id]` (`RecipeClient`), qui ne sert qu'aux liens entrants et au
> référencement. Toute modification de l'affichage d'une recette se fait dans
> les deux `RecipeDetails`.

> **Piège n° 2 — l'ancien planificateur.** `/meal-planner` existe encore
> (grille 7 × 2, style d'origine). Le planificateur réel des deux côtés est
> `/tv-planner`. Les deux écrivent la **même** clé `meal-planner-week` : ils
> sont interchangeables, mais seul `/tv-planner` reçoit les évolutions.

---

## 3. Le pipeline des recettes

### 3.1 De la vidéo à WordPress — `tiktok-bot/`

Un raccourci iOS ajoute une URL TikTok dans `tiktok-bot/queue.json` et pousse le
commit. Le workflow **`.github/workflows/auto-recipe.yml`** se déclenche sur ce
chemin (et repasse toutes les heures à H:15, pour ne pas dépendre du Mac).

Le bot :
1. récupère la vidéo et son descriptif ;
2. **écoute la bande son** en plus de lire les sous-titres — beaucoup de
   recettes ne sont énoncées qu'à l'oral ;
3. rédige titre, description, ingrédients, étapes, tags ;
4. publie sur WordPress.

Les 177 recettes qui étaient arrivées sans étapes venaient d'une limite du bot,
pas des vidéos : 39 sur 50 avaient tout dans le descriptif TikTok, récupérable
par oEmbed. C'est l'objet des commits « rattrapage » de septembre 2026.

### 3.2 Les photos — `scripts/generate-recipe-images.js`

Aucune photo Google n'est servie depuis le 26 août 2026 : les 648 recettes ont
une **image générée d'après la vidéo**, pour des raisons de droits. Deux
réglages ont fait toute la différence :

- prendre l'image d'accroche **4 secondes avant la fin** de la vidéo ;
- un prompt de vision qui **accepte** les mains et les sous-titres au lieu de
  rejeter l'image.

Chaîne de génération : Cloudflare → fal. Chaque photo est écrite en deux
tailles (`src/lib/recipe-photo.ts`) :

- `<id>-carte.webp` — 760 px, ~110 ko, c'est ce que pointe `recipe.image` ;
- `<id>.webp` — 1200 px, ~270 ko, pour la fiche ouverte.

#### Changer la photo d'une recette

Deux chemins, deux scripts. Les deux finissent pareil : WordPress **puis** le
site, en un seul déploiement même si on a traité cinq recettes.

**1. La refaire automatiquement, d'après la vidéo.**

```bash
npm run photo:refaire
```

Demande la recette (numéro **ou** nom, accents indifférents), retélécharge la
vidéo TikTok, en lit les **4 premières et les 4 dernières secondes**, décrit le
vrai plat, régénère la photo aux deux tailles, propose d'en enchaîner d'autres,
puis envoie tout.

> Ce script passait `--force` mais **pas `--video`** : il générait donc depuis
> le texte de la recette sans jamais regarder la vidéo, alors que son en-tête
> promettait le contraire. Corrigé le 8 septembre 2026.

**2. Poser une photo qui vient d'ailleurs (ChatGPT, un appareil photo).**

```bash
npm run photo:perso
```

Demande la recette, puis le fichier — qu'on peut **glisser depuis le Finder**.
Il recadre au centre en 3:4, écrit les deux tailles en WebP, archive l'ancienne
photo sur le Bureau, puis envoie tout. Il accepte PNG, JPEG et WebP, de
n'importe quelles dimensions.

Si les deux `.webp` ont déjà été déposés à la main dans `public/recipes-ia`,
répondre **Entrée** deux fois à la question du fichier : il saute la conversion
et se contente d'envoyer. Ce chemin **refuse** de continuer si aucun des deux
fichiers n'a réellement changé — c'est git qui tranche, pas la simple présence
des fichiers.

Après chaque conversion, la paire est relue et ses dimensions affichées :

```bash
node scripts/verifier-paire-photo.js 7467
```

Il vérifie les deux largeurs (1200 / 760) **et** que les deux fichiers montrent
bien la même photo, par comparaison d'empreintes 16×16. Remplacer une seule des
deux tailles est la panne la plus sournoise du projet : la carte change, la
fiche garde l'ancienne image, et ça ne se voit qu'une fois en ligne.

La brique de conversion est utilisable seule :

```bash
node scripts/convertir-photo.js 7467 ~/Downloads/escalope.png
```

**Sans passer par le Terminal.** Les deux chemins ont un lanceur à
double-cliquer dans `~/Downloads/wordpress` : « 🖼️ Refaire une photo de
recette » et « 🎨 Poser ma propre photo ». Ils ne contiennent aucune logique —
ils appellent les scripts ci-dessus. Une copie de sauvegarde est versionnée
dans `scripts/lanceurs/` (voir son README : le chemin du projet y est écrit en
dur).

#### Rattrapage en masse

```bash
npm run photos:manquantes
```

```bash
npm run photos:wordpress
```

### 3.3 De WordPress au dépôt — `sync-recipes.js`

Le plugin WordPress envoie un `repository_dispatch` à chaque publication ou
modification ; **`wp-sync.yml`** lance `sync-recipes.js`, plus un filet de
sécurité chaque nuit à 3 h. Le script :

- lit l'API WordPress et réécrit `src/data/mockData.ts` **et**
  `src/mobile/data/mockData.ts` ;
- **traduit** automatiquement les recettes non francophones (ingrédients et
  étapes, pas le titre) via Groq ;
- pose des tags que WordPress ne connaît pas — par exemple le thème « Pâtes »,
  avec ses pièges (`pâte` au singulier = pâte à tarte ; « pâtes de fruits » =
  confiserie) ;
- enrichit les fiches **restaurant** via Foursquare (note, prix, horaires) puis
  OpenStreetMap (adresse, terrasse).

### 3.4 Le pré-calcul de l'accueil — `scripts/build-home-data.js`

Lancé par `prebuild`, donc à chaque déploiement. L'accueil chargeait le
catalogue entier : 1,36 Mo de JSON dont 78 % ne sert qu'une fois une fiche
ouverte. Le coût n'est pas le téléchargement (264 ko gzip) mais **l'analyse et
l'exécution de 1,5 Mo de JavaScript sur le fil qui doit répondre au doigt.**

Le script découpe le catalogue en trois :

| Fichier généré | Contenu |
|---|---|
| `mobile/data/home-recipes.ts` | ce que l'accueil affiche, sans étapes ni ingrédients ni embed |
| `mobile/data/home-details.ts` | étapes et ingrédients, rechargés après la peinture |
| `mobile/data/home-videos.ts` | les embeds TikTok, même traitement |

`home-recipes.ts` porte en plus les **réponses** aux questions que l'accueil
posait au catalogue : `tiktokId`, `est` / `timed` (temps et difficulté, qui
étaient recalculés en relisant les étapes des 662 recettes à chaque démarrage),
et `tagsStricts` / `tagsLarges` / `sale` (appartenance aux rangées thématiques).

Résultat : le paquet de l'accueil est passé de **1502 ko à 499 ko**.

> Le script **appelle les vraies fonctions de l'application** (`timing.ts`,
> `themes.ts`, `recipe-timing.ts`) au lieu d'en recopier les règles — c'est ce
> qui empêche le pré-calcul et l'affichage de diverger en silence.

**Ces trois fichiers sont générés : ne jamais les éditer à la main.**

---

## 4. Les données

### 4.1 Le catalogue (dans le dépôt)

`src/data/mockData.ts` et `src/mobile/data/mockData.ts` — mêmes recettes, un
fichier par côté. Le type est dans `src/types/index.ts` :

```ts
interface Recipe {
    id: string;             // = l'id du post WordPress
    title, description, image;
    category: 'aperitifs' | 'entrees' | 'plats' | 'desserts' | 'patisserie'
            | 'restaurant' | 'vegetarien' | ... ;
    difficulty, prepTime, cookTime, servings;   // ⚠ voir l'encadré
    videoHtml?;             // l'embed TikTok — l'id vidéo y est en dur
    ingredients: Ingredient[];
    steps: string[];
    tags?: string[];
    restaurant?: RestaurantInfo;    // fiches « Comme au resto »
}
```

> **Les temps de WordPress ne sont pas fiables.** `prepTime`, `cookTime` et
> `difficulty` sont recalculés **depuis les étapes** par
> `src/lib/recipe-timing.ts` : cuisson = somme des durées écrites dans les
> étapes, préparation = estimation par mots-clés des étapes sans durée,
> difficulté = surtout le nombre d'étapes. C'est la règle **unique** : tout
> affichage de durée passe par `estimateRecipeTiming`, jamais par le champ brut.

### 4.2 Supabase (ce qui appartient à l'utilisateur)

| Table | Rôle |
|---|---|
| `favorites` | favoris, par `user_id` — le localStorage n'est qu'un cache |
| `ratings` | notes /5, une ligne par (utilisateur, recette) |
| `meal_plans` | le planning de la semaine |
| `shopping_state` | l'état de la liste de courses |
| `cave_state` | « Ma cave » |
| `cooking_log` | carnet : « j'ai cuisiné », note perso, photo |
| `comments`, `recipe_likes`, `recipe_notes`, `personal_notes` | fiche recette |

Deux clients distincts : `src/lib/supabase.ts` (bureau) et
`src/mobile/lib/supabase.ts` (téléphone).

> **Prérequis d'authentification** — dans le tableau de bord Supabase, *Site
> URL* et *Redirect URLs* doivent valoir `lesrecettesmagiques.fr`. Le
> `redirectTo` de l'OAuth force déjà le domaine en `.fr`, mais sans ce réglage
> la connexion retombe sur l'URL Vercel.

### 4.3 localStorage — les clés qui comptent

| Clé | Contenu |
|---|---|
| `meal-planner-week` | le planning (`/tv-planner` **et** `/meal-planner`) |
| `magic-shopping-list` | les recettes envoyées aux courses |
| `meal-week-checked` | lignes cochées de la semaine |
| `favorites` | cache des favoris (Supabase fait foi) |
| `tv-library-v1` | bibliothèque du menu, jetons `c:` / `t:` / `p:` |
| `recipe-steps-<id>` | avancement d'une recette en cours de préparation |
| `wine-pairing-v1-<id>` | accord mets-vin déjà calculé |
| `theme` | clair / sombre |
| `hasSeenMagicSplash-v8` | écran d'accueil déjà vu (sessionStorage) |

> **Toujours écrire via `src/lib/stockage.ts` (`ecrireStock`).**
> `localStorage.setItem` **lève une exception** quand le quota est atteint
> (~5 Mo sur Safari, et la cave y range des photos en base64) : une écriture
> refusée faisait tomber l'application entière.

---

## 5. L'accueil « Apple TV+ »

Depuis le 14 août 2026, l'accueil mobile **est** `TVHome` (les anciens accueils
ont été supprimés ; pour revenir en arrière, le tag `v-avant-accueil-tv`). Le
bureau a son pendant, `TVDesktopHome`.

**Structure.** Un héros plein écran collant, puis une feuille de contenu qui
remonte par-dessus au défilement, puis des rangées horizontales. Les cartes ont
des formats volontairement inégaux, jamais improvisés :

```
small   124 × 124   (1/1)    thèmes secondaires
poster  132 × 198   (2/3)    affiches verticales
square  148 × 148   (1/1)    catégories courtes
medium  178 × 134   (4/3)    format courant
wide    272 × 170   (16/10)  rangées mises en avant
huge    300 × 400   (3/4)    pancartes de fin de feed
```

**Les rangées** viennent de `mobile/screens/tv/themes.ts` (`thematicThemes`),
source unique du carrousel et de la grille. Une recette entre dans un thème par
`matchesTag`, à partir des tags pré-calculés au build.

**Ce qu'on trouve sur une vignette** (tous en position absolue sur `.thumb`) :

| Marque | Coin | Fichier |
|---|---|---|
| Coche « déjà faite » | haut gauche | `components/DejaFaite` |
| **Note moyenne ★** | haut gauche (décalée si la coche est là) | `.cardNote` |
| « + » / croix « plus tard » | haut droite | `.laterBtn` |
| Titre incrusté | bas | `.overlayLabel` |
| Barre de progression | bas | `.progressTrack` |

**Autres écrans notables :** `TVCourses` (liste de courses), `TVPlanner`
(planificateur), `MaCave`, `TVTrophies` (palmarès), `TVSpotlight` (recherche),
`NavDrawer` (menu, ouvert au glissement depuis le bord gauche).

---

## 6. Le planificateur — `mobile/screens/tv/TVPlanner.tsx`

**Parti pris : un jour par écran**, balayé horizontalement, au lieu de la grille
7 × 2 qui écrasait quatorze cases sur la largeur d'un téléphone.

Deux modes :

- **Semaine** — Lun → Dim, deux créneaux (Midi / Soir). Un plat servi nu (viande
  ou poisson sans féculent ni légume) ouvre une ligne « Accompagnement »,
  stockée dans `recipe.side`.
- **Jour J** — un repas complet : apéritif, entrée, plat, accompagnement,
  dessert, pâtisserie. Chaque carte n'accepte que sa catégorie.

**La règle des catégories.** Midi et Soir acceptent **tout ce qui se cuisine**
quand c'est la main de l'utilisateur qui pose. « Composer » et « Surprends-moi »,
eux, restent sur les plats — un remplissage automatique ne sert pas une tarte un
mardi soir.

**« Poser une recette ».** Depuis une carte ou une fiche, « Choisir dans le
planificateur » met la recette **en main** : l'écran s'ouvre, les créneaux qui
l'acceptent s'éclairent et disent « Poser ici », une barre en bas rappelle ce
qu'on tient. La recette voyage dans `sessionStorage` (le geste traverse une
navigation, un état React n'y survivrait pas) avec une durée de vie de dix
minutes.

**Source unique** : `mobile/screens/tv/plan.ts` — mêmes cases, mêmes règles et
même stockage pour l'écran, le volet `PlanPicker` et les deux planificateurs de
bureau.

**Pièges connus, déjà réglés — ne pas les réintroduire :**

- framer-motion écrit sa propre `transform` et effaçait le `translateX(-50%)`
  qui centrait la barre « en main » : elle se centre par ses marges ;
- le calque du planificateur de bureau porte une transformation, ce qui recale
  un `position: fixed` sur lui : la barre sort par un portail ;
- on ne peut pas relâcher la recette « en main » au démontage : React monte deux
  fois en développement, et le premier nettoyage l'effacerait avant qu'on la
  voie ;
- **la barre du bas est fixée** : sa hauteur est prise sur les cartes.
  `.planSlide` réserve `190px` de marge basse pour elle. Si un libellé de la
  barre passe à la ligne, la barre grandit, dépasse cette réserve et vient
  couper le créneau du soir en deux. C'était le bug corrigé le 8 septembre 2026
  (§10).

---

## 7. Les règles partagées — `src/lib/`

Quand un choix produit doit être identique des deux côtés, il vit ici. C'est le
seul rempart contre la dérive entre `components/` et `mobile/components/`.

| Module | Ce qu'il tranche |
|---|---|
| `recipe-timing.ts` | **temps et difficulté** — recalculés depuis les étapes |
| `mealClassify.ts` | ce qu'est un plat, une protéine, un accompagnement, du sucré |
| `searchFilters.ts` | les groupes de filtres (catégories, pays, tendances) |
| `quantites.ts` | lecture d'une ligne d'ingrédient — partagé prix / Nutri-Score |
| `recipe-price.ts` | fourchette de prix (bas = hard-discount, haut = grande surface) |
| `nutriscore.ts` | Nutri-Score calculé à la volée, rien n'est stocké |
| `rayons.ts` | rangement des ingrédients par rayon (affichage seulement) |
| `ratings.ts` | notes /5 — cache mémoire partagé, une requête pour tout |
| `favorites.ts` | favoris, Supabase source de vérité |
| `cooking-timeline.ts` | déroulé « un seul cuisinier » : actif / passif |
| `stockage.ts` | écriture localStorage qui ne fait pas tomber l'app |
| `chunkPerime.ts` | « Loading chunk failed » = page plus vieille que le site |
| `personalize.ts` | « Pour toi » — apprentissage passif, sans onboarding forcé |
| `recipeSmartSearch.ts` | recherche locale, secours quand le LLM est absent |
| `legal.ts` | adresse de contact et délai de retrait, cités par 4 pages |

---

## 8. Les fonctions qui appellent une IA

| Route | Ce qu'elle fait |
|---|---|
| `/api/recipe-finder` | l'assistant : une demande en français → des recettes |
| `/api/menu-ia` | compose une semaine équilibrée et variée |
| `/api/wine-pairing` | trois vins pour une recette, par gamme de prix |
| `/api/wine-lookup` | lit une étiquette (vision) puis retrouve la bouteille |

**Ordre des fournisseurs : Groq (gratuit) → Gemini (gratuit) → Anthropic
(payant).**

> **Groq retire ses modèles sans préavis.** `llama-3.3-70b-versatile` a disparu
> du catalogue : l'API répondait `404 model_not_found` et la recherche, le menu
> **et** l'accord des vins tombaient tous les trois d'un coup. Un 404 sur ces
> routes, c'est d'abord un nom de modèle à vérifier. Quotas : 8000 requêtes/jour,
> 1000 jetons de sortie par minute — d'où les 429 fréquents à la traduction.

`/api/recipe-finder` pré-filtre le catalogue (200 recettes + 3 tags) avant
d'appeler le modèle, sinon la requête dépasse la taille limite (413). Les
restaurants sont inclus, enrichis de leur ville, leur type et « terrasse ».
`accordCave.ts` aiguille « je veux un vin de ma cave » **avant** le modèle : la
question porte sur la cave, pas sur une recette.

---

## 9. Autres écrans et fonctions

**Liste de courses** — « barrer » et « cocher » ne sont pas la même chose : les
boutons *Partager* et *Magasin* n'apparaissent que si au moins une ligne est
cochée, et ne visent **que les lignes cochées**, dans les quatre vues.

**Ma cave** — deux étagères (cave / bues), glissé en Pointer Events (souris 3 px,
doigt 260 ms), tuile « Ajouter » en bout de grille. Le scan d'étiquette
récupère une **vraie photo de bouteille** via Vivino.

**Comme au resto** — note personnelle et note globale (`StarRating`), pilule
« j'ai testé », galerie `RestaurantGallery`, « Autres restaurants ».

**Thème clair / sombre** — `data-theme` est posé au démarrage dans
`layout.tsx`. **Plus aucun `@media (prefers-color-scheme)`** : c'est ce qui
rendait la fiche blanche sur blanche.

**Référencement** — rendu indexable le 11 août 2026 : `noindex` retiré de
`robots.txt` et du layout, `sitemap.ts`, JSON-LD `Recipe` et
`generateMetadata` par recette.

**Pages légales** — quatre pages, contact `contact@lesrecettesmagiques.fr`
(IONOS Basic, IMAP), retrait d'une vidéo sous 48 h, textes centralisés dans
`src/lib/legal.ts`.

---

## 10. Journal des décisions récentes

**8 septembre 2026 — la note sur les vignettes.**
La note moyenne s'affiche désormais **sur la photo**, en pastille de verre
sombre : haut gauche sur l'accueil (le bas appartient au titre incrusté et à la
barre de progression), bas gauche en catégorie (le titre y est en haut).
L'étoile seule est colorée. Rien ne s'affiche tant que la recette n'a pas d'avis
— une note inventée vaut moins que pas de note du tout.

Point de performance : `useRatingStats()` pose un écouteur et garde son propre
état. Appelé dans chacune des ~480 cartes de l'accueil, il en poserait autant.
L'écran s'abonne donc **une seule fois**, tout en haut, et fait descendre le
résultat par un contexte (`NotesCtx`).

**8 septembre 2026 — la barre du planificateur.**
« Composer », « Effacer » et « Remplir ma liste de courses » demandaient 471 px
de large. Sur 375, le dernier libellé passait à trois lignes, la barre montait à
217 px et — comme elle est fixée en bas et que son dégradé restait transparent
là où les boutons se trouvent — venait couper le créneau du soir en deux.
Corrigé par : marges resserrées et libellé court (« Liste de courses ») sous
430 px, `white-space: nowrap` sur les trois boutons, et un dégradé plein noir
sous les boutons. Barre mesurée après correction : **177 px**, sous les 190 px
que `.planSlide` réserve.

**8 septembre 2026 — le faux « déjà en place » de `photo:perso`.**
Le chemin sans image ne vérifiait que l'EXISTENCE des deux fichiers — vraie de
toutes les recettes du catalogue. Un appui sur Entrée par réflexe suffisait donc
à s'y engager : le script annonçait « on les enverra tels quels », puis l'envoi
répondait « aucune photo modifiée, rien à envoyer ». Deux messages
contradictoires dans la même exécution, et l'impression que seule la vignette
avait été traitée. Il exige désormais un vrai changement (jugé par git), la
question de l'image se repose une fois avant d'accepter le silence, et chaque
conversion est suivie d'un contrôle de la paire.

**8 septembre 2026 — les deux chemins pour changer une photo.**
`photo:refaire` ne passait pas `--video` : il travaillait au texte de la recette
et ne regardait jamais la vidéo, contrairement à ce qu'annonçait son en-tête.
Corrigé. Et `photo:perso` est apparu à côté : jusque-là, une photo venue
d'ailleurs n'avait aucun chemin — il fallait recopier une ligne de `sharp` à la
main, deviner les largeurs et se tromper de rapport une fois sur deux.

**26 août 2026** — les 648 recettes passent en photo générée d'après la vidéo ;
plus aucune photo Google n'est servie.

**19 août 2026** — file d'attente TV+ terminée et poussée (`b695ae9`) ; la règle
unique des temps (`estimateRecipeTiming`) s'applique partout.

**14 août 2026** — l'accueil mobile devient `TVHome` en production.

---

## 11. Travailler sur ce dépôt

### Lancer le site

```bash
npm run dev
```

`dev` lance aussi le bot TikTok. Pour l'interface seule :

```bash
npm run dev:ui
```

### Les trois pièges de l'environnement local

**1. Le rechargement à chaud est mort.** Le dossier est sous CloudStation
(synchronisé) : le surveillant de fichiers de Next ne voit pas les
modifications. **Après chaque modification, relancer `npm run dev`** — sinon on
teste du code périmé, voire on récolte `originalFactory.call undefined`.

**2. Ne jamais lancer `next build` pendant que `next dev` tourne** : cela
corrompt `.next` (`Cannot find module './XXX.js'`).

**3. Les photos ne chargent pas si le NAS est hors réseau.** `.env.local` porte
`IMAGE_PROXY_TIMEOUT_MS` pour échouer vite : sans lui, les six connexions du
navigateur saturent et les morceaux de code de Next tombent en délai
d'attente. **À remettre en commentaire** sur le réseau du NAS, où 250 ms
couperait des photos qui avaient le temps d'arriver.

### Vérifier une interface quand le volet d'aperçu refuse de peindre

Le volet d'aperçu, masqué, ne peint plus la page : les captures sortent noires.
Le contournement fiable est de piloter Chrome sans interface par CDP (Node 22 a
un WebSocket natif, rien à installer) : y désactiver l'écran d'accueil, le
bandeau cookies et l'astuce de première visite avant que la page ne s'exécute,
puis capturer.

```
sessionStorage['hasSeenMagicSplash-v8'] = 'true'
localStorage['cookie-consent-v1']       = 'refused'
localStorage['magic-tips-seen-v1']      = '["accueil","planner","courses"]'
```

### Avant de pousser

```bash
npm run build
```

- `next build` **avant** chaque push ;
- tester aussi **sans** `.env` : la production ne doit pas dépendre d'une clé
  absente ;
- toute évolution de base doit être **additive** ;
- cible `es2017`.

### Scripts de maintenance

```bash
npm run sync-recipes
```

```bash
npm run wp:verifier
```

```bash
npm run nutri:verifier
```

---

## 12. Ce qui reste ouvert

- **Bureau ancien style** : favoris, recherche, profil et courses ne sont pas
  encore passés en TV+ (le téléphone l'est).
- **Performance de l'accueil** : le paquet est descendu à 499 ko, mais les 478
  images sont toujours montées d'un coup, et framer-motion pèse encore.
- **WordPress sur le NAS est instable** : l'endpoint bat (500 base de données →
  200 → injoignable), avec une IP publique en dur. Le pipeline TikTok garde la
  recette en file et réessaie chaque heure.
- **Vidéos TikTok** : Safari bloque les cookies tiers → « Player error ». Le
  repli photo a été durci ; réhéberger les clips a été écarté (droits).
- **`/api/wine-pairing` est cassé** tant que le nom de modèle Groq n'est pas
  remis à jour (§8).
- **Un bug de poids-pièce** subsiste dans `recipe-price`.
