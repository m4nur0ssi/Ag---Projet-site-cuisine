# Plan d'implémentation : MagicFilterBar Liquid Expansion

**Objectif :** Transformer le MagicFilterBar en une interface "liquid" iOS 26 parfaitement fluide et premium, remplaçant les émojis par des SVGs et stabilisant les transitions du Control Hub.

**Architecture :** Utilisation de `framer-motion` avec le prop `layout` sur le conteneur principal du hub pour gérer l'étirement lisse. Séparation des composants d'icônes SVG pour plus de clarté.

**Stack technique :** React, Next.js, Framer Motion, Vanilla CSS Modules.

---

### Tâche 1 : Remplacement des Émojis par des SVGs de Design
**Status :** TODO
- **Modifier :** `src/components/MagicFilterBar/Icons.tsx` (Nouveau fichier)
- **Modifier :** `src/components/MagicFilterBar/MagicFilterBar.tsx`
- **Étape 1 (Test) :** Vérifier que les composants d'icônes (`IconBurger`, `IconEarth`, etc.) sont importés au lieu de chaînes de texte (émojis).
- **Étape 2 :** FAIL (Si icons n'existent pas encore).
- **Étape 3 (Code) :** Créer un set d'icônes minimalistes en SVG encapsulées dans des composants React.
- **Étape 4 :** PASS.
- **Étape 5 (Commit) :** `git add . && git commit -m "design: replace emojis with custom SVG icons in MagicFilterBar"`

### Tâche 2 : Implémentation du Conteneur "Layout" pour le Control Hub
**Status :** TODO
- **Modifier :** `src/components/MagicFilterBar/MagicFilterBar.tsx`
- **Étape 1 (Test) :** Vérifier que le changement entre l'état "default" et "active" ne provoque plus de scroll-jump ou de "snap" brusque de largeur.
- **Étape 2 :** FAIL (L'implémentation actuelle par `AnimatePresence mode="wait"` provoque des sauts de taille).
- **Étape 3 (Code) :** Supprimer `mode="wait"`, passer le hub parent en `motion.div` avec `layout`, et ajuster les marges (`initial`, `animate`).
- **Étape 4 :** PASS.
- **Étape 5 (Commit) :** `git add . && git commit -m "feat: enable layout animations for fluid hub expansion"`

### Tâche 3 : Raffinement Glassmorphic et Effets de Glow
**Status :** TODO
- **Modifier :** `src/components/MagicFilterBar/MagicFilterBar.module.css`
- **Étape 1 (Test) :** Vérifier que le `hubActive` possède un flou de surface (`backdrop-filter`) plus important et une bordure adaptative.
- **Étape 2 :** FAIL (Flou actuel à 25px, bordure fixe à 0.1 opacity).
- **Étape 3 (Code) :** Monter le flou à 40px, ajouter un dégradé de bordure subtil (`border-image` ou pseudo-élément) et optimiser le contraste sur les thèmes clairs.
- **Étape 4 :** PASS.
- **Étape 5 (Commit) :** `git add . && git commit -m "polish: enhance glassmorphism and adaptive glows"`
