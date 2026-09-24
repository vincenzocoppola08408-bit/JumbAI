-- ============================================================
-- JumbAI T2I — Schema Database per Text-to-Image
-- ============================================================

-- 1. TABELLA PROFILI (con campo BYOK key hash)
create table if not exists public.profili (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  crediti integer default 0 not null,
  piano text default 'free' not null check (piano in ('free','premium')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profili enable row level security;

create policy "Gli utenti vedono solo il proprio profilo"
  on public.profili for select using (auth.uid() = id);

create policy "Gli utenti aggiornano solo il proprio profilo"
  on public.profili for update using (auth.uid() = id);

-- Trigger: crea profilo alla registrazione
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profili (id, email, crediti, piano)
  values (new.id, new.email, 0, 'free');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. TABELLA IMMAGINI GENERATE
create type public.stato_immagine as enum ('generazione', 'completata', 'fallita');

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

create policy "Utenti vedono solo le proprie immagini"
  on public.immagini_generate for select using (auth.uid() = user_id);

create policy "Utenti inseriscono proprie immagini"
  on public.immagini_generate for insert with check (auth.uid() = user_id);

create policy "Webhook service_role insert"
  on public.immagini_generate for insert with check (true);

create policy "Webhook service_role update"
  on public.immagini_generate for update using (true);

-- 3. ABILITA SUPABASE REALTIME
alter publication supabase_realtime add table public.immagini_generate;

-- 4. INDICI
create index if not exists idx_immagini_user_stato on public.immagini_generate(user_id, stato);
create index if not exists idx_immagini_creato on public.immagini_generate(creato_il desc);
create index if not exists idx_immagini_categoria on public.immagini_generate(categoria);

-- 5. FUNZIONE PER AGGIORNARE IL TIMESTAMP
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql security definer;

create trigger update_profili_updated_at
  before update on public.profili
  for each row execute procedure public.update_updated_at();