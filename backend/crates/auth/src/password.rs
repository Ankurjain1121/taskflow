use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Algorithm, Argon2, Params, Version,
};

/// Argon2id parameters per OWASP Password Storage Cheat Sheet 2025
/// m=47104 (46 MiB), t=2, p=1 — exceeds OWASP minimum (m=19 MiB, t=2, p=1)
const ARGON2_MEMORY_COST: u32 = 47_104; // 46 MiB
const ARGON2_TIME_COST: u32 = 2;
const ARGON2_PARALLELISM: u32 = 1;

fn argon2_instance() -> Argon2<'static> {
    let params = Params::new(
        ARGON2_MEMORY_COST,
        ARGON2_TIME_COST,
        ARGON2_PARALLELISM,
        None, // default output length (32 bytes)
    )
    .expect("Invalid Argon2 parameters");

    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
}

/// Synchronous Argon2id hash. CPU-bound (~300ms with current params).
/// Prefer the async [`hash_password`] in async contexts — this fn is exposed
/// for sync binaries (e.g. `bin/hash_password.rs`) and tests.
fn hash_password_sync(password: &str) -> Result<String, argon2::password_hash::Error> {
    if password.is_empty() {
        return Err(argon2::password_hash::Error::Password);
    }
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = argon2_instance();
    let hash = argon2.hash_password(password.as_bytes(), &salt)?;
    Ok(hash.to_string())
}

/// Synchronous Argon2id verify. CPU-bound (~300ms with current params).
/// Prefer the async [`verify_password`] in async contexts.
fn verify_password_sync(password: &str, hash: &str) -> Result<bool, argon2::password_hash::Error> {
    let parsed_hash = PasswordHash::new(hash)?;
    Ok(argon2_instance()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

/// Hash a password using Argon2id with OWASP-recommended parameters.
///
/// Argon2id is intentionally CPU+memory-bound (~300ms with our params), so we
/// run the work on `tokio::task::spawn_blocking` to avoid stalling the async
/// runtime worker thread (which would starve the pool under login bursts).
///
/// Returns an error if the password is empty (defense-in-depth) or if Argon2 fails.
pub async fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let owned = password.to_owned();
    tokio::task::spawn_blocking(move || hash_password_sync(&owned))
        .await
        .map_err(|_| argon2::password_hash::Error::Password)?
}

/// Verify a password against a stored hash.
///
/// Argon2id verify is CPU-bound (~300ms), so the work runs on
/// `tokio::task::spawn_blocking` to keep async workers responsive.
pub async fn verify_password(
    password: &str,
    hash: &str,
) -> Result<bool, argon2::password_hash::Error> {
    let owned_password = password.to_owned();
    let owned_hash = hash.to_owned();
    tokio::task::spawn_blocking(move || verify_password_sync(&owned_password, &owned_hash))
        .await
        .map_err(|_| argon2::password_hash::Error::Password)?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_hash_and_verify() {
        let password = "test_password_123";
        let hash = hash_password(password).await.unwrap();
        assert!(verify_password(password, &hash).await.unwrap());
        assert!(!verify_password("wrong_password", &hash).await.unwrap());
    }

    #[tokio::test]
    async fn test_empty_password_rejected() {
        let result = hash_password("").await;
        assert!(result.is_err(), "Empty password should be rejected");
    }

    #[tokio::test]
    async fn test_long_password() {
        let long_password = "a".repeat(1000);
        let result = hash_password(&long_password).await;
        assert!(result.is_ok(), "Argon2 should handle a 1000-char password");
        let hash = result.unwrap();
        assert!(verify_password(&long_password, &hash).await.unwrap());
    }

    #[tokio::test]
    async fn test_hash_format_starts_with_argon2() {
        let hash = hash_password("some_password").await.unwrap();
        assert!(
            hash.starts_with("$argon2"),
            "Hash should start with $argon2, got: {}",
            hash
        );
    }

    #[tokio::test]
    async fn test_different_passwords_different_hashes() {
        let hash1 = hash_password("password_one").await.unwrap();
        let hash2 = hash_password("password_two").await.unwrap();
        assert_ne!(
            hash1, hash2,
            "Different passwords should produce different hashes"
        );
    }

    #[tokio::test]
    async fn test_verify_with_invalid_hash_format() {
        let result = verify_password("any_password", "not-a-valid-hash").await;
        assert!(result.is_err(), "Invalid hash format should return Err");
    }

    #[tokio::test]
    async fn test_same_password_produces_different_hashes_salt_uniqueness() {
        let password = "identical_password";
        let hash1 = hash_password(password).await.unwrap();
        let hash2 = hash_password(password).await.unwrap();
        assert_ne!(
            hash1, hash2,
            "Two hashes of the same password should differ due to unique salts"
        );
        // Both must still verify against the original password
        assert!(verify_password(password, &hash1).await.unwrap());
        assert!(verify_password(password, &hash2).await.unwrap());
    }

    #[tokio::test]
    async fn test_unicode_password() {
        let unicode_password = "\u{1F4A9}emoji\u{2603}snowman\u{00E9}accent";
        let hash = hash_password(unicode_password).await.unwrap();
        assert!(verify_password(unicode_password, &hash).await.unwrap());
        assert!(!verify_password("wrong", &hash).await.unwrap());
    }

    #[tokio::test]
    async fn test_whitespace_password() {
        let password = "   spaces and\ttabs\nnewlines   ";
        let hash = hash_password(password).await.unwrap();
        assert!(verify_password(password, &hash).await.unwrap());
        assert!(!verify_password(password.trim(), &hash).await.unwrap());
    }

    #[tokio::test]
    async fn test_special_characters_password() {
        let password = r#"!@#$%^&*()_+-={}[]|\":;'<>,.?/"#;
        let hash = hash_password(password).await.unwrap();
        assert!(verify_password(password, &hash).await.unwrap());
    }
}
