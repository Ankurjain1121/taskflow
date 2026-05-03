//! AES-256-GCM encryption for CRM HMAC secrets at rest.
//!
//! Key is derived from `TASKBOLT_SECRETS_KEY` env var via SHA-256.
//! Wire format: nonce(12 bytes) || ciphertext+tag.

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    AeadCore, Aes256Gcm, Key, Nonce,
};
use sha2::{Digest, Sha256};

#[derive(Debug, thiserror::Error)]
pub enum CrmCryptoError {
    #[error("TASKBOLT_SECRETS_KEY env not set")]
    MissingKey,
    #[allow(dead_code)]
    #[error("AES-GCM encrypt failed")]
    Encrypt,
    #[error("AES-GCM decrypt failed")]
    Decrypt,
    #[error("ciphertext too short (< 13 bytes)")]
    Malformed,
}

fn derive_key() -> Result<Key<Aes256Gcm>, CrmCryptoError> {
    let raw = std::env::var("TASKBOLT_SECRETS_KEY").map_err(|_| CrmCryptoError::MissingKey)?;
    let hash = Sha256::digest(raw.as_bytes());
    Ok(*Key::<Aes256Gcm>::from_slice(&hash))
}

/// Encrypt `plain` → `nonce(12) || ciphertext+tag`.
#[allow(dead_code)]
pub fn encrypt_secret(plain: &[u8]) -> Result<Vec<u8>, CrmCryptoError> {
    let key = derive_key()?;
    let cipher = Aes256Gcm::new(&key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ct = cipher
        .encrypt(&nonce, plain)
        .map_err(|_| CrmCryptoError::Encrypt)?;
    let mut out = Vec::with_capacity(12 + ct.len());
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&ct);
    Ok(out)
}

/// Decrypt the inverse of [`encrypt_secret`].
pub fn decrypt_secret(ciphertext: &[u8]) -> Result<Vec<u8>, CrmCryptoError> {
    if ciphertext.len() < 13 {
        return Err(CrmCryptoError::Malformed);
    }
    let (nonce_bytes, ct) = ciphertext.split_at(12);
    let key = derive_key()?;
    let cipher = Aes256Gcm::new(&key);
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher
        .decrypt(nonce, ct)
        .map_err(|_| CrmCryptoError::Decrypt)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn with_key<F: FnOnce()>(f: F) {
        // Safety: test-only, single-threaded
        #[allow(unsafe_code)]
        unsafe {
            std::env::set_var(
                "TASKBOLT_SECRETS_KEY",
                "test-key-for-crm-secret-crypto-256bit!",
            );
        }
        f();
    }

    #[test]
    fn round_trip() {
        with_key(|| {
            let plain = b"my-twenty-hmac-secret";
            let ct = encrypt_secret(plain).expect("encrypt");
            let pt = decrypt_secret(&ct).expect("decrypt");
            assert_eq!(pt, plain);
        });
    }

    #[test]
    fn malformed_ciphertext_rejected() {
        with_key(|| {
            assert!(matches!(
                decrypt_secret(b"tooshort"),
                Err(CrmCryptoError::Malformed)
            ));
        });
    }

    #[test]
    fn tampered_ciphertext_rejected() {
        with_key(|| {
            let plain = b"secret";
            let mut ct = encrypt_secret(plain).expect("encrypt");
            // Flip a byte in the tag region
            let last = ct.len() - 1;
            ct[last] ^= 0xff;
            assert!(matches!(decrypt_secret(&ct), Err(CrmCryptoError::Decrypt)));
        });
    }
}
