-- Schema Database JumbAI - AI Video Generator SaaS
-- Esegui nel SQL Editor di Supabase (dopo aver attivato Supabase Auth)

-- Tabella profili (crediti premium, collegata ad auth.users)
create table if not exists public.profili (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  crediti integer default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Abilita Row Level Security
alter table public.profili enable row level security;

-- Politica SELECT: solo il proprietario
create policy "Gli utenti vedono solo il proprio profilo"
  on public.profili
  for select using (auth.uid() = id);

-- Funzione per creare il profilo all'atto della registrazione
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profili (id, email, crediti)
  values (new.id, new.email, 0);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger che attiva la funzione
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Tabella video generati (galleria personale)
create table if not exists public.video_generati (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profili(id) on delete cascade not null,
  url_video text not null,
  prompt_usato text,
  creato_il timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Abilita RLS sulla tabella video
alter table public.video_generati enable row level security;

-- Politica SELECT: solo i propri video
create policy "Gli utenti vedono solo i propri video"
  on public.video_generati
  for select using (auth.uid() = user_id);

-- Politica INSERT per il webhook (usa service_role, ma per sicurezza imposta anche questo)
create policy "Webhooks possono inserire" on public.video_generati
  for insert with check (true);
