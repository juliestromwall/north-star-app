-- Team Chats schema migration
-- Run against Supabase SQL editor

-- Groups table
CREATE TABLE IF NOT EXISTS team_chat_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  member_ids text[] NOT NULL DEFAULT '{}',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Messages table
CREATE TABLE IF NOT EXISTS team_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES team_chat_groups(id) ON DELETE CASCADE,
  sender_id text NOT NULL,
  sender_name text,
  body text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fetching messages by group, newest first
CREATE INDEX IF NOT EXISTS idx_team_chat_messages_group_sent
  ON team_chat_messages(group_id, sent_at DESC);

-- Enable RLS
ALTER TABLE team_chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies: allow all for authenticated users
CREATE POLICY "Authenticated users can do anything on team_chat_groups"
  ON team_chat_groups
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can do anything on team_chat_messages"
  ON team_chat_messages
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
