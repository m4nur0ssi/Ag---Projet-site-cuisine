# Plan d'Implémentation : Synchronisation des Votes Mondiaux (Supabase)

**Objectif** : Synchroniser les votes de recettes globalement à travers tous les utilisateurs et appareils de manière persistante via une base de données Supabase.

**Architecture** : 
- **DB** : Une table `votes` dans Supabase avec `recipe_id` (PK) et `count` (INT).
- **Backend** : Route API Next.js (`/api/votes`) utilisant l'interface REST native de Supabase ou une fonction RPC pour la mise à jour atomique.
- **Frontend** : Composants `VoteButton` et hook de synchronisation en temps réel.

**Stack technique** : Next.js 14, Supabase (REST API), TypeScript.

---

## Tâche 1 : Configuration des Variables d'Environnement
**État** : À FAIRE

1. **Créer** : `.env.local` à la racine (si inexistant).
2. **Copier** le contenu de `.env.example-supabase` :
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://votre-id.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=votre-cle-service-role
   ```
3. **Action Utilisateur** : Remplacer les valeurs par les vrais identifiants (Settings > API dans Supabase).

---

## Tâche 2 : Optimisation DB - Fonction RPC Atomique (Optionnel mais Recommandé)
**État** : À FAIRE (SQL Editor Supabase)

L'implémentation actuelle de l'API fait un "Fetch" puis un "Update" qui n'est pas atomique (risque de perte de données si 2 personnes votent en même temps).

**Action Utilisateur (SQL Editor)** :
```sql
create or replace function increment_vote(rid text)
returns void as $$
begin
  insert into votes (recipe_id, count)
  values (rid, 1)
  on conflict (recipe_id)
  do update set count = votes.count + 1;
end;
$$ language plpgsql;
```

---

## Tâche 3 : Mise à jour de l'API Route (`/api/votes`)
**État** : À FAIRE

**Modifier** : `src/app/api/votes/route.ts`
1. Re-structurer le code pour utiliser la méthode RPC `POST /rpc/increment_vote` (plus sûr et plus simple).
2. Ajouter des logs clairs pour le débogage.

---

## Tâche 4 : Intégration dans le Composant VoteButton
**État** : EN COURS (Optimisation UI/UX)

**Modifier** : `src/components/VoteButton/VoteButton.tsx`
1. S'assurer que le bouton utilise bien l'optimistic UI (déjà présent).
2. Vérifier la gestion des erreurs si Supabase ne répond pas.

---

## Tâche 5 : Tests et Validation
**État** : À FAIRE

1. **Test 1** : Cliquer sur le feu 🔥, rafraîchir la page, vérifier que le compte est persisté.
2. **Test 2** : Vérifier sur un autre appareil (en local ou preview) que le compteur est identique.
3. **Commit** : `feat: synchronisation mondiale des votes via Supabase`
