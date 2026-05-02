-- Invalidate legacy SHA-256 share-link passwords. Argon2id PHC strings start with "$argon2".
-- Any non-null hash that does NOT start with "$argon2" is the deprecated `salt:sha256hex`
-- form. Setting it to NULL drops password gating but keeps the share link active so the
-- creator can re-attach an Argon2id password via the create endpoint.
UPDATE project_shares
SET password_hash = NULL
WHERE password_hash IS NOT NULL
  AND password_hash NOT LIKE '$argon2%';
