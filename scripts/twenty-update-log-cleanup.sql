DELETE FROM twenty_update_log WHERE created_at < NOW() - INTERVAL '90 days';
