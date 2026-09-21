-- Supabase Schema for Sync Engine

CREATE TABLE sync_records (
  record_id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid(),
  store TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at BIGINT NOT NULL,
  device_id TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sync_records_user_updated ON sync_records (user_id, updated_at);

-- Row Level Security (RLS)
ALTER TABLE sync_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own sync records" ON sync_records
  FOR ALL
  USING (auth.uid() = user_id);
