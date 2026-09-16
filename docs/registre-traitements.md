# Registre des activités de traitement

**Les Recettes Magiques** — lesrecettesmagiques.fr
Tenu au titre de l'article 30 du RGPD. Dernière mise à jour : 16 septembre 2026.

À relire à chaque nouvelle donnée collectée, nouvelle table Supabase ou nouveau
prestataire. Le détail technique de chaque ligne est dans `docs/rgpd.md`.

## Responsable de traitement

| | |
| --- | --- |
| Nom | Manuel Rossi |
| Contact | contact@lesrecettesmagiques.fr |
| Délégué à la protection des données | Aucun (non obligatoire : site personnel, pas de traitement à grande échelle ni de données sensibles) |

## Sous-traitants

| Prestataire | Rôle | Localisation des données | Encadrement du transfert |
| --- | --- | --- | --- |
| Vercel Inc. | Hébergement du site, mesure d'audience sans cookie | États-Unis (exécution), CDN mondial | Clauses contractuelles types, Data Privacy Framework |
| Supabase Inc. | Authentification, base de données | UE (base) ; société américaine | Clauses contractuelles types |
| Google Ireland Ltd. | Google Analytics 4 (après consentement), connexion « Continuer avec Google » | UE / États-Unis | Clauses contractuelles types, Data Privacy Framework |
| Groq Inc. | Recherche et assistant IA (texte des questions, sans identifiant) | États-Unis | Clauses contractuelles types |
| Google (Gemini), Anthropic PBC | Repli de l'assistant IA quand Groq ne répond pas | États-Unis | Clauses contractuelles types |
| IONOS SE | Boîte e-mail de contact | Allemagne | — (UE) |

---

## 1. Comptes utilisateurs

| | |
| --- | --- |
| Finalité | Permettre la synchronisation des favoris, menus, courses et cave entre appareils |
| Base légale | Exécution du service demandé (art. 6-1-b) |
| Personnes concernées | Visiteurs qui créent un compte (facultatif) |
| Données | Adresse e-mail, nom et photo de profil fournis par Google, identifiant technique |
| Destinataires | Supabase (sous-traitant), Google (fournisseur d'identité) |
| Durée de conservation | Tant que le compte existe ; effacement immédiat par « Supprimer mon compte », sous 30 jours sur demande par e-mail |
| Sécurité | Connexion OAuth (pas de mot de passe stocké), règles d'accès par ligne (RLS), HTTPS |

## 2. Contenus et préférences liés au compte

| | |
| --- | --- |
| Finalité | Favoris, notes personnelles, notes et commentaires publics, planning de repas, liste de courses, cave à vin, journal de cuisine, menus partagés, recettes ajoutées |
| Base légale | Exécution du service demandé (art. 6-1-b) |
| Personnes concernées | Titulaires d'un compte |
| Données | Contenus saisis, rattachés à l'identifiant du compte ; pseudo choisi pour les commentaires |
| Destinataires | Supabase ; les commentaires, pseudos et menus partagés sont visibles publiquement |
| Durée de conservation | Tant que le compte existe ; effacés avec lui (liste : `src/lib/tables-personnelles.json`) |
| Sécurité | RLS Supabase, écriture sous l'identité de l'utilisateur, suppression par clé de service côté serveur uniquement |

## 3. Préférences locales (sans compte)

| | |
| --- | --- |
| Finalité | Faire fonctionner le site sans compte (favoris, courses, planning, thème) |
| Base légale | Intérêt légitime / stockage strictement nécessaire au service demandé |
| Données | Préférences dans le stockage local du navigateur |
| Destinataires | Aucun : rien n'est transmis tant qu'il n'y a pas de compte |
| Durée de conservation | Jusqu'à effacement par l'utilisateur dans son navigateur |

## 4. Consentement aux traceurs

| | |
| --- | --- |
| Finalité | Recueillir et prouver le choix du visiteur |
| Base légale | Obligation légale (art. 82 loi Informatique et Libertés) |
| Données | Choix (accepté/refusé) et date, dans le stockage local |
| Destinataires | Aucun |
| Durée de conservation | 6 mois, puis la question est reposée |

## 5. Mesure d'audience

| | |
| --- | --- |
| Finalité | Compter les visites et les pages consultées |
| Base légale | Google Analytics 4 : consentement (art. 6-1-a). Vercel Web Analytics : intérêt légitime, exemption CNIL (sans cookie, agrégé, sans suivi inter-sites) |
| Données | Pages vues, provenance, type d'appareil ; cookies `_ga`, `_ga_*` pour GA4 uniquement |
| Destinataires | Google (après consentement), Vercel |
| Durée de conservation | GA4 : réglage de la propriété (2 mois par défaut — à vérifier dans Admin › Conservation des données) ; cookies 13 mois |
| Garantie | Le script Google n'est pas téléchargé avant « Accepter » |

## 6. Lecteurs vidéo TikTok

| | |
| --- | --- |
| Finalité | Lire la vidéo d'origine d'une recette |
| Base légale | Consentement : bandeau accepté (lecture automatique) ou geste explicite de lecture |
| Données | Collectées par TikTok selon sa propre politique (le site ne reçoit rien) |
| Destinataires | TikTok, responsable de ses propres traceurs |
| Garantie | Aucune lecture automatique avant consentement |

## 7. Assistant et recherche IA

| | |
| --- | --- |
| Finalité | Répondre aux questions de recherche de recettes et d'accords mets-vins |
| Base légale | Exécution du service demandé |
| Données | Texte de la question, catalogue de recettes, contenu de la cave le cas échéant ; aucun identifiant de compte |
| Destinataires | Groq ; en repli Google (Gemini) ou Anthropic |
| Durée de conservation | Aucune côté site ; selon la politique de Groq côté prestataire |

## 8. Protection contre les abus

| | |
| --- | --- |
| Finalité | Limiter le nombre d'appels aux services d'IA et d'écriture |
| Base légale | Intérêt légitime (sécurité du service) |
| Données | Adresse IP |
| Destinataires | Aucun |
| Durée de conservation | Mémoire vive de l'instance serveur, quelques minutes ; jamais écrite ni recoupée |

## 9. Contact et demandes de retrait

| | |
| --- | --- |
| Finalité | Répondre aux messages, traiter les demandes d'exercice de droits et de retrait de vidéo |
| Base légale | Intérêt légitime ; obligation légale pour les demandes de droits |
| Données | Adresse e-mail, contenu du message |
| Destinataires | IONOS (messagerie) |
| Durée de conservation | 3 ans après le dernier échange |
