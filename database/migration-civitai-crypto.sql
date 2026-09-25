-- ============================================================
-- Migration Civitai OAuth + AES-256-GCM Crypto Fields
// ============================================================

-- 1. Aggiungi colonne cifrate alla tabella profili
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profili' AND column_name = 'civitai_access_token_enc'
  ) THEN
    ALTER TABLE public.profili
      ADD COLUMN civitai_access_token_enc TEXT DEFAULT NULL,
      ADD COLUMN civitai_access_iv TEXT DEFAULT NULL,
      ADD COLUMN civitai_access_auth_tag TEXT DEFAULT NULL,
      ADD COLUMN civitai_refresh_token_enc TEXT DEFAULT NULL,
      ADD COLUMN civitai_refresh_iv TEXT DEFAULT NULL,
      ADD COLUMN civitai_refresh_auth_tag TEXT DEFAULT NULL,
      ADD COLUMN civitai_expires_at TIMESTAMPTZ DEFAULT NULL,
      ADD COLUMN civitai_last_refreshed_at TIMESTAMPTZ DEFAULT NULL,
      ADD COLUMN civitai_connected BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 2. Tabella civitai_accounts (storico token per utente)
create table if not exists public.civitai_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profili(id) on delete cascade not null,
  access_token_enc text not null,
  access_iv text not null,
  access_auth_tag text not null,
  refresh_token_enc text not null,
  refresh_iv text not null,
  refresh_auth_tag text not null,
  expires_at timestamptz not null,
  last_refreshed_at timestamptz not null default timezone('utc'::text, now()),
  connected boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.civitai_accounts enable row level security;

create policy "Utenti vedono solo i propri account Civitai"
  on public.civitai_accounts for select using (auth.uid() = user_id);

create policy "Webhook service_role insert"
  on public.civitai_accounts for insert with check (true);

create policy "Webhook service_role update"
  on public.civitai_accounts for update using (true);

-- 3. Indici
create index if not exists idx_civitai_user on public.civitai_accounts(user_id, connected);
create index if not exists idx_civitai_expires on public.civitai_accounts(expires_at);

-- 4. Trigger updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists update_civitai_accounts_updated_at on public.civitai_accounts;
create trigger update_civitai_accounts_updated_at
  before update on public.civitai_accounts
  for each row execute procedure public.update_updated_at();