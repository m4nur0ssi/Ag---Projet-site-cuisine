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

Une demande arrive par e-mail à `contact@lesrecettesmagiques.fr` ; la politique
s'engage sur trente jours.

```bash
node scripts/supprimer-compte.js quelquun@exemple.fr            # inventaire
node scripts/supprimer-compte.js quelquun@exemple.fr --confirmer # efface
```

Le script vide les douze tables porteuses de données personnelles puis supprime
le compte. **Une table ajoutée au site doit être ajoutée à la liste `TABLES` du
script le jour même** — une table oubliée, c'est une donnée qui survit à la
suppression.

## Adresse IP

Lue uniquement par `src/lib/garde-api.ts` pour limiter les abus sur les routes
d'IA. Elle vit en mémoire vive quelques minutes, n'est ni écrite ni recoupée.

## Régénérer les polices

```bash
node scripts/telecharger-polices.js
```

Recopie à l'identique ce que Google renvoie (mêmes graisses, mêmes plages
Unicode) et déduplique les fichiers. À relancer après tout ajout de graisse.

## Ce qui reste ouvert

- Les liens légaux ne figurent que dans le pied de page des deux accueils
  (`SiteFooter`), pas sur les écrans internes.
- La suppression de compte n'existe pas en libre-service dans le profil : elle
  passe par l'e-mail et le script ci-dessus.
- Pas de registre des traitements écrit (art. 30) — attendu même pour un site
  personnel qui collecte des comptes.
