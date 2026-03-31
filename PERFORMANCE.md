# 🎯 Décision : Mode Mock pour l'instant

## Problème
L'appel à WordPress côté serveur est trop lent, même avec cache.

## Solution actuelle
✅ **Données mock** → Chargement instantané !

L'application utilise maintenant les 4 recettes de démonstration pour un chargement ultra-rapide.

## Pour voir vos vraies recettes WordPress

Vous avez 3 options :

### Option 1 : Ajouter vos recettes dans mockData.ts
Copiez manuellement vos recettes WordPress dans le fichier mock.

**Avantages** :
- ⚡ Ultra rapide
- ✅ Fonctionne hors ligne
- 📱 Parfait pour tester

### Option 2 : Charger WordPress côté client
Créer un composant qui charge WordPress après le chargement de la page.

**Avantages** :
- ⚡ Page s'affiche instantanément
- 🔄 Recettes WordPress chargées en arrière-plan
- ✨ Meilleure expérience utilisateur

### Option 3 : Build statique avec vos recettes
1. Récupérer les recettes WordPress au moment du build
2. Générer des pages statiques
3. Déployer sur le NAS

**Avantages** :
- ⚡⚡⚡ Le plus rapide possible
- 📦 Fichiers statiques simples
- 💰 Pas de serveur nécessaire

## Recommandation

**Pour l'instant** : Testez avec les données mock (rapide !)

**Pour production** : Option 3 (build statique) → Ultra rapide + vraies recettes

Voulez-vous que j'implémente l'option 2 ou 3 ?
