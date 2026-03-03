-- Migration: add column_entered_at to tasks
-- Tracks when a task entered its current column (for days-in-column indicator)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS column_entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
