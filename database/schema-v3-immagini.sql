-- ============================================================
-- JumbAI T2I — Schema Database per Text-to-Image
-- SOLO la nuova tabella immagini_generate
-- (profili e trigger già esistono dalla versione precedente)
-- ============================================================

-- 1. TABELLA IMMAGINI GENERATE
create type if not exists public.stato_immagine as enum ('generazione', 'completata', 'fallita');

create table if not exists public.immagini_generate (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profili(id) on delete cascade not null,
  prompt text not null,
  prompt_negativo text default '',
  seed integer default null,
  modello text default 'wanx2.1-t2i-turbo' not null,
  categoria text default 'generale' not null,
  size text default '1024*1024' not null,
  ottimizza_prompt boolean default true,
  url_immagine text default null,
  provider text default 'wan' not null check (provider in ('wan', 'fal', 'dall-e')),
  stato public.stato_immagine default 'generazione' not null,
  request_id text default null,
  errore text default null,
  creato_il timestamp with time zone default timezone('utc'::text, now()) not null,
  completato_il timestamp with time zone default null
);

alter table public.immagini_generate enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'immagini_generate' and policyname = 'Utenti vedono solo le proprie immagini') then
    create policy "Utenti vedono solo le proprie immagini"
      on public.immagini_generate for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'immagini_generate' and policyname = 'Utenti inseriscono proprie immagini') then
    create policy "Utenti inseriscono proprie immagini"
      on public.immagini_generate for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'immagini_generate' and policyname = 'Webhook service_role insert') then
    create policy "Webhook service_role insert"
      on public.immagini_generate for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'immagini_generate' and policyname = 'Webhook service_role update') then
    create policy "Webhook service_role update"
      on public.immagini_generate for update using (true);
  end if;
end $$;

-- 2. ABILITA SUPABASE REALTIME (se non già presente)
alter publication supabase_realtime add table if not exists public.immagini_generate;

-- 3. INDICI
create index if not exists idx_immagini_user_stato on public.immagini_generate(user_id, stato);
create index if not exists idx_immagini_creato on public.immagini_generate(creato_il desc);
create index if not exists idx_immagini_categoria on public.immagini_generate(categoria);