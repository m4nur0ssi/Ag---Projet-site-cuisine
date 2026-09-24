# Les Recettes Magiques

Site de recettes en français, alimenté par des vidéos TikTok.
En ligne : <https://lesrecettesmagiques.fr> (Vercel).

**Tout le fonctionnement du projet est décrit dans [`ARCHITECTURE.md`](ARCHITECTURE.md)** :
le pipeline TikTok → WordPress → site, les deux arbres téléphone / bureau,
les données, les pièges connus. À lire avant de toucher au code.

## Lancer le site

```bash
npm install
npm run dev:ui     # l'interface seule
npm run dev        # l'interface + le bot TikTok
```

Avant de pousser :

```bash
npm run build
```

## En bref

- **Next.js 14** (App Router), React 18, TypeScript, CSS Modules.
- **Catalogue** : `src/data/mockData.ts`, réécrit par `sync-recipes.js`
  (workflow `wp-sync.yml`) — publier une recette, c'est redéployer.
- **Comptes utilisateurs** : Supabase (favoris, notes, planning, courses, cave).
- **Photos** : générées d'après la vidéo TikTok, voir `AGENTS.md` et
  `ARCHITECTURE.md` §3.2.
- **Bot TikTok** : `tiktok-bot/`, lancé par `auto-recipe.yml`.

## Dossiers

| Dossier | Contenu |
|---|---|
| `src/` | le site (bureau dans `components/`, téléphone dans `mobile/`) |
| `scripts/` | build de l'accueil, photos, vérifications |
| `tiktok-bot/` | import des vidéos TikTok vers WordPress |
| `wordpress-plugin/` | plugin qui prévient le site à chaque publication |
| `chrome-extension-courses/` | extension « courses magiques » |
| `docs/` | plans et notes de conception |
| `archives/` | anciens scripts ponctuels, gardés pour mémoire |

## Clés d'API

Aucune clé ne doit être écrite dans le code : **le dépôt est public**.
Elles vivent dans `.env.local` (site), `tiktok-bot/.env` (bot), les secrets
GitHub Actions et les variables d'environnement Vercel.
