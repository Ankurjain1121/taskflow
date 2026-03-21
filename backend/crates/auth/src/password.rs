use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Algorithm, Argon2, Params, Version,
};

/// Argon2id parameters per OWASP Password Storage Cheat Sheet 2025
/// Option 1: m=47104 (46 MiB), t=1, p=1
const ARGON2_MEMORY_COST: u32 = 47_104; // 46 MiB
const ARGON2_TIME_COST: u32 = 1;
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

/// Hash a password using Argon2id with OWASP-recommended parameters
pub fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = argon2_instance();
    let hash = argon2.hash_password(password.as_bytes(), &salt)?;
    Ok(hash.to_string())
}

/// Verify a password against a stored hash
pub fn verify_password(password: &str, hash: &str) -> Result<bool, argon2::password_hash::Error> {
    let parsed_hash = PasswordHash::new(hash)?;
    Ok(argon2_instance()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_and_verify() {
        let password = "test_password_123";
        let hash = hash_password(password).unwrap();
        assert!(verify_password(password, &hash).unwrap());
        assert!(!verify_password("wrong_password", &hash).unwrap());
    }

    #[test]
    fn test_empty_password() {
        let result = hash_password("");
        assert!(
            result.is_ok(),
            "Argon2 should allow hashing an empty password"
        );
        let hash = result.unwrap();
        assert!(verify_password("", &hash).unwrap());
    }

    #[test]
    fn test_long_password() {
        let long_password = "a".repeat(1000);
        let result = hash_password(&long_password);
        assert!(result.is_ok(), "Argon2 should handle a 1000-char password");
        let hash = result.unwrap();
        assert!(verify_password(&long_password, &hash).unwrap());
    }

    #[test]
    fn test_hash_format_starts_with_argon2() {
        let hash = hash_password("some_password").unwrap();
        assert!(
            hash.starts_with("$argon2"),
            "Hash should start with $argon2, got: {}",
            hash
        );
    }

    #[test]
    fn test_different_passwords_different_hashes() {
        let hash1 = hash_password("password_one").unwrap();
        let hash2 = hash_password("password_two").unwrap();
        assert_ne!(
            hash1, hash2,
            "Different passwords should produce different hashes"
        );
    }

    #[test]
    fn test_verify_with_invalid_hash_format() {
        let result = verify_password("any_password", "not-a-valid-hash");
        assert!(result.is_err(), "Invalid hash format should return Err");
    }

    #[test]
    fn test_same_password_produces_different_hashes_salt_uniqueness() {
        let password = "identical_password";
        let hash1 = hash_password(password).unwrap();
        let hash2 = hash_password(password).unwrap();
        assert_ne!(
            hash1, hash2,
            "Two hashes of the same password should differ due to unique salts"
        );
        // Both must still verify against the original password
        assert!(verify_password(password, &hash1).unwrap());
        assert!(verify_password(password, &hash2).unwrap());
    }

    #[test]
    fn test_unicode_password() {
        let unicode_password = "\u{1F4A9}emoji\u{2603}snowman\u{00E9}accent";
        let hash = hash_password(unicode_password).unwrap();
        assert!(verify_password(unicode_password, &hash).unwrap());
        assert!(!verify_password("wrong", &hash).unwrap());
    }

    #[test]
    fn test_whitespace_password() {
        let password = "   spaces and\ttabs\nnewlines   ";
        let hash = hash_password(password).unwrap();
        assert!(verify_password(password, &hash).unwrap());
        assert!(!verify_password(password.trim(), &hash).unwrap());
    }

    #[test]
    fn test_special_characters_password() {
        let password = r#"!@#$%^&*()_+-={}[]|\":;'<>,.?/"#;
        let hash = hash_password(password).unwrap();
        assert!(verify_password(password, &hash).unwrap());
    }
}
