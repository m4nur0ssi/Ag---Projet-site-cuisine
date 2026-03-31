# Guide : Connecter WordPress

## ✅ Étape 1 : Activer CORS sur WordPress

### Option A : Via Code Snippets (recommandé)

1. Connectez-vous à WordPress
2. Allez dans **Extensions → Ajouter**
3. Cherchez "Code Snippets"
4. Installez et activez
5. Allez dans **Snippets → Add New**
6. Titre : "API CORS pour Les Recettes Magiques"
7. Collez ce code :

```php
add_action('rest_api_init', function() {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function($value) {
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Authorization, Content-Type');
        return $value;
    });
}, 15);
```

8. Activez le snippet

### Option B : Via functions.php

1. Allez dans **Apparence → Éditeur de thème**
2. Ouvrez **functions.php**
3. Ajoutez le code ci-dessus à la fin
4. Sauvegardez

## 🔄 Étape 2 : Tester l'API

Ouvrez dans votre navigateur :
```
http://lesrec3ttesm4giques.fr/wp-json/wp/v2/posts
```

Vous devriez voir vos recettes en JSON.

## 🚀 Étape 3 : Déployer la nouvelle version

### Mode Serveur Node.js (pour WordPress dynamique)

1. Sur votre NAS, installez Node.js si ce n'est pas déjà fait
2. Copiez tout le projet sur le NAS
3. Connectez-vous en SSH au NAS
4. Naviguez vers le dossier du projet
5. Lancez :
   ```bash
   npm install
   npm run build
   npm run start
   ```

### Alternative : Garder le mode statique

Si vous préférez garder les fichiers statiques actuels, l'application continuera d'utiliser les données mock. Pour voir les vraies recettes, il faudra rebuilder régulièrement.

## 📊 Vérification

Une fois CORS activé et l'application redéployée :
- ✅ Les vraies recettes WordPress s'afficheront
- ✅ Les images de vos recettes seront visibles
- ✅ Le contenu sera à jour automatiquement
- ✅ Fallback sur mock data si WordPress est inaccessible

## 🎨 Optimisation WordPress (optionnel)

Pour des données mieux structurées, installez **Advanced Custom Fields** et créez ces champs :

- `prep_time` (nombre) - Temps de préparation
- `cook_time` (nombre) - Temps de cuisson
- `servings` (nombre) - Nombre de portions
- `difficulty` (select) - facile/moyen/difficile
- `ingredients` (texte) - Liste des ingrédients
- `steps` (texte) - Étapes de préparation
- `is_featured` (vrai/faux) - Recette du jour

L'application détectera automatiquement ces champs !
