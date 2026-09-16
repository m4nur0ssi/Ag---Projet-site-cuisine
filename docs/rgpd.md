# RGPD — ce que le site fait, et où c'est écrit dans le code

Mémo de reprise : chaque promesse de la politique de confidentialité correspond
à une ligne de code. Si l'une change, l'autre doit changer le même jour.

## Rien ne part avant le consentement

| Ce qui pourrait fuir | Où c'est verrouillé |
| --- | --- |
| Google Analytics | `src/app/layout.tsx` — le script n'est **pas téléchargé** avant « Accepter ». Le mode consentement v2 est sur `denied` dès la première ligne de la page, et `window.__chargerMesure()` n'est appelé qu'au clic. |
| Polices Google | `src/app/fonts.css` — les `.woff2` sont dans `public/fonts`, servis par notre domaine. Plus aucun appel à `fonts.googleapis.com` ni `fonts.gstatic.com`. |
| Lecteurs TikTok lancés tout seuls | `src/lib/tiktok-consent.ts` — `tiktokAllowed()` renvoie faux tant que le bandeau n'est pas accepté. Les héros et les cartes gardent leur photo. |
| Lecteurs TikTok demandés par le visiteur | Laissés passer **exprès** : un appui sur une carte, sur le bouton de lecture ou sur l'onglet « Vidéo » vaut consentement pour ce lecteur-là (position CNIL sur le clic-pour-lire). |

Vercel Web Analytics reste chargé sans consentement : pas de cookie, pas
d'identifiant publicitaire, pas de suivi d'un site à l'autre, mesure agrégée —
c'est le cas d'exemption prévu par la CNIL. Il est nommé dans la politique.

## Le choix du visiteur

- Écrit dans `localStorage` (jamais un cookie), daté, **valable six mois** :
  `src/lib/consentement.ts`. Passé ce délai, la question est reposée.
- Se retire aussi facilement qu'il se donne : le lien **« Cookies »** du pied de
  page rouvre le bandeau (`src/components/SiteFooter/BoutonCookies.tsx`).
- « Refuser » et « Accepter » ont la même taille et le même poids visuel.

## Droit à l'effacement

**En libre-service** : menu du compte (avatar) → « Supprimer mon compte » →
confirmation. `src/components/SupprimerCompte` appelle
`src/app/api/supprimer-compte/route.ts`, qui :

1. identifie la personne par son **jeton de session** — jamais par le corps de
   la requête, on n'efface que le compte de celui qui appelle ;
2. vide les tables avec la clé de service, et **s'arrête avant de toucher au
   compte** si une table résiste (pas de lignes orphelines) ;
3. supprime le compte dans `auth.users`.

**Par e-mail** (la politique s'engage sur trente jours) :

```bash
node scripts/supprimer-compte.js quelquun@exemple.fr            # inventaire
node scripts/supprimer-compte.js quelquun@exemple.fr --confirmer # efface
```

Le site et le script lisent la **même liste** : `src/lib/tables-personnelles.json`.
Une table ajoutée au site doit y être ajoutée le jour même — une table oubliée,
c'est une donnée qui survit à la suppression.

## Adresse IP

Lue uniquement par `src/lib/garde-api.ts` pour limiter les abus sur les routes
d'IA. Elle vit en mémoire vive quelques minutes, n'est ni écrite ni recoupée.

## Régénérer les polices

```bash
node scripts/telecharger-polices.js
```

Recopie à l'identique ce que Google renvoie (mêmes graisses, mêmes plages
Unicode) et déduplique les fichiers. À relancer après tout ajout de graisse.

## Liens légaux

- Accueils (mobile et ordinateur) : pied de page complet (`SiteFooter`).
- Partout où le bouton du compte est monté — accueils, tiroir de navigation
  mobile, anciens en-têtes, planificateur mobile : en bas de son menu
  (`LiensLegauxMini`), avec « Supprimer mon compte ».
- Écrans TV internes (courses, planificateur, cave, profil) : pas de bouton du
  compte ; le « Retour » ramène à l'accueil, à un geste du pied de page.

## Registre des traitements

`docs/registre-traitements.md` (art. 30). À relire à chaque nouvelle donnée
collectée ou nouveau prestataire.
