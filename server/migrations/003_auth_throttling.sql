CREATE TABLE IF NOT EXISTS auth_rate_limits (
  bucket_hash CHAR(64) PRIMARY KEY,
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_expiry
  ON auth_rate_limits(blocked_until)
  WHERE blocked_until IS NOT NULL;
