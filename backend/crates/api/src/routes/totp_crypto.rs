//! Symmetric encryption for TOTP secret-at-rest.
//!
//! Wraps the base32 TOTP secret in AES-256-GCM. Key is derived from `JWT_SECRET`
//! via HKDF-SHA256 with a fixed `info` label so rotating JWT_SECRET will invalidate
//! existing TOTP entries (force re-enrollment) — acceptable for a 2FA secret.

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng, Payload},
    AeadCore, Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use hkdf::Hkdf;
use sha2::Sha256;

const HKDF_INFO: &[u8] = b"taskbolt:totp_secret_at_rest:v1";
const STORED_PREFIX: &str = "v1:";

#[derive(Debug, thiserror::Error)]
pub enum TotpCryptoError {
    #[error("JWT_SECRET env not set")]
    MissingKey,
    #[error("HKDF expand failed")]
    Kdf,
    #[error("AES-GCM encrypt failed")]
    Encrypt,
    #[error("AES-GCM decrypt failed")]
    Decrypt,
    #[error("malformed ciphertext")]
    Malformed,
}

fn derive_key() -> Result<Key<Aes256Gcm>, TotpCryptoError> {
    let secret = std::env::var("JWT_SECRET").map_err(|_| TotpCryptoError::MissingKey)?;
    let hk = Hkdf::<Sha256>::new(None, secret.as_bytes());
    let mut okm = [0u8; 32];
    hk.expand(HKDF_INFO, &mut okm)
        .map_err(|_| TotpCryptoError::Kdf)?;
    Ok(*Key::<Aes256Gcm>::from_slice(&okm))
}

/// Encrypt a TOTP base32 secret. Returns `v1:b64(nonce|ciphertext_with_tag)`.
pub fn encrypt_secret(plain: &str) -> Result<String, TotpCryptoError> {
    let key = derive_key()?;
    let cipher = Aes256Gcm::new(&key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ct = cipher
        .encrypt(
            &nonce,
            Payload {
                msg: plain.as_bytes(),
                aad: HKDF_INFO,
            },
        )
        .map_err(|_| TotpCryptoError::Encrypt)?;
    let mut combined = Vec::with_capacity(nonce.len() + ct.len());
    combined.extend_from_slice(&nonce);
    combined.extend_from_slice(&ct);
    Ok(format!("{}{}", STORED_PREFIX, B64.encode(&combined)))
}

/// Decrypt a stored TOTP secret. Returns `Some(plain)` on success, `None` for
/// legacy cleartext (caller should treat as needing re-enrollment).
pub fn decrypt_secret(stored: &str) -> Result<String, TotpCryptoError> {
    let rest = stored
        .strip_prefix(STORED_PREFIX)
        .ok_or(TotpCryptoError::Malformed)?;
    let bytes = B64.decode(rest).map_err(|_| TotpCryptoError::Malformed)?;
    if bytes.len() < 13 {
        return Err(TotpCryptoError::Malformed);
    }
    let (nonce_bytes, ct) = bytes.split_at(12);
    let key = derive_key()?;
    let cipher = Aes256Gcm::new(&key);
    let nonce = Nonce::from_slice(nonce_bytes);
    let plain = cipher
        .decrypt(
            nonce,
            Payload {
                msg: ct,
                aad: HKDF_INFO,
            },
        )
        .map_err(|_| TotpCryptoError::Decrypt)?;
    String::from_utf8(plain).map_err(|_| TotpCryptoError::Malformed)
}

/// Detect whether a stored secret string is wrapped (encrypted) or legacy cleartext.
pub fn is_encrypted(stored: &str) -> bool {
    stored.starts_with(STORED_PREFIX)
}

#[cfg(test)]
#[allow(unsafe_code)]
mod tests {
    use super::*;

    fn with_jwt_secret<F: FnOnce()>(f: F) {
        // SAFETY: tests run single-threaded under cargo test default cfg for this module.
        unsafe {
            std::env::set_var(
                "JWT_SECRET",
                "test-secret-must-be-long-enough-for-hkdf-derivation-32+",
            );
        }
        f();
    }

    #[test]
    fn round_trip() {
        with_jwt_secret(|| {
            let plain = "JBSWY3DPEHPK3PXP";
            let ct = encrypt_secret(plain).expect("encrypt");
            assert!(ct.starts_with("v1:"));
            let pt = decrypt_secret(&ct).expect("decrypt");
            assert_eq!(pt, plain);
        });
    }

    #[test]
    fn nonces_unique() {
        with_jwt_secret(|| {
            let a = encrypt_secret("AA").expect("a");
            let b = encrypt_secret("AA").expect("b");
            assert_ne!(a, b);
        });
    }

    #[test]
    fn rejects_legacy() {
        with_jwt_secret(|| {
            let r = decrypt_secret("JBSWY3DPEHPK3PXP");
            assert!(matches!(r, Err(TotpCryptoError::Malformed)));
            assert!(!is_encrypted("JBSWY3DPEHPK3PXP"));
        });
    }

    #[test]
    fn detects_wrapped() {
        with_jwt_secret(|| {
            let ct = encrypt_secret("X").expect("enc");
            assert!(is_encrypted(&ct));
        });
    }
}
