-- Row Level Security for LearnForge AI
--
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
--
-- Without this, the anon key that ships inside the frontend bundle can read and
-- write every row in these tables directly, bypassing the backend entirely.
--
-- IMPORTANT: run this only AFTER the backend is using SUPABASE_SERVICE_ROLE_KEY.
-- The service role bypasses these policies; the anon key does not. If the
-- backend is still on the anon key when RLS turns on, every query returns
-- nothing and the app stops working.

alter table public.chats            enable row level security;
alter table public.chat_messages    enable row level security;
alter table public.documents        enable row level security;
alter table public.document_chunks  enable row level security;

-- Signed-in users may only see and change rows they own. The ::text casts keep
-- this working whether user_id is stored as uuid or as text.

drop policy if exists "own rows" on public.chats;
create policy "own rows" on public.chats
  for all to authenticated
  using (auth.uid()::text = user_id::text)
  with check (auth.uid()::text = user_id::text);

drop policy if exists "own rows" on public.chat_messages;
create policy "own rows" on public.chat_messages
  for all to authenticated
  using (auth.uid()::text = user_id::text)
  with check (auth.uid()::text = user_id::text);

drop policy if exists "own rows" on public.documents;
create policy "own rows" on public.documents
  for all to authenticated
  using (auth.uid()::text = user_id::text)
  with check (auth.uid()::text = user_id::text);

drop policy if exists "own rows" on public.document_chunks;
create policy "own rows" on public.document_chunks
  for all to authenticated
  using (auth.uid()::text = user_id::text)
  with check (auth.uid()::text = user_id::text);

-- Anonymous (not signed in) callers get no policy at all, which means no access.
