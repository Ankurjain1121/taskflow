//! Dedicated RSA keypair for the Twenty OIDC IdP.
//!
//! Loaded at boot from disk (default `/var/lib/taskflow/oidc-twenty/`) or from
//! environment variables (`TWENTY_OIDC_PRIVATE_KEY`, `TWENTY_OIDC_PUBLIC_KEY`).
//! If neither source provides a key and the disk path is writable, a fresh
//! 2048-bit RSA keypair is generated and persisted with mode 0600 on the
//! private key.
//!
//! NOT shared with TaskBolt's JWT signing keys — see `taskbolt_auth::jwt::JwtKeys`.

use std::path::{Path, PathBuf};

use aes_gcm::aead::OsRng;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use jsonwebtoken::{DecodingKey, EncodingKey};
use rsa::pkcs8::{DecodePublicKey, EncodePrivateKey, EncodePublicKey, LineEnding};
use rsa::traits::PublicKeyParts;
use rsa::{RsaPrivateKey, RsaPublicKey};
use sha2::{Digest, Sha256};

const RSA_BITS: usize = 2048;

#[derive(Debug, thiserror::Error)]
pub enum OidcKeyError {
    #[error("RSA generation failed: {0}")]
    Generate(#[from] rsa::Error),
    #[error("PKCS8 encode failed: {0}")]
    Pkcs8(#[from] rsa::pkcs8::Error),
    #[error("SPKI encode failed: {0}")]
    Spki(#[from] rsa::pkcs8::spki::Error),
    #[error("I/O error reading/writing PEM: {0}")]
    Io(#[from] std::io::Error),
    #[error("jsonwebtoken key parse failed: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),
}

/// Parsed RSA keypair plus the PEM-encoded public key + a stable kid (key ID)
/// derived from a SHA-256 thumbprint of the public key.
pub struct TwentyOidcKeys {
    pub public_key: RsaPublicKey,
    pub encoding: EncodingKey,
    pub decoding: DecodingKey,
    pub public_pem: String,
    pub private_pem: String,
    pub kid: String,
}

impl std::fmt::Debug for TwentyOidcKeys {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // Intentionally redact sensitive key material (public_key, encoding, decoding,
        // private_pem). Only include kid + public_pem_len for diagnostics.
        f.debug_struct("TwentyOidcKeys")
            .field("kid", &self.kid)
            .field("public_pem_len", &self.public_pem.len())
            .field("private_pem", &"[REDACTED]")
            .finish_non_exhaustive()
    }
}

impl TwentyOidcKeys {
    /// Build keys from in-memory PEM strings (used in tests + when env vars
    /// inject keys directly).
    pub fn from_pem(private_pem: String, public_pem: String) -> Result<Self, OidcKeyError> {
        let public_key = RsaPublicKey::from_public_key_pem(&public_pem)?;
        let encoding = EncodingKey::from_rsa_pem(private_pem.as_bytes())?;
        let decoding = DecodingKey::from_rsa_pem(public_pem.as_bytes())?;
        let kid = compute_kid(&public_key);
        Ok(Self {
            public_key,
            encoding,
            decoding,
            public_pem,
            private_pem,
            kid,
        })
    }

    /// Generate a fresh 2048-bit RSA keypair (in memory). Used in tests and
    /// when neither disk nor env supplies a key on first boot.
    pub fn generate() -> Result<Self, OidcKeyError> {
        // `aes_gcm::aead::OsRng` re-exports the `rand_core` 0.6 OsRng that the
        // RustCrypto `rsa` crate expects. Avoids a `rand` 0.9 / 0.6 mismatch
        // since this workspace pins `rand = "0.9"` for non-crypto callers.
        let mut rng = OsRng;
        let private = RsaPrivateKey::new(&mut rng, RSA_BITS)?;
        let public = RsaPublicKey::from(&private);
        let private_pem = private.to_pkcs8_pem(LineEnding::LF)?.to_string();
        let public_pem = public.to_public_key_pem(LineEnding::LF)?;
        Self::from_pem(private_pem, public_pem)
    }

    /// Load keys from `<dir>/private.pem` + `<dir>/public.pem`. If both files
    /// are missing, generate a new pair and persist them. If one file exists
    /// but the other is missing this returns an error (tampering / partial
    /// provisioning protection).
    pub fn load_or_generate(dir: &Path) -> Result<Self, OidcKeyError> {
        let private_path = dir.join("private.pem");
        let public_path = dir.join("public.pem");

        match (private_path.exists(), public_path.exists()) {
            (true, true) => {
                let private_pem = std::fs::read_to_string(&private_path)?;
                let public_pem = std::fs::read_to_string(&public_path)?;
                Self::from_pem(private_pem, public_pem)
            }
            (false, false) => {
                let keys = Self::generate()?;
                std::fs::create_dir_all(dir)?;
                write_private(&private_path, &keys.private_pem)?;
                std::fs::write(&public_path, &keys.public_pem)?;
                tracing::info!(
                    dir = %dir.display(),
                    kid = %keys.kid,
                    "Twenty OIDC RSA keypair generated and persisted"
                );
                Ok(keys)
            }
            (true, false) | (false, true) => Err(OidcKeyError::Io(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "OIDC key dir contains only one of private.pem / public.pem — refusing to proceed",
            ))),
        }
    }

    /// Build keys from env vars `TWENTY_OIDC_PRIVATE_KEY` + `TWENTY_OIDC_PUBLIC_KEY`,
    /// falling back to `load_or_generate(<dir>)` when env vars are absent.
    /// `dir_override` lets ops point at a non-default key directory.
    pub fn from_env_or_disk(dir_override: Option<&str>) -> Result<Self, OidcKeyError> {
        let env_priv = std::env::var("TWENTY_OIDC_PRIVATE_KEY")
            .ok()
            .filter(|s| !s.is_empty());
        let env_pub = std::env::var("TWENTY_OIDC_PUBLIC_KEY")
            .ok()
            .filter(|s| !s.is_empty());
        if let (Some(priv_pem), Some(pub_pem)) = (env_priv, env_pub) {
            return Self::from_pem(priv_pem, pub_pem);
        }
        let dir: PathBuf = dir_override
            .map(PathBuf::from)
            .or_else(|| std::env::var("TWENTY_OIDC_KEY_DIR").ok().map(PathBuf::from))
            .unwrap_or_else(|| PathBuf::from("/var/lib/taskflow/oidc-twenty"));
        Self::load_or_generate(&dir)
    }

    /// Extract the JWKS entry for the public key (RFC 7517 §4 + RFC 7518 §6.3.1).
    pub fn jwk(&self) -> serde_json::Value {
        let n = URL_SAFE_NO_PAD.encode(self.public_key.n().to_bytes_be());
        let e = URL_SAFE_NO_PAD.encode(self.public_key.e().to_bytes_be());
        serde_json::json!({
            "kty": "RSA",
            "use": "sig",
            "alg": "RS256",
            "kid": self.kid,
            "n": n,
            "e": e,
        })
    }
}

fn compute_kid(public_key: &RsaPublicKey) -> String {
    // RFC 7638 §3 thumbprint over the canonical JWK members.
    let n = URL_SAFE_NO_PAD.encode(public_key.n().to_bytes_be());
    let e = URL_SAFE_NO_PAD.encode(public_key.e().to_bytes_be());
    let canonical = format!(r#"{{"e":"{e}","kty":"RSA","n":"{n}"}}"#);
    let digest = Sha256::digest(canonical.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

#[cfg(unix)]
fn write_private(path: &Path, contents: &str) -> std::io::Result<()> {
    use std::os::unix::fs::OpenOptionsExt;
    let mut f = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path)?;
    std::io::Write::write_all(&mut f, contents.as_bytes())?;
    Ok(())
}

#[cfg(not(unix))]
fn write_private(path: &Path, contents: &str) -> std::io::Result<()> {
    std::fs::write(path, contents)
}

#[cfg(test)]
mod tests {
    use super::*;
    use jsonwebtoken::{decode, encode, Algorithm, Header, Validation};
    use serde::{Deserialize, Serialize};

    #[derive(Serialize, Deserialize)]
    struct TinyClaims {
        sub: String,
        exp: i64,
        iss: String,
        aud: String,
    }

    #[test]
    fn generate_yields_signing_keypair() {
        let keys = TwentyOidcKeys::generate().expect("generate");
        let claims = TinyClaims {
            sub: "user-1".to_string(),
            exp: (chrono::Utc::now().timestamp()) + 60,
            iss: "https://taskflow.paraslace.in/oauth/twenty".to_string(),
            aud: "twenty-client".to_string(),
        };
        let header = Header {
            alg: Algorithm::RS256,
            kid: Some(keys.kid.clone()),
            ..Default::default()
        };
        let token = encode(&header, &claims, &keys.encoding).expect("sign");

        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(&["https://taskflow.paraslace.in/oauth/twenty"]);
        validation.set_audience(&["twenty-client"]);
        let decoded = decode::<TinyClaims>(&token, &keys.decoding, &validation).expect("verify");
        assert_eq!(decoded.claims.sub, "user-1");
    }

    #[test]
    fn jwk_has_required_members() {
        let keys = TwentyOidcKeys::generate().expect("generate");
        let jwk = keys.jwk();
        assert_eq!(jwk["kty"], "RSA");
        assert_eq!(jwk["alg"], "RS256");
        assert_eq!(jwk["use"], "sig");
        assert_eq!(jwk["kid"], keys.kid);
        assert!(jwk["n"].as_str().is_some_and(|s| !s.is_empty()));
        assert_eq!(jwk["e"], "AQAB");
    }

    #[test]
    fn kid_is_stable_for_same_key() {
        let k = TwentyOidcKeys::generate().expect("gen");
        let again =
            TwentyOidcKeys::from_pem(k.private_pem.clone(), k.public_pem.clone()).expect("rebuild");
        assert_eq!(k.kid, again.kid);
    }

    #[test]
    fn kid_differs_across_keys() {
        let a = TwentyOidcKeys::generate().expect("a");
        let b = TwentyOidcKeys::generate().expect("b");
        assert_ne!(a.kid, b.kid);
    }

    #[test]
    fn load_or_generate_persists_and_reloads() {
        let dir = tempdir();
        let first = TwentyOidcKeys::load_or_generate(&dir).expect("first load");
        assert!(dir.join("private.pem").exists());
        assert!(dir.join("public.pem").exists());
        let second = TwentyOidcKeys::load_or_generate(&dir).expect("reload");
        assert_eq!(first.kid, second.kid, "kid must survive reload");
        // Cleanup
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn load_refuses_partial_keypair() {
        let dir = tempdir();
        std::fs::create_dir_all(&dir).expect("mkdir");
        std::fs::write(dir.join("public.pem"), "PUBLIC").expect("write public");
        // private.pem missing → must error
        let result = TwentyOidcKeys::load_or_generate(&dir);
        assert!(result.is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    fn tempdir() -> PathBuf {
        let mut p = std::env::temp_dir();
        p.push(format!("taskbolt-oidc-test-{}", uuid::Uuid::new_v4()));
        p
    }
}
