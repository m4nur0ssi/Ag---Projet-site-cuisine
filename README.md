# Les Recettes Magiques - Guide de démarrage

## ✅ Application créée avec succès !

L'application est fonctionnelle et utilise actuellement les **données de démonstration** (mock data) car le certificat SSL de votre site WordPress a un problème.

## 🚀 Lancer l'application

### Option 1 : Avec CMD (recommandé)
```cmd
cd "c:\Users\manu\CloudStation\Ag - Projet app cuisine"
npm install
npm run dev
```

### Option 2 : Résoudre PowerShell
Ouvrir PowerShell en **Administrateur** :
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Puis :
```powershell
cd "c:\Users\manu\CloudStation\Ag - Projet app cuisine"
npm install
npm run dev
```

## 🔧 Problème SSL WordPress

Votre site `lesrec3ttesm4giques.fr` a un certificat SSL invalide. Solutions :

### Solution temporaire (développement uniquement)
J'ai créé un fichier `.env.local` qui désactive la vérification SSL.

### Solution permanente
1. **Renouveler le certificat SSL** sur votre NAS
2. **Utiliser HTTP en local** : Modifier `src/lib/wordpress.ts` ligne 3 :
   ```typescript
   const WORDPRESS_API_URL = 'http://lesrec3ttesm4giques.fr/wp-json/wp/v2';
   ```

## 📱 Fonctionnalités actuelles

✅ Page d'accueil avec "Recette du Jour"  
✅ Catégories magiques (Entrées, Plats, Desserts, Potions)  
✅ Grille de recettes tendances  
✅ Page de détail avec ingrédients et instructions  
✅ Navigation bottom bar  
✅ Design premium avec glassmorphisme  
✅ Responsive (mobile, tablette, desktop)  
✅ **Intégration WordPress REST API** (avec fallback)  

## 🔄 Intégration WordPress

Une fois le problème SSL résolu, l'application récupérera automatiquement :
- Toutes les recettes publiées
- Les images featured
- Les catégories
- Le contenu (ingrédients et étapes)

### Pour des données structurées optimales

Installez **Advanced Custom Fields (ACF)** sur WordPress et créez ces champs :
- `prep_time` (nombre)
- `cook_time` (nombre)  
- `servings` (nombre)
- `difficulty` (select: facile/moyen/difficile)
- `ingredients` (texte long ou répéteur)
- `steps` (texte long ou répéteur)
- `is_featured` (vrai/faux)

## 📂 Structure du projet

```
src/
├── app/
│   ├── page.tsx              # Page d'accueil
│   ├── recipe/[id]/page.tsx  # Page de détail recette
│   └── globals.css           # Styles globaux
├── components/
│   ├── Header/               # En-tête
│   ├── BottomNav/            # Navigation
│   ├── RecipeCard/           # Carte recette
│   └── CategoryScroll/       # Scroll catégories
├── lib/
│   └── wordpress.ts          # Service API WordPress
├── data/
│   └── mockData.ts           # Données de démo
└── types/
    └── index.ts              # Types TypeScript
```

## 🎨 Personnalisation

Les couleurs et le thème sont dans `src/app/globals.css` :
- `--color-accent-purple`: Couleur principale
- `--color-accent-gold`: Couleur secondaire
- `--glass-bg`: Effet glassmorphisme

## 🐛 Dépannage

### L'app ne démarre pas
- Vérifier que Node.js est installé : `node --version`
- Supprimer `node_modules` et refaire `npm install`

### Les recettes WordPress ne s'affichent pas
- Vérifier que le site est accessible
- Regarder les logs dans la console du navigateur
- L'app utilisera automatiquement les données mock en cas d'erreur

## 📞 Prochaines étapes

1. ✅ Résoudre le problème SSL
2. 🔜 Ajouter la page de recherche
3. 🔜 Ajouter le profil utilisateur
4. 🔜 Système de favoris persistant
5. 🔜 Mode cuisine pas-à-pas

---

**Projet créé par Antigravity** 🧪✨
