-- ============================================================
-- JumbAI 2.0 — Schema Database Completo
-- ============================================================

-- 1. TABELLA PROFILI (BYOK + Premium)
create table if not exists public.profili (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  crediti integer default 0 not null,
  piano text default 'free' not null check (piano in ('free','premium')),
  api_provider text default null,
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

-- 2. TABELLA VIDEO GENERATI (con stati e parametri avanzati)
create type public.stato_video as enum ('rendering', 'completato', 'fallito');

create table if not exists public.video_generati (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profili(id) on delete cascade not null,
  titolo text default 'Senza titolo',
  prompt text not null,
  prompt_negativo text default '',
  seed integer default null,
  modello text not null default 'gemini-2.0-flash-exp',
  tipo_input text default 'testo' not null check (tipo_input in ('testo','immagine','frame','multiple')),
  immagine_url text default null,
  durata_secondi integer default 4 not null,
  risoluzione text default '720p' not null,
  genera_audio boolean default false,
  ottimizza_prompt boolean default false,
  stato public.stato_video default 'rendering' not null,
  url_video text default null,
  url_anteprima text default null,
  request_id text default null,
  errore text default null,
  creato_il timestamp with time zone default timezone('utc'::text, now()) not null,
  completato_il timestamp with time zone default null
);

alter table public.video_generati enable row level security;

create policy "Utenti vedono solo i propri video"
  on public.video_generati for select using (auth.uid() = user_id);

create policy "Utenti inseriscono propri video"
  on public.video_generati for insert with check (auth.uid() = user_id);

create policy "Webhook service_role insert"
  on public.video_generati for insert with check (true);

create policy "Webhook service_role update"
  on public.video_generati for update using (true);

-- 3. ABILITA SUPABASE REALTIME per la tabella video_generati
-- (Esegui manualmente da SQL Editor: https://supabase.com/dashboard/project/pvytkbouuhhnrpcyozir/database/replication)
-- Vai su Database → Replication → add 'video_generati' to Realtime
alter publication supabase_realtime add table public.video_generati;

-- 4. INDICI
create index if not exists idx_video_user_stato on public.video_generati(user_id, stato);
create index if not exists idx_video_creato on public.video_generati(creato_il desc);

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