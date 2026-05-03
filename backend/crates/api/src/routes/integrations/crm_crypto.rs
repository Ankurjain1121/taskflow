//! Symmetric encryption for CRM-link secrets at rest (Twenty OIDC client_secret,
//! Twenty API key). Mirrors the shape of `routes::totp_crypto` but with a
//! distinct HKDF info label so secrets can't be cross-decrypted.

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng, Payload},
    AeadCore, Aes256Gcm, Key, Nonce,
};
use hkdf::Hkdf;
use sha2::Sha256;

const HKDF_INFO: &[u8] = b"taskbolt:crm_secret_at_rest:v1";

#[derive(Debug, thiserror::Error)]
pub enum CrmCryptoError {
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

fn derive_key() -> Result<Key<Aes256Gcm>, CrmCryptoError> {
    let secret = std::env::var("JWT_SECRET").map_err(|_| CrmCryptoError::MissingKey)?;
    let hk = Hkdf::<Sha256>::new(None, secret.as_bytes());
    let mut okm = [0u8; 32];
    hk.expand(HKDF_INFO, &mut okm)
        .map_err(|_| CrmCryptoError::Kdf)?;
    Ok(*Key::<Aes256Gcm>::from_slice(&okm))
}

/// Encrypt `plain` returning `nonce(12) || ciphertext+tag`.
pub fn encrypt(plain: &[u8]) -> Result<Vec<u8>, CrmCryptoError> {
    let key = derive_key()?;
    let cipher = Aes256Gcm::new(&key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ct = cipher
        .encrypt(
            &nonce,
            Payload {
                msg: plain,
                aad: HKDF_INFO,
            },
        )
        .map_err(|_| CrmCryptoError::Encrypt)?;
    let mut out = Vec::with_capacity(nonce.len() + ct.len());
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&ct);
    Ok(out)
}

/// Decrypt the inverse of [`encrypt`].
pub fn decrypt(cipher_bytes: &[u8]) -> Result<Vec<u8>, CrmCryptoError> {
    if cipher_bytes.len() < 13 {
        return Err(CrmCryptoError::Malformed);
    }
    let (nonce_bytes, ct) = cipher_bytes.split_at(12);
    let key = derive_key()?;
    let cipher = Aes256Gcm::new(&key);
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher
        .decrypt(
            nonce,
            Payload {
                msg: ct,
                aad: HKDF_INFO,
            },
        )
        .map_err(|_| CrmCryptoError::Decrypt)
}

#[cfg(test)]
#[allow(unsafe_code)]
mod tests {
    use super::*;

    fn with_jwt_secret<F: FnOnce()>(f: F) {
        unsafe {
            std::env::set_var(
                "JWT_SECRET",
                "test-secret-for-crm-crypto-must-be-long-enough-to-pass-32",
            );
        }
        f();
    }

    #[test]
    fn round_trip() {
        with_jwt_secret(|| {
            let plain = b"my-secret-twenty-client-secret";
            let ct = encrypt(plain).expect("encrypt");
            let pt = decrypt(&ct).expect("decrypt");
            assert_eq!(pt, plain);
        });
    }

    #[test]
    fn nonces_unique() {
        with_jwt_secret(|| {
            let a = encrypt(b"AA").expect("a");
            let b = encrypt(b"AA").expect("b");
            assert_ne!(a, b, "nonce randomization required");
        });
    }

    #[test]
    fn rejects_short_ciphertext() {
        with_jwt_secret(|| {
            assert!(matches!(decrypt(&[0u8; 5]), Err(CrmCryptoError::Malformed)));
        });
    }
}
