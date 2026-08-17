-- ─────────────────────────────────────────────────────────────────────────────
-- Mise en prod — à exécuter dans Supabase → SQL Editor.
-- Sûr à relancer plusieurs fois (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) FLAMMES PARTAGÉES (bouton flamme, compteur public, 1 vote / user connecté)
create table if not exists public.recipe_likes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  recipe_id  text not null,
  created_at timestamptz default now(),
  primary key (user_id, recipe_id)
);
alter table public.recipe_likes enable row level security;

drop policy if exists "flames readable by all" on public.recipe_likes;
create policy "flames readable by all" on public.recipe_likes
  for select using (true);

drop policy if exists "add own flame" on public.recipe_likes;
create policy "add own flame" on public.recipe_likes
  for insert with check (auth.uid() = user_id);

drop policy if exists "remove own flame" on public.recipe_likes;
create policy "remove own flame" on public.recipe_likes
  for delete using (auth.uid() = user_id);


-- 2) CARNET « J'AI CUISINÉ » — ajout de l'ÉDITION (nouveau : politique UPDATE).
--    La table cooking_log existe déjà (fonctionnalité en prod). On garantit juste
--    que l'auteur connecté peut MODIFIER sa note.
alter table public.cooking_log enable row level security;

drop policy if exists "update own cooking_log" on public.cooking_log;
create policy "update own cooking_log" on public.cooking_log
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- 3) NOTE AU DIXIÈME — la colonne stars doit être numérique (pas integer).
--    À exécuter seulement si stars est encore en integer.
alter table public.ratings
  alter column stars type numeric using stars::numeric;
