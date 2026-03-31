# Guide de Déploiement App Cuisine sur NAS Synology

Dernière mise à jour : 17/02/2026

## 🚀 Étapes de déploiement (Procédure complète)

### 1. Synchronisation des Recettes

Avant de builder, il faut récupérer les dernières recettes depuis WordPress. Cette étape génère le fichier `src/data/mockData.ts` avec les données à jour et les images pointant vers l'IP locale du NAS (`192.168.1.200`).

**Dans un terminal (CMD ou PowerShell) :**

```bash
node sync-recipes.js
```

### 2. Builder l'Application (Génération Statique)

Cette étape compile le code TypeScript et génère un site statique optimisé dans le dossier `out`.

**Important :** Utilisez la commande suivante pour éviter les problèmes de permissions PowerShell.

```cmd
cmd /c "npm run build"
```

Le dossier `out` sera créé à la racine du projet.

### 3. Copier les Fichiers sur le NAS

Le contenu du dossier `out` doit être copié dans le répertoire web de votre NAS.

**Option A : Via l'Explorateur de Fichiers (Recommandé)**
1. Ouvrez `\\192.168.1.200\web` (ou le chemin réseau de votre dossier web)
2. Créez un dossier cible (ex: `recettes`)
3. Copiez **tout le contenu** du dossier `out` (pas le dossier lui-même, mais ce qu'il contient : `index.html`, `_next`, etc.) dans ce dossier `recettes`.

**Option B : Via File Station (DSM)**
1. Connectez-vous à DSM (`http://192.168.1.200:5000`)
2. Ouvrez File Station
3. Naviguez vers le dossier `web/recettes`
4. Cliquez sur **Transférer - Remplacer - Écraser** et glissez-déposez le contenu de `out`.

### 4. Configuration Web Station (Si nécessaire)

Assurez-vous que Web Station est configuré pour servir ce dossier.
Si vous utilisez Apache comme backend, un fichier `.htaccess` peut être nécessaire pour gérer le routage (SPA fallback), bien que Next.js en mode export génère des fichiers HTML pour chaque route (`/recipe/[id].html`).

## ✅ Vérifications Post-Déploiement

1. Accédez à l'application via : `http://192.168.1.200/recettes/` (ou l'URL configurée)
2. Vérifiez que les dernières recettes (ex: "Navettes mascarpone") s'affichent.
3. **Images :** Vérifiez que les images s'affichent bien (elles doivent charger depuis `http://192.168.1.200/wordpress/...`).
4. **Catégories :** Testez la navigation dans les catégories (Apéritifs, Entrées, Plats, Desserts).

## 🔄 Mise à jour Future

Pour mettre à jour le site avec de nouvelles recettes :
1. Publiez sur WordPress.
2. Lancez `node sync-recipes.js` sur votre PC.
3. Lancez `npm run build`.
4. Copiez le contenu de `out` sur le NAS.

---

**Note Technique :**
- L'application est configurée en mode `output: "export"`.
- Les images distantes sont forcées en local (IP 192.168.1.200) lors de la synchro pour garantir l'affichage sur le réseau local.
- La catégorie 'Potions' a été remplacée par 'Apéritifs' pour plus de cohérence.
