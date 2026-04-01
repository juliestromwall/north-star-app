-- Google OAuth Tokens — stores per-admin Google tokens
-- Run this in Supabase SQL Editor

create table google_tokens (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  google_email text not null,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  scopes text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index google_tokens_user_id_idx on google_tokens (user_id);

alter table google_tokens enable row level security;

-- Users can read their own tokens
create policy "Users can view own google tokens"
  on google_tokens for select using (auth.uid() = user_id);

-- Service role (Cloudflare functions) can do everything
-- The anon key won't bypass RLS, but the service_role key will
create policy "Service role can manage all tokens"
  on google_tokens for all using (true);
