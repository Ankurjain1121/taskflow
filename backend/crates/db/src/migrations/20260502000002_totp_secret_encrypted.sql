-- Disable existing 2FA rows storing cleartext TOTP secrets. New code requires
-- the wrapper format `v1:<base64>` produced by AES-256-GCM (HKDF from JWT_SECRET).
-- Existing rows would fail to decrypt → users must re-enroll.
UPDATE user_2fa
SET totp_enabled = false,
    totp_secret = '',
    recovery_codes = NULL,
    updated_at = NOW()
WHERE totp_secret IS NOT NULL
  AND totp_secret NOT LIKE 'v1:%';
