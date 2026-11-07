-- Covering indexes for foreign keys used by game lookups and cascades (Supabase performance advisor).
-- Audit-only references (created_by, reviewed_by, updated_by, owner_id) are left without index on purpose.

create index games_table_idx on public.games (table_id);
create index games_template_idx on public.games (template_id);
create index game_tables_current_game_idx on public.game_tables (current_game_id) where current_game_id is not null;
