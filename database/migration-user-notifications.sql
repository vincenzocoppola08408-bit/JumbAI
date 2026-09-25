// ============================================================
// Migration: user_notifications table for real-time alerts
// ============================================================

create table if not exists public.user_notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profili(id) on delete cascade not null,
  message text not null,
  type text not null default 'info', -- info, success, warning, error
  data jsonb default '{}'::jsonb,
  read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.user_notifications enable row level security;

-- Policy: utenti vedono solo le proprie notifiche
create policy "Utenti vedono solo le proprie notifiche"
  on public.user_notifications for select using (auth.uid() = user_id);

-- Policy: utenti possono inserire le proprie notifiche (tramite API)
create policy "Utenti possono inserire le proprie notifiche"
  on public.user_notifications for insert using (auth.uid() = user_id);

-- Policy: service_role può inserire notifiche per qualsiasi utente (webhook)
create policy "Service role può inserire notifiche"
  on public.user_notifications for insert using (true);

-- Policy: service_role può aggiornare (mark as read)
create policy "Service role può aggiornare notifiche"
  on public.user_notifications for update using (true);

-- Indici
create index if not exists idx_user_notifications_user on public.user_notifications(user_id, read);
create index if not exists idx_user_notifications_created on public.user_notifications(created_at desc);

-- Trigger updated_at (if needed)
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists update_user_notifications_updated_at on public.user_notifications;
create trigger update_user_notifications_updated_at
  before update on public.user_notifications
  for each row execute procedure public.update_updated_at();