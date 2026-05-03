CREATE TABLE twenty_update_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_tag_old TEXT NOT NULL,
  image_tag_new TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  health_check_passed BOOLEAN,
  rolled_back BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX twenty_update_log_recent ON twenty_update_log (created_at DESC);

-- Retention: rows older than 90d cleaned via cron (separate job)
